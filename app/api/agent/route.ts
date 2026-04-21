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

    const { message } = await req.json();

    // Map Clerk roles to our internal RLS roles
    const role = orgRole === "admin" ? "admin" : 
                 orgRole === "org:bi_analyst" ? "bi_analyst" : "member";

    const initialState = {
      messages: [new HumanMessage(message)],
      orgId,
      userId,
      role,
    };

    // Run the graph with security metadata
    const result = await agentGraph.invoke(initialState, {
      configurable: {
        thread_id: userId, // Simple per-user persistence
      },
      metadata: {
        orgId,
        userId,
        role,
      },
    });

    return NextResponse.json({
      response: result.messages[result.messages.length - 1].content,
      docs: result.retrievedDocs,
    });
  } catch (error: any) {
    console.error("Agent API Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
