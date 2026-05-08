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
export async function detectCommunities(orgId: string): Promise<void> {
  // 1. Load all node IDs
  const { data: nodes, error: nodeErr } = await supabaseAdmin
    .from('kg_nodes')
    .select('id')
    .eq('org_id', orgId)

  if (nodeErr) throw new Error(`[community] Failed to load nodes: ${nodeErr.message}`)
  if (!nodes || nodes.length === 0) return

  // 2. Load all edges
  const { data: edges, error: edgeErr } = await supabaseAdmin
    .from('kg_edges')
    .select('source_node, target_node')
    .eq('org_id', orgId)

  if (edgeErr) throw new Error(`[community] Failed to load edges: ${edgeErr.message}`)

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

  // 5. Map root UUIDs to sequential numbers (1, 2, 3...)
  const rootToId = new Map<string, number>()
  let nextId = 1
  for (const communityId of assignments.values()) {
    if (!rootToId.has(communityId)) {
      rootToId.set(communityId, nextId++)
    }
  }

  // 6. Group nodes by their numeric community ID
  const byCommunity = new Map<number, string[]>()
  for (const [nodeId, rootId] of assignments) {
    const numericId = rootToId.get(rootId)!
    if (!byCommunity.has(numericId)) byCommunity.set(numericId, [])
    byCommunity.get(numericId)!.push(nodeId)
  }

  // 7. Update kg_nodes.community in batches per community
  const batchSize = 100
  for (const [numericId, memberIds] of byCommunity) {
    for (let i = 0; i < memberIds.length; i += batchSize) {
      const batch = memberIds.slice(i, i + batchSize)
      const { error } = await supabaseAdmin
        .from('kg_nodes')
        .update({ community: numericId })
        .eq('org_id', orgId)
        .in('id', batch)

      if (error) {
        console.error(`[community] Update failed for community ${numericId}:`, error.message)
      }
    }
  }
}
