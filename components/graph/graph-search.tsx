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

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        onClear();
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/graph/nodes?search=${encodeURIComponent(searchQuery)}&limit=50`
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        const ids = (data.nodes ?? []).map((n: any) => n.id);
        onSearchResults(ids);
      } catch {
        onSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearchResults, onClear]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  const handleClear = () => {
    setQuery("");
    onClear();
  };

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
      <input
        id="graph-search-input"
        type="text"
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
