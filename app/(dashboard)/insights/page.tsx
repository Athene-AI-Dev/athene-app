"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  Plus,
  Search,
  AlertCircle,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InsightCard, type Insight } from "@/components/insights/insight-card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Inline "Add Insight" dialog — same pattern as ConfirmDialog in integrations
// ---------------------------------------------------------------------------
function AddInsightDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, query: string) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) { setTitle(""); setQuery(""); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-card border border-white/10 shadow-2xl p-8 max-w-lg w-full mx-4 rounded-[2rem] animate-in zoom-in-95 duration-300 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#D96FAB]/10 to-[#7AADCF]/10 border border-white/5 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#D96FAB]" />
              </div>
              <h3 className="text-xl font-black text-foreground tracking-tight">New Insight Card</h3>
            </div>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              Save a BI query and its synthesized answer as a reusable card.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/5 shrink-0">
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="insight-title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              Card Title
            </label>
            <input
              id="insight-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Revenue vs Headcount"
              className="w-full h-12 px-4 rounded-2xl bg-background border border-white/10 text-sm font-medium text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-[#D96FAB]/40 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="insight-query" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              Analysis Query
            </label>
            <textarea
              id="insight-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What is the correlation between headcount growth and revenue per department in Q3?"
              rows={4}
              className="w-full px-4 py-3 rounded-2xl bg-background border border-white/10 text-sm font-medium text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-[#7AADCF]/40 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border-white/10 hover:bg-white/5 font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(title, query)}
            disabled={submitting || !title.trim() || !query.trim()}
            className="flex-[2] h-12 rounded-xl bg-[#D96FAB] hover:bg-[#ECA8CC] text-white font-black uppercase tracking-widest text-[11px] gap-2 shadow-xl shadow-pink-500/10"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? "Saving..." : "Save Card"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/insights");
      if (res.status === 401 || res.status === 403) {
        setError("You don't have permission to view BI Insights.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Insight[] = await res.json();
      setInsights(data);
      setError(null);
    } catch (e: any) {
      setError("Failed to load insights. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleAdd = async (title: string, query: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, query }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const newCard: Insight = await res.json();
      setInsights((prev) => [newCard, ...prev]);
      setShowAdd(false);
      showToast("Insight card saved.", "success");
    } catch (e: any) {
      showToast(`Failed to save: ${e.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async (id: string) => {
    try {
      const res = await fetch("/api/insights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, refresh: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: Insight = await res.json();
      setInsights((prev) => prev.map((c) => (c.id === id ? updated : c)));
      showToast("Card refreshed.", "success");
    } catch (e: any) {
      showToast(`Refresh failed: ${e.message}`, "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/insights?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInsights((prev) => prev.filter((c) => c.id !== id));
      showToast("Card removed.", "success");
    } catch (e: any) {
      showToast(`Delete failed: ${e.message}`, "error");
    }
  };

  const filtered = insights.filter(
    (i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.query.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {toast && (
        <div
          className={cn(
            "fixed bottom-10 right-10 z-[100] flex items-center gap-4 px-6 py-4 rounded-2xl border shadow-2xl animate-in slide-in-from-right-10 duration-500",
            toast.type === "success"
              ? "bg-[#EEF6FC] border-[#7AADCF]/30 text-[#5290B8]"
              : "bg-red-50 border-red-200 text-red-800"
          )}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold text-sm">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <AddInsightDialog open={showAdd} onClose={() => setShowAdd(false)} onSubmit={handleAdd} submitting={submitting} />

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#D96FAB]/10 to-[#7AADCF]/10 border border-white/5">
              <BarChart3 className="w-7 h-7 text-[#D96FAB]" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-foreground">
              BI <span className="text-gradient">Insights</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl font-medium leading-relaxed">
            Saved intelligence cards with synthesized answers from your connected knowledge sources. Visible to admins and BI analysts.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4 hidden sm:flex">
            <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/40 mb-1">Cards</span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/20 border border-white/5">
              <div className="h-2 w-2 rounded-full bg-[#D96FAB] animate-pulse" />
              <span className="text-xs font-bold text-foreground">{insights.length} Active</span>
            </div>
          </div>
          <Button
            onClick={() => setShowAdd(true)}
            className="h-14 px-8 rounded-2xl bg-[#D96FAB] hover:bg-[#ECA8CC] text-white font-black uppercase tracking-widest text-[11px] gap-3 shadow-xl shadow-pink-500/10 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            New Card
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center p-2 rounded-2xl bg-accent/10 border border-white/5">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-[#D96FAB]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards by title or query..."
            className="w-full h-12 pl-12 pr-4 bg-transparent outline-none text-sm font-medium placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-72 rounded-[2.5rem] bg-accent/10 border border-white/5 animate-pulse" />
          ))
        ) : error ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto opacity-20" />
            <p className="text-muted-foreground font-bold">{error}</p>
            <Button variant="outline" onClick={fetchInsights} className="rounded-xl border-white/10">Try Again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center bg-accent/5 rounded-[3rem] border-2 border-dashed border-white/5 text-center">
            <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center mb-6">
              <BarChart3 className="w-10 h-10 text-muted-foreground/20" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-2">
              {search ? "No matching cards" : "No Insight Cards Yet"}
            </h3>
            <p className="text-muted-foreground max-w-sm font-medium">
              {search ? "Try a different search term." : "Create your first BI insight card to start tracking cross-department metrics."}
            </p>
            {!search && (
              <Button onClick={() => setShowAdd(true)} className="mt-8 h-12 px-8 rounded-xl bg-[#D96FAB] hover:bg-[#ECA8CC] text-white font-bold">
                Create First Card
              </Button>
            )}
          </div>
        ) : (
          filtered.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              currentMemberId={null}
              isAdmin={true}
              onRefresh={handleRefresh}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
