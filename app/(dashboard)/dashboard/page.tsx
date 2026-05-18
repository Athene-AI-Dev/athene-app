"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Cpu,
  Database,
  ChevronRight,
  Zap,
  Link2,
  MessageSquare,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- Shared UI Components ---

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

const GlassCard = ({ children, className = "" }: GlassCardProps) => (
  <div className={`bg-card/50 backdrop-blur-xl border border-border rounded-2xl shadow-xl transition-all duration-300 ${className}`}>
    {children}
  </div>
);

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  status?: string;
}

const MetricCard = ({ icon: Icon, label, value, status }: MetricCardProps) => (
  <GlassCard className="p-6 hover:border-primary/20 transition-all cursor-default group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 rounded-xl bg-primary/10 border border-primary/10 group-hover:bg-primary/20 transition-colors">
        <Icon size={22} className="text-primary" />
      </div>
      {status && (
        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">
          {status}
        </span>
      )}
    </div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-1 opacity-60">{label}</div>
    <div className="text-3xl font-black text-foreground tracking-tighter">{value}</div>
  </GlassCard>
);

// --- Dashboard Page ---

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ documents: 0, knowledge_nodes: 0, actions: 0, integrations: 0 });
  const [orchestrations, setOrchestrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard_stats");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setStats(data.stats);
      setOrchestrations(data.recent_orchestrations);
      setFetchError(null);
    } catch (error: any) {
      console.error("[dashboard] fetchStats failed:", error);
      setFetchError(error.message ?? "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-['Space_Grotesk'] transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-border shadow-lg">
              <Zap className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase">
              System <span className="text-primary">Overview</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl font-medium leading-relaxed">
            Real-time health monitoring of the Athene knowledge pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2 px-6 py-3 bg-muted/20 border border-border rounded-2xl cursor-default hover:bg-muted/40 transition-all shadow-sm">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[11px] font-black text-foreground uppercase tracking-widest">Pipeline Active</span>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Could not load stats: {fetchError}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStats}
            className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
          >
            Retry
          </Button>
        </div>
      )}

      {/* 4 metric cards — all from real API */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard icon={Database}  label="Indexed Documents"   value={`${stats.documents}`}       status="Indexed"    />
        <MetricCard icon={Cpu}       label="Knowledge Entities"  value={`${stats.knowledge_nodes}`} status="Networked"  />
        <MetricCard icon={Activity}  label="HITL Decisions"      value={`${stats.actions}`}         status="Audited"    />
        <MetricCard icon={Link2}     label="Active Connectors"   value={`${stats.integrations}`}    status="Live"       />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orchestrations — real HITL decisions from DB */}
        <div className="lg:col-span-2">
          <GlassCard className="p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Recent Agent Decisions</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin/audit-log')}
                className="text-[10px] text-muted-foreground hover:text-primary uppercase font-black tracking-widest transition-colors rounded-xl h-8 px-4"
              >
                View All →
              </Button>
            </div>
            <div className="space-y-4">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 rounded-[2rem] bg-muted/20 animate-pulse border border-border" />
                ))
              ) : orchestrations.length === 0 ? (
                <div className="py-8 text-center bg-muted/5 rounded-[2rem] border border-dashed border-border flex flex-col items-center justify-center">
                  <div className="w-12 h-12 mb-3 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm text-foreground font-bold">No agent decisions yet.</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">HITL approvals and rejections will appear here once an agent runs.</p>
                  <Button 
                    onClick={() => router.push('/chat')} 
                    className="h-9 px-5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm"
                  >
                    Deploy Your First Agent
                  </Button>
                </div>
              ) : (
                orchestrations.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => router.push('/admin/audit-log')}
                    className="flex items-center justify-between p-5 rounded-2xl bg-muted/10 border border-border hover:border-primary/20 hover:bg-muted/20 transition-all group cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center gap-5">
                      <div className="p-3 rounded-xl bg-background border border-border group-hover:border-primary/20 shadow-sm transition-colors">
                        <Activity size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <div className="text-base font-black text-foreground tracking-tight">{item.label}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                          ID: {item.id} · {new Date(item.time).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm",
                        item.status === 'Success' ? 'bg-accent/10 text-accent border border-accent/20' :
                        item.status === 'Failed'  ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                        item.status === 'Edited'  ? 'bg-secondary/10 text-secondary border border-secondary/20' :
                                                    'bg-primary/10 text-primary border border-primary/20'
                      )}>
                        {item.status}
                      </span>
                      <ChevronRight size={18} className="text-muted-foreground/30 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right column — real quick-action shortcuts */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <GlassCard className="p-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-muted-foreground">Quick Actions</h3>
            <div className="space-y-3">
              {[
                {
                  icon: MessageSquare,
                  label: "New Chat Session",
                  sub: "Ask Athene anything",
                  href: "/chat",
                },
                {
                  icon: Link2,
                  label: "Manage Connectors",
                  sub: `${stats.integrations} active`,
                  href: "/admin/integrations",
                },
                {
                  icon: Upload,
                  label: "Upload Files",
                  sub: `${stats.documents} docs indexed`,
                  href: "/files",
                },
              ].map((action) => (
                <button
                  key={action.href}
                  onClick={() => router.push(action.href)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-muted/10 border border-border hover:border-primary/20 hover:bg-muted/20 transition-all group text-left shadow-sm"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                    <action.icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-foreground uppercase tracking-tight">{action.label}</p>
                    <p className="text-[10px] text-muted-foreground/60 font-bold mt-0.5">{action.sub}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Pipeline status — derived from real stats */}
          <GlassCard className="p-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-muted-foreground">Pipeline Status</h3>
            <div className="space-y-4">
              {[
                {
                  label: "Document Index",
                  ok: stats.documents > 0,
                  detail: stats.documents > 0 ? `${stats.documents} docs` : "No docs indexed yet",
                },
                {
                  label: "Knowledge Graph",
                  ok: stats.knowledge_nodes > 0,
                  detail: stats.knowledge_nodes > 0 ? `${stats.knowledge_nodes} entities` : "Empty — index docs first",
                },
                {
                  label: "Connectors",
                  ok: stats.integrations > 0,
                  detail: stats.integrations > 0 ? `${stats.integrations} connected` : "No connectors active",
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      loading ? "bg-muted-foreground/20 animate-pulse" :
                      row.ok ? "bg-accent" : "bg-muted-foreground/30"
                    )} />
                    <span className="text-[11px] font-bold text-muted-foreground">{row.label}</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono font-bold tracking-tight",
                    row.ok ? "text-accent" : "text-muted-foreground/40"
                  )}>
                    {loading ? "—" : row.detail}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
