import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { HumanMessage } from "@langchain/core/messages";
import { buildAtheneGraph } from "@/lib/langgraph/graph";
import { checkpointer } from "@/lib/langgraph/checkpointer";
import { mapRole } from "@/lib/auth/clerk";

const graph = buildAtheneGraph(checkpointer);

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { message, threadId } = await req.json();

    const user_role = mapRole(orgRole ?? undefined) ?? "member";

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

    (async () => {
      try {
        const eventStream = await graph.stream(initialState, {
          configurable: {
            thread_id: threadId || `user-${userId}`,
          },
          streamMode: "values",
        });

        for await (const chunk of eventStream) {
          const lastMessage = chunk.messages?.[chunk.messages.length - 1];
          if (lastMessage) {
            const data = JSON.stringify({
              content: lastMessage.content,
              final_answer: chunk.final_answer ?? null,
              cited_sources: chunk.cited_sources ?? [],
              awaiting_approval: chunk.awaiting_approval ?? false,
              active_agent: chunk.active_agent ?? null,
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
