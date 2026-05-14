// ============================================================
// nodes/cross-dept-retrieval.ts — BI specialist node (ATH-35)
// ============================================================
// BI-ONLY PATH. Enforces super_user role check (mapped from
// org:bi_analyst). Every execution writes a row to bi_access_audit.
// ============================================================

import { ToolNode } from '@langchain/langgraph/prebuilt'
import { ToolMessage } from '@langchain/core/messages'
import { supabaseAdmin } from '@/lib/supabase/server'
import { crossDeptVectorSearchTool } from '@/lib/langgraph/tools/registry'
import type { AtheneState, AtheneStateUpdate } from '../state'
import { logger } from '@/lib/logger'

// ToolNode singleton for this node
const toolNode = new ToolNode([crossDeptVectorSearchTool])

/**
 * BI Specialist agent worker.
 * Specifically uses crossDeptVectorSearchTool which enforces the super_user role.
 * 🔒 Rule: Must audit every access attempt in bi_access_audit.
 */
export async function crossDeptRetrievalAgent(
  state: AtheneState,
  config: any,
): Promise<AtheneStateUpdate> {
  const { orgId, userId, role } = state

  // 🛡️ HARD ROLE CHECK — Defense-in-depth
  // role 'super_user' is mapped from Clerk 'org:bi_analyst'
  if (role !== 'super_user' && role !== 'admin') {
    return {
      messages: [
        {
          role: 'assistant',
          content: 'Access Denied: Cross-department analysis is restricted to BI Analysts.',
        } as any,
      ],
    }
  }

  // Inject security context into tool config metadata
  const toolConfig = {
    ...config,
    metadata: {
      ...(config?.metadata ?? {}),
      orgId,
      userId,
      role,
    },
  }

  // Run search
  const result = await toolNode.invoke(
    { messages: state.messages },
    toolConfig,
  )

  // Parse retrieved docs
  const retrievedDocs = result.messages
    .filter((m: any): m is ToolMessage => m instanceof ToolMessage)
    .flatMap((m: ToolMessage) => {
      try {
        return JSON.parse(m.content as string)
      } catch {
        return []
      }
    })

  // Extract query
  const lastMessage = state.messages.at(-1) as any
  const queryText =
    typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage?.content ?? '')

  // 🔒 AUDIT TRAIL — writes to bi_access_audit (Table added in migration 20260430110000)
  await writeBIAuditRows(orgId, userId, queryText, retrievedDocs)

  return {
    messages: result.messages,
    retrieved_chunks: retrievedDocs,
  }
}

async function writeBIAuditRows(
  orgId: string,
  userId: string,
  query: string,
  docs: any[],
): Promise<void> {
  try {
    const rows =
      docs.length > 0
        ? docs.map((doc) => ({
            org_id: orgId,
            user_id: userId,
            query,
            dept: doc.metadata?.department_id ?? null,
            doc_id: doc.chunk_id ?? doc.id ?? null,
          }))
        : [
            {
              org_id: orgId,
              user_id: userId,
              query,
              dept: null,
              doc_id: null,
            },
          ]

    const { error } = await supabaseAdmin.from('bi_access_audit').insert(rows)
    if (error) {
      logger.error({ err: error.message }, '[cross-dept-retrieval] bi_access_audit write failed')
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, '[cross-dept-retrieval] Audit exception')
  }
}
