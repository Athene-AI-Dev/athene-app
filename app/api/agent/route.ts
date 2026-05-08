import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { HumanMessage } from "@langchain/core/messages";
import { getAgentGraph } from "@/lib/langgraph/graph";
import { mapRole } from "@/lib/auth/clerk";
import { rateLimit } from "@/lib/redis/client";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { message, threadId, task_type, is_cross_dept_query } = await req.json();

    // 1. Validate Message
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "A non-empty message string is required." }, { status: 400 });
    }
    if (message.length > 10000) {
      return NextResponse.json({ error: "Message exceeds maximum length of 10,000 characters." }, { status: 400 });
    }

    // 2. Validate Thread ID (prevent predictable patterns/unbounded growth)
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required to maintain conversation state and prevent unbounded history." }, { status: 400 });
    }

    const { allowed } = await rateLimit(`agent:${userId}`, 10, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const effectiveThreadId = threadId;

    // Resolve internal org and user for thread persistence
    let { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    // ATH-PROD: Auto-sync organization if missing (Issue #404 fix)
    if (!orgRow) {
      const { data: newOrg, error: orgCreateError } = await supabaseAdmin
        .from("organizations")
        .insert({ 
          clerk_org_id: orgId,
          name: "Organization " + orgId.slice(-4), // Fallback name
          slug: "org-" + orgId.slice(-8)
        })
        .select("id")
        .single();
      
      if (orgCreateError) {
        logger.error({ orgId, err: orgCreateError.message }, "[agent] Org sync failed");
        return NextResponse.json({ error: "Failed to sync organization" }, { status: 500 });
      }
      orgRow = newOrg;
    }

    let { data: memberRow } = await supabaseAdmin
      .from("org_members")
      .select("id")
      .eq("clerk_user_id", userId)
      .eq("org_id", orgRow!.id)
      .single();

    // ATH-PROD: Auto-sync user membership if missing
    if (!memberRow) {
      const { data: newMember, error: memberCreateError } = await supabaseAdmin
        .from("org_members")
        .insert({
          org_id: orgRow!.id,
          clerk_user_id: userId,
          email: "unknown@sync.athene.ai", // Placeholder, ideally fetch from Clerk if needed
          full_name: "User " + userId.slice(-4),
          role: mapRole(orgRole ?? undefined) ?? "member",
          active: true
        })
        .select("id")
        .single();

      if (memberCreateError) {
        logger.error({ userId, orgId, err: memberCreateError.message }, "[agent] Member sync failed");
        return NextResponse.json({ error: "Failed to sync user membership" }, { status: 500 });
      }
      memberRow = newMember;
    }

    // 3. Ensure Thread Persistence (Required for HITL foreign keys)
    const { error: threadError } = await supabaseAdmin
      .from("threads")
      .upsert({
        id: effectiveThreadId,
        org_id: orgRow.id,
        user_id: memberRow.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (threadError) {
      logger.error({ threadId: effectiveThreadId, err: threadError.message }, "[agent] Thread persistence failed");
      // If it's not a valid UUID, this will fail here instead of crashing the graph later
      return NextResponse.json({ error: "Invalid thread ID format or persistence failure." }, { status: 400 });
    }

    const graph = await getAgentGraph();
    
    // ATH-43: Prevent concurrent messages if the thread is awaiting approval
    const currentState = await graph.getState({ configurable: { thread_id: effectiveThreadId } });
    if (currentState?.values?.awaiting_approval) {
      return NextResponse.json(
        { error: "A specific action is awaiting your approval. Please approve, edit, or reject it before sending more messages." },
        { status: 409 }
      );
    }

    const role = mapRole(orgRole ?? undefined) ?? "member";

    const initialState = {
      messages: [new HumanMessage(message)],
      orgId: orgRow.id,
      userId: memberRow.id,
      role,
      user: {
        id: userId, // Keep Clerk ID for display/identity if needed
        internalId: memberRow.id,
        timezone: "UTC", // TODO: Fetch real timezone from user preferences in DB
      },
      task_type: task_type || "general",
      is_cross_dept_query: !!is_cross_dept_query,
    };

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    (async () => {
      try {
        const eventStream = await graph.stream(initialState, {
          configurable: {
            thread_id: effectiveThreadId,
          },
          streamMode: "values",
        });

        for await (const chunk of eventStream as AsyncIterable<any>) {
          const lastMessage = chunk.messages?.[chunk.messages.length - 1];
          if (lastMessage) {
            const data = JSON.stringify({
              content: lastMessage.content,
              final_answer: chunk.final_answer ?? null,
              cited_sources: chunk.cited_sources ?? [],
              awaiting_approval: chunk.awaiting_approval ?? false,
              pending_write_action: chunk.pending_write_action ?? null,
              active_agent: chunk.next ?? null,
            });
            await writer.write(encoder.encode(`data: ${data}\n\n`));
          }
        }
        await writer.close();
      } catch (err: unknown) {
        console.error("[agent] Stream error:", err);
        await writer.abort(err);
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[agent] API error:", msg);
    return new NextResponse(msg, { status: 500 });
  }
}
