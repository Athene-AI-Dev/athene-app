// ============================================================
// lib/langgraph/nodes/__tests__/cross-dept-retrieval.test.ts
//
// Covers: role gating (member/admin/super_user), audit trail
// writes, tool invocation, and audit failure tolerance.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────

const mockToolNodeInvoke = vi.fn();
const mockSupabaseInsert = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock("@langchain/langgraph/prebuilt", () => ({
  ToolNode: vi.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => mockToolNodeInvoke(...args),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock("@/lib/langgraph/tools/registry", () => ({
  crossDeptVectorSearchTool: { name: "crossDeptVectorSearch" },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ─── Import after mocks ─────────────────────────────────────

import { crossDeptRetrievalAgent } from "../cross-dept-retrieval";
// Import ToolMessage for instanceof check
import { ToolMessage } from "@langchain/core/messages";

// ─── Helpers ───────────────────────────────────────────────

function makeState(role: string, overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org-1",
    userId: "user-bi",
    role,
    messages: [{ _getType: () => "human", content: "What is cross-dept revenue?" }],
    next_node: "",
    retrievedDocs: [],
    awaiting_approval: false,
    pending_write_action: null,
    run_status: "running",
    final_answer: null,
    cited_sources: [],
    retrieved_chunks: [],
    action_result: null,
    action_error: null,
    task_type: null,
    is_cross_dept_query: true,
    ...overrides,
  } as any;
}

function makeAuditTable(insertError: unknown = null) {
  const insertMock = vi.fn().mockResolvedValue({ error: insertError });
  mockSupabaseFrom.mockReturnValue({ insert: insertMock });
  return insertMock;
}

function makeToolMessage(content: unknown) {
  return new ToolMessage({ content: JSON.stringify(content), tool_call_id: "tc-1" });
}

// ─── Tests ─────────────────────────────────────────────────

describe("crossDeptRetrievalAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Role gating ──────────────────────────────────────────

  it("returns Access Denied for role=member", async () => {
    const result = await crossDeptRetrievalAgent(makeState("member"), {});

    const msg = (result as any).messages?.[0];
    expect(msg?.content).toMatch(/Access Denied/i);
    expect(mockToolNodeInvoke).not.toHaveBeenCalled();
  });

  it("returns Access Denied for role=viewer", async () => {
    const result = await crossDeptRetrievalAgent(makeState("viewer"), {});

    const msg = (result as any).messages?.[0];
    expect(msg?.content).toMatch(/Access Denied/i);
  });

  it("proceeds for role=super_user", async () => {
    const doc = { chunk_id: "c-1", metadata: { department_id: "dept-bi" } };
    mockToolNodeInvoke.mockResolvedValue({
      messages: [makeToolMessage([doc])],
    });
    makeAuditTable();

    const result = await crossDeptRetrievalAgent(makeState("super_user"), {});

    expect(mockToolNodeInvoke).toHaveBeenCalledOnce();
    expect((result as any).retrieved_chunks).toEqual([doc]);
  });

  it("proceeds for role=admin", async () => {
    const doc = { chunk_id: "c-2", metadata: {} };
    mockToolNodeInvoke.mockResolvedValue({
      messages: [makeToolMessage([doc])],
    });
    makeAuditTable();

    const result = await crossDeptRetrievalAgent(makeState("admin"), {});

    expect(mockToolNodeInvoke).toHaveBeenCalledOnce();
    expect((result as any).retrieved_chunks).toEqual([doc]);
  });

  // ── Tool invocation with security context ─────────────────

  it("injects orgId, userId, role into tool config metadata", async () => {
    mockToolNodeInvoke.mockResolvedValue({ messages: [] });
    makeAuditTable();

    const baseConfig = { runId: "run-1", metadata: { existing: true } };
    await crossDeptRetrievalAgent(makeState("super_user"), baseConfig);

    const callConfig = mockToolNodeInvoke.mock.calls[0][1];
    expect(callConfig.metadata.orgId).toBe("org-1");
    expect(callConfig.metadata.userId).toBe("user-bi");
    expect(callConfig.metadata.role).toBe("super_user");
    expect(callConfig.metadata.existing).toBe(true); // preserves existing metadata
  });

  // ── Audit trail ───────────────────────────────────────────

  it("writes one audit row per retrieved doc", async () => {
    const docs = [
      { chunk_id: "c-1", metadata: { department_id: "dept-finance" } },
      { chunk_id: "c-2", metadata: { department_id: "dept-hr" } },
    ];
    mockToolNodeInvoke.mockResolvedValue({ messages: [makeToolMessage(docs)] });
    const insertMock = makeAuditTable();

    await crossDeptRetrievalAgent(makeState("super_user"), {});

    expect(insertMock).toHaveBeenCalledOnce();
    const rows = insertMock.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ org_id: "org-1", user_id: "user-bi", doc_id: "c-1", dept: "dept-finance" });
    expect(rows[1]).toMatchObject({ doc_id: "c-2", dept: "dept-hr" });
  });

  it("writes a null-doc audit row when no docs are retrieved", async () => {
    mockToolNodeInvoke.mockResolvedValue({ messages: [] });
    const insertMock = makeAuditTable();

    await crossDeptRetrievalAgent(makeState("super_user"), {});

    const rows = insertMock.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ org_id: "org-1", user_id: "user-bi", doc_id: null, dept: null });
  });

  it("includes the user query in the audit row", async () => {
    mockToolNodeInvoke.mockResolvedValue({ messages: [] });
    const insertMock = makeAuditTable();

    await crossDeptRetrievalAgent(
      makeState("super_user", {
        messages: [{ _getType: () => "human", content: "Cross-dept revenue breakdown" }],
      }),
      {}
    );

    const rows = insertMock.mock.calls[0][0];
    expect(rows[0].query).toBe("Cross-dept revenue breakdown");
  });

  it("does not throw when audit write fails (fault tolerance)", async () => {
    mockToolNodeInvoke.mockResolvedValue({ messages: [] });
    makeAuditTable({ message: "DB connection refused" });

    // Should not throw even when audit insert errors
    await expect(crossDeptRetrievalAgent(makeState("super_user"), {})).resolves.toBeDefined();
  });
});
