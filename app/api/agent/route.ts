import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { agentGraph } from "@/lib/langgraph/graph";
import { HumanMessage } from "@langchain/core/messages";

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { message, threadId } = await req.json();

    // Map Clerk roles to our internal RLS roles
    const role = orgRole === "admin" ? "admin" : 
                 orgRole === "org:bi_analyst" ? "bi_analyst" : "member";

    const initialState = {
      messages: [new HumanMessage(message)],
      orgId,
      userId,
      role,
    };

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start execution in background
    (async () => {
      try {
        const eventStream = await agentGraph.stream(initialState, {
          configurable: {
            thread_id: threadId || `user-${userId}`, // Scoped to conversation if threadId provided
          },
          metadata: {
            orgId,
            userId,
            role,
          },
          streamMode: "values",
        });

        for await (const chunk of eventStream) {
          const lastMessage = chunk.messages?.[chunk.messages.length - 1];
          if (lastMessage) {
            const data = JSON.stringify({
              content: lastMessage.content,
              docs: chunk.retrievedDocs,
              node: chunk.next,
            });
            await writer.write(encoder.encode(`data: ${data}\n\n`));
          }
        }
        await writer.close();
      } catch (err: any) {
        console.error("Stream Error:", err);
        await writer.abort(err);
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Agent API Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
