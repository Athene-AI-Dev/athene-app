import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { HumanMessage } from "@langchain/core/messages";
import { getAgentGraph } from "@/lib/langgraph/graph";
import { mapRole } from "@/lib/auth/clerk";
import { rateLimit } from "@/lib/redis/client";
import { z } from "zod";

// Validate incoming body: message 1–4000 chars, optional UUID threadId
const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  threadId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // --- Rate limit: 20 requests per user per 60 seconds ---
    const { allowed } = await rateLimit(`agent:${userId}`, 20, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    // --- Input validation ---
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { message, threadId } = parsed.data;
    const effectiveThreadId = threadId || `user-${userId}`;

    const graph = await getAgentGraph();

    // --- Thread ownership verification (ATH-43 extension) ---
    // Ensure the requesting user owns the thread they are trying to use.
    const currentState = await graph.getState({
      configurable: { thread_id: effectiveThreadId },
    });

    if (currentState?.values) {
      // If the thread already has a userId stamped, verify it matches
      const threadOwner = currentState.values.userId as string | undefined;
      if (threadOwner && threadOwner !== userId) {
        return NextResponse.json(
          { error: "Thread not found." },
          { status: 404 }
        );
      }

      // Block concurrent messages if awaiting HITL approval
      if (currentState.values.awaiting_approval) {
        return NextResponse.json(
          {
            error:
              "A specific action is awaiting your approval. Please approve, edit, or reject it before sending more messages.",
          },
          { status: 409 }
        );
      }
    }

    const role = mapRole(orgRole ?? undefined) ?? "member";

    const initialState = {
      messages: [new HumanMessage(message)],
      orgId,
      userId,
      role,
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
    // Log the real error server-side but never leak internals to the client
    console.error("[agent] API error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
