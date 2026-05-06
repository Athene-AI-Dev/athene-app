"use client";

import { useState } from "react";
import { RefreshCw, Trash2, Clock, Quote, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Insight {
  id: string;
  title: string;
  query: string;
  result: { answer: string; citations: { title: string | null; url?: string | null }[] };
  created_by: string;
  refreshed_at: string;
  created_at: string;
}

interface InsightCardProps {
  insight: Insight;
  currentMemberId: string | null;
  isAdmin: boolean;
  onRefresh: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function InsightCard({ insight, currentMemberId, isAdmin, onRefresh, onDelete }: InsightCardProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = isAdmin || insight.created_by === currentMemberId;

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh(insight.id); } finally { setRefreshing(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(insight.id); } finally { setDeleting(false); }
  };

  return (
    <div className="group relative rounded-[2.5rem] bg-card border border-white/5 p-8 flex flex-col gap-6 transition-all duration-500 hover:scale-[1.02] hover:border-white/10 hover:shadow-2xl hover:shadow-[#D96FAB]/5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 h-10 w-10 rounded-2xl bg-gradient-to-br from-[#D96FAB]/10 to-[#7AADCF]/10 border border-white/5 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#D96FAB]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-foreground tracking-tight truncate group-hover:text-[#D96FAB] transition-colors">
              {insight.title}
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              Intelligence Card
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 w-9 rounded-xl text-muted-foreground/40 hover:bg-[#7AADCF]/10 hover:text-[#7AADCF] transition-all"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
              className="h-9 w-9 rounded-xl text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Answer */}
      <div className="flex-1 space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Answer</span>
        <p className="text-sm font-medium text-foreground/80 leading-relaxed line-clamp-4">
          {insight.result.answer}
        </p>
      </div>

      {/* Query chip */}
      <div className="p-3 rounded-2xl bg-accent/10 border border-white/5">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 block mb-1">Query</span>
        <p className="text-xs font-medium text-muted-foreground truncate">{insight.query}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(insight.refreshed_at)}</span>
        </div>
        {insight.result.citations.length > 0 && (
          <Badge className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-[#7AADCF]/10 text-[#7AADCF] border-[#7AADCF]/20">
            {insight.result.citations.length} sources
          </Badge>
        )}
      </div>
    </div>
  );
}
