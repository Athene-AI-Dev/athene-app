import { NextRequest, NextResponse } from "next/server";
import { cachedAuth } from "@/lib/auth/cached-clerk";
import { HumanMessage } from "@langchain/core/messages";
import { getAgentGraph } from "@/lib/langgraph/graph";
import { mapRole } from "@/lib/auth/clerk";
import { rateLimit, cached } from "@/lib/redis/client";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withSSEFrameSpan } from "@/lib/telemetry/spans";

export async function POST(req: NextRequest) {
  try {
    const authResult = await cachedAuth(req);
    const { userId, orgId, orgRole } = authResult;

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

    // 2. Validate Thread ID
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required to maintain conversation state and prevent unbounded history." }, { status: 400 });
    }

    const { allowed } = await rateLimit(`agent:${userId}`, 10, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const effectiveThreadId = threadId;

    // Resolve internal org and user for thread persistence (cached)
    let orgRow = await cached(
      `org:clerk:${orgId}`,
      300,
      async () => {
        const { data } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("clerk_org_id", orgId)
          .single();
        return data;
      }
    );

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
        .limit(1)
        .maybeSingle();
      
      if (orgCreateError) {
        logger.error({ orgId, err: orgCreateError.message }, "[agent] Org sync failed");
        return NextResponse.json({ error: "Failed to sync organization" }, { status: 500 });
      }
      orgRow = newOrg;
    }

    let memberRow = await cached(
      `member:clerk:${userId}:${orgRow!.id}`,
      300,
      async () => {
        const { data } = await supabaseAdmin
          .from("org_members")
          .select("id, timezone")
          .eq("clerk_user_id", userId)
          .eq("org_id", orgRow!.id)
          .single();
        return data;
      }
    );

    // ATH-PROD: Auto-sync user membership if missing
    if (!memberRow) {
      const { data: newMember, error: memberCreateError } = await supabaseAdmin
        .from("org_members")
        .insert({
          org_id: orgRow!.id,
          clerk_user_id: userId,
          email: "unknown@sync.athene.ai", // Placeholder, ideally fetch from Clerk if needed
          display_name: "User " + userId.slice(-4),
          role: mapRole(orgRole ?? undefined) ?? "member",
        })
        .select("id")
        .limit(1)
        .maybeSingle();

      if (memberCreateError) {
        logger.error({ userId, orgId, err: memberCreateError.message }, "[agent] Member sync failed");
        return NextResponse.json({ error: "Failed to sync user membership" }, { status: 500 });
      }
      memberRow = newMember ? { ...newMember, timezone: null } : null;
    }

    // 3. Ensure Thread Persistence (Required for HITL foreign keys)
    // orgRow and memberRow are guaranteed non-null by the sync blocks above.
    if (!orgRow || !memberRow) {
      return NextResponse.json({ error: "Failed to resolve organization or user." }, { status: 500 });
    }

    const { error: threadError } = await supabaseAdmin
      .from("threads")
      .upsert({
        id: effectiveThreadId,
        org_id: orgRow.id,
        user_id: memberRow.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (threadError) {
      logger.warn({ threadId: effectiveThreadId, err: threadError.message }, "[agent] Thread persistence failed - continuing with in-memory state only");
      // ATH-PROD: Do not return 500. Let the graph proceed even if DB sync fails
      // This prevents "Legacy Ghost" FK issues from blocking the entire chat.
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
        id: userId,
        internalId: memberRow.id,
        timezone: (memberRow as any)?.timezone ?? "UTC",
      },
      task_type: task_type || "general",
      is_cross_dept_query: !!is_cross_dept_query,
    };

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    let firstTokenSent = false;
    const firstTokenTime = Date.now();

    (async () => {
      try {
        const eventStream = await graph.stream(initialState, {
          configurable: {
            thread_id: effectiveThreadId,
          },
          streamMode: ["values", "messages"],
        });

        for await (const [mode, chunk] of eventStream as AsyncIterable<[string, any]>) {
          if (mode === "messages") {
            const messageChunk = (chunk as any[])?.[0];
            if (messageChunk?.content) {
              const token = typeof messageChunk.content === "string"
                ? messageChunk.content
                : Array.isArray(messageChunk.content)
                  ? messageChunk.content.map((c: any) => c.text || "").join("")
                  : "";
              if (token && !firstTokenSent) {
                firstTokenSent = true;
                console.log(`[agent] First token latency: ${Date.now() - firstTokenTime}ms`);
              }
              if (token) {
                const data = JSON.stringify({ token });
                await withSSEFrameSpan("llm_token", async () => {
                  await writer.write(encoder.encode(`data: ${data}\n\n`));
                });
              }
            }
          } else if (mode === "values") {
            const messages = chunk.messages as any[] | undefined;
            const lastMessage = messages?.[messages.length - 1];
            if (lastMessage) {
              const data = JSON.stringify({
                content: lastMessage.content,
                final_answer: chunk.final_answer ?? null,
                cited_sources: chunk.cited_sources ?? [],
                awaiting_approval: chunk.awaiting_approval ?? false,
                active_agent: chunk.next ?? null,
              });
              await withSSEFrameSpan("agent_chunk", async () => {
                await writer.write(encoder.encode(`data: ${data}\n\n`));
              });
            }
          }
        }
        await writer.close();
      } catch (err: any) {
        console.error("[agent] Stream error:", err);
        const isQuota = err.message.includes("quota") || err.message.includes("rate_limit") || err.message.includes("429");
        const errorData = JSON.stringify({
          error: true,
          content: isQuota
            ? "Synthesis halted: LLM quota exceeded. Check your API key billing or add a BYOK key in Admin → Keys."
            : `Synthesis error: ${err.message}`,
        });
        await writer.write(encoder.encode(`data: ${errorData}\n\n`));
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[agent] API error:", msg);
    return new NextResponse(msg, { status: 500 });
  }
}
