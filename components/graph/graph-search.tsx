"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";

interface GraphSearchProps {
  onSearchResults: (nodeIds: string[]) => void;
  onClear: () => void;
}

export function GraphSearch({ onSearchResults, onClear }: GraphSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevQueryRef = useRef("");

  // FIX #2: Stable refs for callbacks to prevent stale closures
  const onSearchResultsRef = useRef(onSearchResults);
  const onClearRef = useRef(onClear);
  useEffect(() => {
    onSearchResultsRef.current = onSearchResults;
    onClearRef.current = onClear;
  }, [onSearchResults, onClear]);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        onClearRef.current();
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/graph/nodes?search=${encodeURIComponent(searchQuery)}&limit=50`
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        // FIX #1: Typed node map instead of `any`
        const ids = (data.nodes ?? []).map((n: { id: string }) => n.id);
        onSearchResultsRef.current(ids);
      } catch (err) {
        // FIX #4: Log errors instead of swallowing
        console.error("[GraphSearch] Search failed:", err);
        onSearchResultsRef.current([]);
      } finally {
        setIsSearching(false);
      }
    },
    [] // FIX #2: Empty deps — reads from refs
  );

  // FIX #3: Memoized handlers
  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // FIX #6: Skip if query hasn't actually changed
        if (value === prevQueryRef.current) return;
        prevQueryRef.current = value;
        performSearch(value);
      }, 300);
    },
    [performSearch]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    prevQueryRef.current = "";
    onClearRef.current();
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="graph-search">
      <div className="graph-search__icon">
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </div>
      {/* FIX #5: Added aria attributes for accessibility */}
      <input
        id="graph-search-input"
        type="text"
        role="searchbox"
        aria-label="Search knowledge graph nodes"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search nodes…"
        className="graph-search__input"
      />
      {query && (
        <button
          onClick={handleClear}
          className="graph-search__clear"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
