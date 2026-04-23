// ============================================================
// POST /api/agent — Main agent execution endpoint
//
// Streams agent events back to the client via SSE.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { HumanMessage } from "@langchain/core/messages";
import { agentGraph } from "@/lib/langgraph/graph";
import type { UserRole } from "@/lib/langgraph/state";

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { message, threadId } = await req.json();

    // Map Clerk org roles to canonical UserRole.
    // super_user is granted via the access_grants table, not via Clerk role.
    const user_role: UserRole =
      orgRole === "org:admin" ? "admin" : "member";

    const initialState = {
      messages: [new HumanMessage(message)],
      org_id: orgId,
      user_id: userId,
      user_role,
      thread_id: threadId || `user-${userId}`,
    };

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start execution in background
    (async () => {
      try {
        const eventStream = await agentGraph.stream(initialState, {
          configurable: {
            thread_id: threadId || `user-${userId}`,
          },
          streamMode: "values",
        });

        for await (const chunk of eventStream) {
          const lastMessage =
            chunk.messages?.[chunk.messages.length - 1];
          if (lastMessage) {
            const data = JSON.stringify({
              content: lastMessage.content,
              final_answer: chunk.final_answer ?? null,
              cited_sources: chunk.cited_sources ?? [],
              awaiting_approval: chunk.awaiting_approval ?? false,
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
    const msg =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("[agent] API error:", msg);
    return new NextResponse(msg, { status: 500 });
  }
}
