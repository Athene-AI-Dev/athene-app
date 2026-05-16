// ============================================================
// lib/langgraph/tools/__tests__/indexer.test.ts
//
// Verifies the zero-storage embedding + KG pipeline.
// Core guarantee: document body never touches Supabase —
// only vectors, hashes, and KG entities are persisted.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (before imports) ───────────────────────────────────

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const mockExtract = vi.fn();
vi.mock("@/lib/knowledge-graph/extractor", () => ({
  extractEntitiesAndRelations: (...args: unknown[]) => mockExtract(...args),
}));

const mockDeleteByDocument = vi.fn();
const mockUpsertNodes = vi.fn();
const mockUpsertEdges = vi.fn();
vi.mock("@/lib/knowledge-graph/storage", () => ({
  deleteByDocument: (...args: unknown[]) => mockDeleteByDocument(...args),
  upsertNodes: (...args: unknown[]) => mockUpsertNodes(...args),
  upsertEdges: (...args: unknown[]) => mockUpsertEdges(...args),
}));

const mockChunk = vi.fn();
const mockCountTokens = vi.fn();
vi.mock("../chunker", () => ({
  chunk: (...args: unknown[]) => mockChunk(...args),
  countTokens: (...args: unknown[]) => mockCountTokens(...args),
}));

const mockEmbed = vi.fn();
vi.mock("../embedder", () => ({
  embed: (...args: unknown[]) => mockEmbed(...args),
  EMBEDDING_CONFIG: { model: "text-embedding-3-small", dimensions: 1536 },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ─── Import after mocks ───────────────────────────────────────

import { indexDocument, reindexDocument, sha256 } from "../indexer";

// ─── Helpers ─────────────────────────────────────────────────

const baseInput = {
  orgId: "org-1",
  documentId: "doc-1",
  sourceType: "confluence",
  content: "Hello world from Confluence",
  visibility: "org" as const,
};

const rlsContext = {
  userId: "user-1",
  orgId: "org-1",
  role: "member" as const,
};

function makeChunks(texts: string[]) {
  return texts.map((text, i) => ({ text, chunk_index: i }));
}

function makeFromChain({
  existingHashes = [] as string[],
  upsertError = null as string | null,
  updateError = null as string | null,
} = {}) {
  return vi.fn().mockImplementation((table: string) => {
    if (table === "document_embeddings") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({
          error: upsertError ? { message: upsertError } : null,
        }),
        then: undefined,
        // for dedup query
        mockResolvedValue: undefined,
      };
    }
    if (table === "documents") {
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: updateError ? { message: updateError } : null }),
      };
    }
    return {};
  });
}

// ─── Tests ────────────────────────────────────────────────────

