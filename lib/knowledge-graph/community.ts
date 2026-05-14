// ============================================================
// knowledge-graph/community.ts — Community detection (ATH-60)
//
// After all documents are processed, run a connected-components
// pass to assign community IDs to kg_nodes.
//
// Algorithm: union-find (disjoint sets) over kg_edges.
// Nodes in the same connected component get the same community ID.
// Community IDs are stable strings (lowest node ID in the group).
//
// Written as a service-role operation — bypasses RLS since it
// reads/writes across the full org graph.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const PAGE_SIZE = 5_000

// ---- Union-Find ---------------------------------------------

class UnionFind {
  private parent: Map<string, string> = new Map()

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    
    let curr = x
    const path: string[] = []
    
    // Iterative find with path compression
    while (this.parent.get(curr) !== curr) {
      path.push(curr)
      curr = this.parent.get(curr)!
    }
    
    for (const node of path) {
      this.parent.set(node, curr)
    }
    
    return curr
  }

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) {
      // Deterministic: always attach higher to lower so community ID = min node ID (lexicographic)
      if (ra < rb) {
        this.parent.set(rb, ra)
      } else {
        this.parent.set(ra, rb)
      }
    }
  }

  getRoots(): Map<string, string> {
    const roots = new Map<string, string>()
    for (const id of this.parent.keys()) {
      roots.set(id, this.find(id))
    }
    return roots
  }
}

// ---- Main function ------------------------------------------

/**
 * Assigns community IDs to all kg_nodes for the given org.
 * Runs a connected-components pass over kg_edges.
 * Each node gets community = root node ID of its component.
 */
async function paginateNodes(orgId: string): Promise<{ id: string }[]> {
  const results: { id: string }[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('kg_nodes').select('id').eq('org_id', orgId)
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`[community] Failed to load nodes: ${error.message}`)
    if (!data || data.length === 0) break
    results.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return results
}

async function paginateEdges(orgId: string): Promise<{ source_node: string; target_node: string }[]> {
  const results: { source_node: string; target_node: string }[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('kg_edges').select('source_node, target_node').eq('org_id', orgId)
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`[community] Failed to load edges: ${error.message}`)
    if (!data || data.length === 0) break
    results.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return results
}

export async function detectCommunities(orgId: string): Promise<void> {
  // 1. Load all node IDs (paginated — unbounded load OOMs on large orgs)
  const nodes = await paginateNodes(orgId)

  if (nodes.length === 0) return
  logger.info({ orgId, nodeCount: nodes.length }, '[community] Loaded nodes — starting union-find')

  // 2. Load all edges (paginated)
  const edges = await paginateEdges(orgId)

  // 3. Build union-find from edges
  const uf = new UnionFind()

  // Initialise all node IDs
  for (const row of nodes) {
    uf.find(row.id) // initialises parent[id] = id
  }

  // Union connected nodes
  for (const edge of edges ?? []) {
    uf.union(edge.source_node, edge.target_node)
  }

  // 4. Build community assignment map: nodeId → communityId
  const assignments = uf.getRoots()

  // 5. Group nodes by community for batch updates
  const byCommunity = new Map<string, string[]>()
  for (const [nodeId, communityId] of assignments) {
    if (!byCommunity.has(communityId)) byCommunity.set(communityId, [])
    byCommunity.get(communityId)!.push(nodeId)
  }

  // 6. Update kg_nodes.community in batches per community
  const batchSize = 100
  for (const [communityId, memberIds] of byCommunity) {
    for (let i = 0; i < memberIds.length; i += batchSize) {
      const batch = memberIds.slice(i, i + batchSize)
      const { error } = await supabaseAdmin
        .from('kg_nodes')
        .update({ community: communityId })
        .eq('org_id', orgId)
        .in('id', batch)

      if (error) {
        logger.error({ orgId, communityId, err: error.message }, '[community] Update failed')
      }
    }
  }
}
