"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Network, Search, Loader2 } from "lucide-react";
import { ENTITY_COLORS, type EntityColorKey } from "@/components/graph/knowledge-graph-canvas";

// Lazy-load the canvas to avoid SSR issues with React Flow
const KnowledgeGraphCanvas = dynamic(
  () =>
    import("@/components/graph/knowledge-graph-canvas").then(
      (mod) => mod.KnowledgeGraphCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="graph-loading" id="graph-loading-ssr">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Loading graph canvas…</p>
      </div>
    ),
  }
);

// ── Mobile list view ────────────────────────────────────────
interface MobileNode {
  id: string;
  label: string;
  entity_type: string;
  description?: string | null;
  community?: string;
}

function MobileGraphList() {
  const [nodes, setNodes] = useState<MobileNode[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const url = search
          ? `/api/graph/nodes?search=${encodeURIComponent(search)}&limit=50`
          : `/api/graph/nodes?limit=50`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setNodes(data.nodes ?? []);
      } catch {
        setNodes([]);
      } finally {
        setIsLoading(false);
      }
    }
    setIsLoading(true);
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="graph-mobile" id="graph-mobile-view">
      <div className="graph-mobile__search">
        <Search className="h-4 w-4" />
        <input
          type="text"
          placeholder="Search nodes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="graph-mobile__search-input"
          id="mobile-graph-search"
        />
      </div>

      {isLoading ? (
        <div className="graph-mobile__loading">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="graph-mobile__empty">
          <Network className="h-10 w-10 opacity-30" />
          <p>No nodes found</p>
        </div>
      ) : (
        <ul className="graph-mobile__list">
          {nodes.map((n) => (
            <li key={n.id} className="graph-mobile__item">
              <div
                className="graph-mobile__item-dot"
                style={{
                  backgroundColor:
                    ENTITY_COLORS[n.entity_type as EntityColorKey] ??
                    ENTITY_COLORS.concept,
                }}
              />
              <div className="graph-mobile__item-content">
                <span className="graph-mobile__item-label">{n.label}</span>
                <span className="graph-mobile__item-type">{n.entity_type}</span>
                {n.description && (
                  <p className="graph-mobile__item-desc">
                    {n.description.slice(0, 120)}
                    {n.description.length > 120 ? "…" : ""}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Page Component ──────────────────────────────────────────
export default function GraphPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [userRole, setUserRole] = useState("member");

  useEffect(() => {
    // Check screen width
    const mql = window.matchMedia("(max-width: 768px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);

    // Fetch user role from the nodes endpoint (piggyback)
    fetch("/api/graph/nodes?limit=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.role) setUserRole(d.role);
      })
      .catch(() => {});

    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <div id="graph-page">
      {/* Page Header */}
      <div className="graph-page__header">
        <div>
          <h1 className="graph-page__title">
            <Network className="h-7 w-7 inline-block mr-2 text-purple-400" />
            Knowledge Graph
          </h1>
          <p className="graph-page__subtitle">
            Interactive map of your organization&apos;s connected knowledge
          </p>
        </div>
      </div>

      {/* Canvas or mobile list */}
      {isMobile ? (
        <MobileGraphList />
      ) : (
        <KnowledgeGraphCanvas userRole={userRole} />
      )}
    </div>
  );
}