describe("indexDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: lock acquired, released
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "acquire_document_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "release_document_lock") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockCountTokens.mockReturnValue(10);
  });

  // ── Guards ───────────────────────────────────────────────

  it("throws when orgId is missing", async () => {
    await expect(
      indexDocument({ ...baseInput, orgId: "" })
    ).rejects.toThrow("orgId is required");
  });

  it("throws when documentId is missing", async () => {
    await expect(
      indexDocument({ ...baseInput, documentId: "" })
    ).rejects.toThrow("documentId is required");
  });

  it("returns empty result when content is empty string", async () => {
    const result = await indexDocument({ ...baseInput, content: "" });
    expect(result).toEqual({
      chunksTotal: 0,
      chunksEmbedded: 0,
      chunksSkippedByHash: 0,
      nodesUpserted: 0,
      edgesUpserted: 0,
    });
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it("throws on Rule #2 violation: metadata contains 'content' key", async () => {
    await expect(
      indexDocument({ ...baseInput, metadata: { content: "sneaky body text" } })
    ).rejects.toThrow(/Rule #2 violation/i);
  });

  it("throws on Rule #2 violation: nested metadata contains 'body' key", async () => {
    await expect(
      indexDocument({ ...baseInput, metadata: { doc: { body: "sneaky" } } })
    ).rejects.toThrow(/Rule #2 violation/i);
  });

  // ── Happy path: all-new chunks ────────────────────────────

  it("embeds and upserts new chunks, never storing content", async () => {
    const chunks = makeChunks(["chunk A", "chunk B"]);
    mockChunk.mockReturnValue(chunks);
    mockEmbed.mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
    mockExtract.mockResolvedValue({ nodes: [], edges: [] });

    // Dedup: no existing hashes
    const mockEmbeddingsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    // Return existing hashes as empty on first call, handle upsert on second
    let embeddingsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        embeddingsCallCount++;
        if (embeddingsCallCount === 1) {
          // dedup query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return mockEmbeddingsTable;
      }
      if (table === "documents") {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    const result = await indexDocument({ ...baseInput, buildGraph: false });

    expect(result.chunksTotal).toBe(2);
    expect(result.chunksEmbedded).toBe(2);
    expect(result.chunksSkippedByHash).toBe(0);

    // Verify embed was called with chunk texts
    expect(mockEmbed).toHaveBeenCalledWith(["chunk A", "chunk B"]);

    // Verify upserted rows do NOT contain any content/body/text key
    const upsertArgs = mockEmbeddingsTable.upsert.mock.calls[0][0] as Record<string, unknown>[];
    for (const row of upsertArgs) {
      expect(row).not.toHaveProperty("content");
      expect(row).not.toHaveProperty("body");
      expect(row).not.toHaveProperty("text");
      expect(row).toHaveProperty("embedding");
      expect(row).toHaveProperty("content_hash");
      expect(row).toHaveProperty("org_id", "org-1");
    }
  });

  // ── Dedup: skip existing chunks ───────────────────────────

  it("skips embedding for chunks whose hash already exists", async () => {
    const chunks = makeChunks(["chunk A", "chunk B"]);
    mockChunk.mockReturnValue(chunks);
    mockEmbed.mockResolvedValue([[0.5, 0.6]]); // only 1 new vector

    const existingHash = sha256("chunk A");
    let embeddingsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        embeddingsCallCount++;
        if (embeddingsCallCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ content_hash: existingHash }],
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "documents") {
        return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    const result = await indexDocument({ ...baseInput, buildGraph: false });

    expect(result.chunksTotal).toBe(2);
    expect(result.chunksEmbedded).toBe(1);
    expect(result.chunksSkippedByHash).toBe(1);
    // embed called with only the new chunk
    expect(mockEmbed).toHaveBeenCalledWith(["chunk B"]);
  });

  // ── KG pass ───────────────────────────────────────────────

  it("calls extractEntitiesAndRelations and upserts nodes+edges when buildGraph is true", async () => {
    const chunks = makeChunks(["chunk A"]);
    mockChunk.mockReturnValue(chunks);
    mockEmbed.mockResolvedValue([[0.1, 0.2]]);

    const mockNodes = [{ id: "node-1", label: "Person", name: "Alice" }];
    const mockEdges = [{ source: "node-1", target: "node-2", relation: "knows" }];
    const mockIdMap = new Map([["node-1", "uuid-1"]]);
    mockExtract.mockResolvedValue({ nodes: mockNodes, edges: mockEdges });
    mockUpsertNodes.mockResolvedValue(mockIdMap);
    mockUpsertEdges.mockResolvedValue(undefined);

    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "documents") {
        return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    // Make both dedup and upsert work on same mockFrom
    let embeddingsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        embeddingsCallCount++;
        if (embeddingsCallCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "documents") {
        return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    const result = await indexDocument({ ...baseInput, buildGraph: true, rlsContext });

    expect(mockExtract).toHaveBeenCalledOnce();
    expect(mockUpsertNodes).toHaveBeenCalledWith(rlsContext, mockNodes);
    expect(mockUpsertEdges).toHaveBeenCalledWith(rlsContext, mockEdges, mockIdMap);
    expect(result.nodesUpserted).toBe(1);
    expect(result.edgesUpserted).toBe(1);
  });

  it("skips KG pass when no rlsContext is provided", async () => {
    const chunks = makeChunks(["chunk A"]);
    mockChunk.mockReturnValue(chunks);
    mockEmbed.mockResolvedValue([[0.1, 0.2]]);

    let embeddingsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        embeddingsCallCount++;
        if (embeddingsCallCount === 1) {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === "documents") {
        return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    const result = await indexDocument({ ...baseInput, buildGraph: true }); // no rlsContext

    expect(mockExtract).not.toHaveBeenCalled();
    expect(result.nodesUpserted).toBe(0);
    expect(result.edgesUpserted).toBe(0);
  });

  // ── Error propagation ─────────────────────────────────────

  it("throws when dedup fetch fails", async () => {
    mockChunk.mockReturnValue(makeChunks(["chunk A"]));
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: { message: "timeout" } }),
        };
      }
      return {};
    });

    await expect(indexDocument(baseInput)).rejects.toThrow(/dedup fetch failed/i);
  });

  it("throws when embeddings upsert fails", async () => {
    mockChunk.mockReturnValue(makeChunks(["chunk A"]));
    mockEmbed.mockResolvedValue([[0.1, 0.2]]);

    let embeddingsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        embeddingsCallCount++;
        if (embeddingsCallCount === 1) {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return { upsert: vi.fn().mockResolvedValue({ error: { message: "constraint violation" } }) };
      }
      return {};
    });

    await expect(indexDocument({ ...baseInput, buildGraph: false })).rejects.toThrow(
      /embeddings upsert failed/i
    );
  });

  it("throws when KG extraction fails", async () => {
    mockChunk.mockReturnValue(makeChunks(["chunk A"]));
    mockEmbed.mockResolvedValue([[0.1, 0.2]]);
    mockExtract.mockRejectedValue(new Error("LLM rate limit"));

    let embeddingsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        embeddingsCallCount++;
        if (embeddingsCallCount === 1) {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === "documents") {
        return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    await expect(
      indexDocument({ ...baseInput, buildGraph: true, rlsContext })
    ).rejects.toThrow(/KG pass failed/i);
  });

  // ── Lock handling ─────────────────────────────────────────

  it("releases lock even when an error is thrown mid-pipeline", async () => {
    mockChunk.mockReturnValue(makeChunks(["chunk A"]));
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: { message: "timeout" } }),
        };
      }
      return {};
    });

    await expect(indexDocument(baseInput)).rejects.toThrow();

    const releaseCalls = mockRpc.mock.calls.filter(
      (c: unknown[]) => c[0] === "release_document_lock"
    );
    expect(releaseCalls.length).toBe(1);
  });
});

