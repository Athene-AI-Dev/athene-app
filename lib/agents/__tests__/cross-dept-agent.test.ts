// ============================================================
// cross-dept-agent.test.ts — ATH-35 unit tests
//
// Verifies:
//   1. Hard role check rejects non-bi_analysts immediately
//   2. bi_analyst role invokes the cross-dept tool
//   3. Audit rows always written (even on 0 results)
//   4. Audit write failures don't bubble up
// ============================================================

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ToolMessage } from '@langchain/core/messages'
import type { AtheneStateType } from '@/lib/langgraph/state'

// ---- Mock ToolNode ------------------------------------------

const { mockToolNodeInvoke } = vi.hoisted(() => ({
  mockToolNodeInvoke: vi.fn(),
}))

vi.mock('@langchain/langgraph/prebuilt', () => ({
  ToolNode: class FakeToolNode {
    constructor(public tools: any[]) {}
    invoke = mockToolNodeInvoke
  },
}))

// ---- Mock tool registry -------------------------------------

vi.mock('@/lib/langgraph/tools/registry', () => ({
  crossDeptVectorSearchTool: { name: 'cross_dept_vector_search' },
  toolsRegistry: [],
  registerTool: vi.fn(),
}))

// ---- Mock supabaseAdmin -------------------------------------

const { mockInsert, mockFromAudit } = vi.hoisted(() => {
  const mockInsert = vi.fn()
  const mockFromAudit = vi.fn(() => ({ insert: mockInsert }))
  mockInsert.mockResolvedValue({ error: null })
  return { mockInsert, mockFromAudit }
})

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockFromAudit },
}))

// ---- Import after mocks ------------------------------------

import { crossDeptRetrievalAgent } from '@/lib/langgraph/nodes/cross-dept-retrieval'

// ---- Helpers ------------------------------------------------

function makeState(
  role: string,
  messages: any[] = [],
): AtheneStateType {
  return {
    orgId: 'org-test',
    userId: 'user-test',
    role,
    messages: messages.length > 0
      ? messages
      : [{ role: 'user', content: 'Show me cross-dept trends' }],
    retrievedDocs: [],
  } as any
}

// ---- Tests --------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockResolvedValue({ error: null })
})

describe('crossDeptRetrievalAgent — role guard', () => {
  it('rejects non-super_user with Access Denied message', async () => {
    const result = await crossDeptRetrievalAgent(makeState('member'), {})

    expect(result.messages).toBeDefined()
    expect(result.messages![0]).toMatchObject({
      role: 'assistant',
      content: expect.stringContaining('Access Denied'),
    })
    // Tool should never be invoked
    expect(mockToolNodeInvoke).not.toHaveBeenCalled()
  })

  it('allows admin role', async () => {
    mockToolNodeInvoke.mockResolvedValue({
      messages: [new ToolMessage({ tool_call_id: 'tc-1', content: '[]' })],
    })
    const result = await crossDeptRetrievalAgent(makeState('admin'), {})
    expect(result.messages).toBeDefined()
    expect(result.messages![0].content).not.toContain('Access Denied')
  })

  it('rejects empty string role', async () => {
    const result = await crossDeptRetrievalAgent(makeState(''), {})
    expect(result.messages![0].content).toContain('Access Denied')
  })
})

describe('crossDeptRetrievalAgent — super_user path', () => {
  beforeEach(() => {
    // Tool returns one doc
    mockToolNodeInvoke.mockResolvedValue({
      messages: [
        new ToolMessage({
          tool_call_id: 'tc-1',
          content: JSON.stringify([
            {
              chunk_id: 'chunk-1',
              metadata: { department_id: 'finance' },
            },
          ]),
        }),
      ],
    })
  })

  it('invokes tool node and returns messages', async () => {
    const result = await crossDeptRetrievalAgent(makeState('super_user'), {})

    expect(mockToolNodeInvoke).toHaveBeenCalledOnce()
    expect(result.messages).toBeDefined()
  })

  it('passes orgId, userId, role into tool config metadata', async () => {
    await crossDeptRetrievalAgent(makeState('super_user'), { metadata: {} })

    const callArg = mockToolNodeInvoke.mock.calls[0][1]
    expect(callArg.metadata).toMatchObject({
      orgId: 'org-test',
      userId: 'user-test',
      role: 'super_user',
    })
  })

  it('sets retrievedDocs from parsed tool messages', async () => {
    const result = await crossDeptRetrievalAgent(makeState('super_user'), {})

    expect(result.retrieved_chunks).toHaveLength(1)
    expect((result.retrieved_chunks as any[])[0].chunk_id).toBe('chunk-1')
  })
})

describe('crossDeptRetrievalAgent — audit logging', () => {
  it('writes audit row when docs retrieved', async () => {
    mockToolNodeInvoke.mockResolvedValue({
      messages: [
        new ToolMessage({
          tool_call_id: 'tc-1',
          content: JSON.stringify([
            { chunk_id: 'c-1', metadata: { department_id: 'eng' } },
            { chunk_id: 'c-2', metadata: { department_id: 'finance' } },
          ]),
        }),
      ],
    })

    await crossDeptRetrievalAgent(makeState('super_user'), {})

    expect(mockFromAudit).toHaveBeenCalledWith('bi_access_audit')
    const insertArg = mockInsert.mock.calls[0][0] as any[]
    expect(insertArg).toHaveLength(2)
    expect(insertArg[0]).toMatchObject({ org_id: 'org-test', doc_id: 'c-1', dept: 'eng' })
    expect(insertArg[1]).toMatchObject({ org_id: 'org-test', doc_id: 'c-2', dept: 'finance' })
  })

  it('writes single null-doc audit row when 0 docs returned', async () => {
    mockToolNodeInvoke.mockResolvedValue({ messages: [] })

    await crossDeptRetrievalAgent(makeState('super_user'), {})

    expect(mockFromAudit).toHaveBeenCalledWith('bi_access_audit')
    const insertArg = mockInsert.mock.calls[0][0] as any[]
    expect(insertArg).toHaveLength(1)
    expect(insertArg[0]).toMatchObject({
      org_id: 'org-test',
      user_id: 'user-test',
      doc_id: null,
      dept: null,
    })
  })

  it('audit failure does not bubble up', async () => {
    mockToolNodeInvoke.mockResolvedValue({ messages: [] })
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } })

    // Should resolve without throwing
    await expect(
      crossDeptRetrievalAgent(makeState('super_user'), {}),
    ).resolves.toBeDefined()
  })

  it('extracts query text from last human message', async () => {
    mockToolNodeInvoke.mockResolvedValue({ messages: [] })

    await crossDeptRetrievalAgent(
      makeState('super_user', [
        { role: 'user', content: 'what are the finance trends?' },
      ]),
      {},
    )

    const insertArg = mockInsert.mock.calls[0][0] as any[]
    expect(insertArg[0].query).toBe('what are the finance trends?')
  })
})
