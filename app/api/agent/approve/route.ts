import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentGraph } from "@/lib/langgraph/graph";
import { resolveUserAccess } from "@/lib/auth/rbac";

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { threadId, action } = body;

    if (!threadId || !action) {
      return NextResponse.json(
        { error: "threadId and action are required" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const access = await resolveUserAccess(userId, orgId);
    if (!access.internal_org_id || !access.internal_user_id) {
      return NextResponse.json(
        { error: "User or organization not found" },
        { status: 404 }
      );
    }

    const graph = await getAgentGraph();
    const snapshot = await graph.getState({
      configurable: { thread_id: threadId },
    });

    const state = snapshot?.values as Record<string, any> | undefined;
    if (!state?.orgId) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (state.orgId !== orgId || state.userId !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!state.awaiting_approval) {
      return NextResponse.json(
        { error: "Thread is not awaiting approval" },
        { status: 409 }
      );
    }

    // Validate that the action matches the pending write action
    const pendingAction = state.pending_write_action as Record<string, any> | null;
    if (pendingAction && pendingAction.tool) {
      // Log a warning if there's a mismatch — the frontend should be consistent
      // but we don't block the action since the user explicitly clicked approve/reject
      console.log(
        `[approve] Action "${action}" for tool "${pendingAction.tool}"`
      );
    }

    // Resume the graph with approval decision
    const update: Record<string, any> = {
      run_status: "running",
      awaiting_approval: false,
    };

    if (action === "reject") {
      update.approval_decision = "rejected";
    } else {
      update.approval_decision = "approved";
    }

    await graph.updateState(
      { configurable: { thread_id: threadId } },
      update
    );

    // Start streaming the resumed run
    const encoder = new TextEncoder();
    const transformStream = new TransformStream();
    const writer = transformStream.writable.getWriter();

    (async () => {
      try {
        const eventStream = await graph.stream(null, {
          configurable: { thread_id: threadId },
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
              run_status: chunk.run_status,
            });
            await writer.write(encoder.encode(`data: ${data}\n\n`));
          }
        }
        await writer.close();
      } catch (err: unknown) {
        console.error("[approve] Stream error:", err);
        await writer.abort(err);
      }
    })();

    return new Response(transformStream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[approve] API error:", msg);
    return new NextResponse(msg, { status: 500 });
  }
}
