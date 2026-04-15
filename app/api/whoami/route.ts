import { NextResponse } from "next/server";
import { getContextFromHeaders, withRLS } from "@/lib/supabase/rls-client";

export async function GET(request: Request) {
  const context = getContextFromHeaders(request.headers);

  if (!context) {
    return NextResponse.json({ 
      error: "Unauthorized or missing org context. Ensure you are signed into an organization." 
    }, { status: 401 });
  }

  try {
    // Demonstrate full RLS chain by running a query through the wrapper
    const result = await withRLS(context, async (tx) => {
      // This query is now RLS-protected by the session variables set in the wrapper
      const user = await tx`
        SELECT * FROM org_members 
        WHERE id = ${context.user_id}
      `;
      
      const org = await tx`
        SELECT * FROM organizations 
        WHERE id = ${context.org_id}
      `;

      return {
        profile: user[0],
        organization: org[0]
      };
    });

    return NextResponse.json({
      message: "Full RLS chain verified.",
      context,
      data: result
    });
  } catch (error) {
    console.error("Error in whoami route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