// ─── sha256 utility ───────────────────────────────────────────

describe("sha256", () => {
  it("returns a 64-char hex string", () => {
    const result = sha256("hello");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(sha256("same input")).toBe(sha256("same input"));
  });

  it("differs for different inputs", () => {
    expect(sha256("input A")).not.toBe(sha256("input B"));
  });
});

// ─── reindexDocument ─────────────────────────────────────────

describe("reindexDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "acquire_document_lock") return Promise.resolve({ data: true, error: null });
      if (fn === "release_document_lock") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockCountTokens.mockReturnValue(10);
  });

  it("deletes existing graph entries before reindexing when rlsContext provided", async () => {
    mockDeleteByDocument.mockResolvedValue(undefined);
    mockChunk.mockReturnValue(makeChunks(["chunk A"]));
    mockEmbed.mockResolvedValue([[0.1, 0.2]]);
    mockExtract.mockResolvedValue({ nodes: [], edges: [] });

    let embeddingsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        embeddingsCallCount++;
        if (embeddingsCallCount === 1) {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === "documents") {
        return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    await reindexDocument({ ...baseInput, buildGraph: true, rlsContext });

    expect(mockDeleteByDocument).toHaveBeenCalledWith(rlsContext, "doc-1");
  });

  it("does not call deleteByDocument when buildGraph is false", async () => {
    mockChunk.mockReturnValue(makeChunks(["chunk A"]));
    mockEmbed.mockResolvedValue([[0.1, 0.2]]);

    let embeddingsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_embeddings") {
        embeddingsCallCount++;
        if (embeddingsCallCount === 1) {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === "documents") {
        return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    await reindexDocument({ ...baseInput, buildGraph: false, rlsContext });

    expect(mockDeleteByDocument).not.toHaveBeenCalled();
  });
});
