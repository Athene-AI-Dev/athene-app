"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Cpu, 
  Clock, 
  Cpu as CpuIcon, 
  Database,
  ChevronRight,
  Plus,
  Zap
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
  accent?: "primary" | "secondary";
}

const MetricCard = ({ icon: Icon, label, value, status }: MetricCardProps) => {
  return (
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
};

// --- Command Center Content ---

export default function DashboardPage() {
  const [latencies, setLatencies] = useState([2.4, 18.1, 42.5]);
  const [stats, setStats] = useState({ documents: 0, knowledge_nodes: 0, actions: 0, integrations: 0 });
  const [orchestrations, setOrchestrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard_stats");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      const data = await res.json();
      setStats(data.stats);
      setOrchestrations(data.recent_orchestrations);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh stats every 30s
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Update Latencies
      setLatencies(prev => prev.map(l => {
        const delta = (Math.random() - 0.5) * 1.5;
        return Math.max(1.0, l + delta);
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleViewAll = () => {
    toast("Navigating to full orchestration history...");
  };

  const handlePlusClick = () => {
    toast.info("Initializing New Sector Node", {
      description: "Allocating neural resources for expansion.",
    });
  };

  const handleOrchestrationClick = (label: string) => {
    toast.success(`Accessing ${label}`, {
      description: "Retrieving full execution trace from Data Vault.",
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-['Space_Grotesk'] transition-colors duration-300">
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
            Real-time health monitoring of the AtheneAI neural grid.
          </p>
        </div>
        <div className="flex items-center gap-2 px-6 py-3 bg-muted/20 border border-border rounded-2xl cursor-help hover:bg-muted/40 transition-all shadow-sm">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[11px] font-black text-foreground uppercase tracking-widest">Neural Grid Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard icon={Database} label="Knowledge Depth" value={`${stats.documents} Docs`} status="Indexed" />
        <MetricCard icon={Cpu} label="Neural Entities" value={`${stats.knowledge_nodes}`} status="Networked" />
        <MetricCard icon={Activity} label="Agent Decisiveness" value={`${stats.actions} HITL`} status="Audited" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard className="p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Recent Orchestrations</h3>
              <Button 
                variant="ghost"
                size="sm"
                onClick={handleViewAll}
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
                <div className="py-12 text-center bg-muted/5 rounded-[2rem] border border-dashed border-border">
                  <p className="text-sm text-muted-foreground font-bold">No recent orchestrations found.</p>
                </div>
              ) : (
                orchestrations.map((item, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleOrchestrationClick(item.label)}
                    className="flex items-center justify-between p-5 rounded-2xl bg-muted/10 border border-border hover:border-primary/20 hover:bg-muted/20 transition-all group cursor-pointer shadow-sm">
                    <div className="flex items-center gap-5">
                      <div className="p-3 rounded-xl bg-background border border-border group-hover:border-primary/20 shadow-sm transition-colors">
                        <CpuIcon size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <div className="text-base font-black text-foreground tracking-tight">{item.label}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                          ID: {item.id} • {new Date(item.time).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm",
                        item.status === 'Success' ? 'bg-accent/10 text-accent border border-accent/20' : 
                        item.status === 'Failed' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 
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

        <div className="space-y-6">
          <GlassCard className="p-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-8 text-muted-foreground">Active Nodes</h3>
            <div className="space-y-6">
              {[
                { name: "North America West", latency: `${latencies[0].toFixed(1)}ms`, active: true },
                { name: "Europe Central", latency: `${latencies[1].toFixed(1)}ms`, active: true },
                { name: "Asia Southeast", latency: `${latencies[2].toFixed(1)}ms`, active: true },
                { name: "South America", latency: "Offline", active: false },
              ].map((node, i) => (
                <div key={i} className="flex justify-between items-center group cursor-help">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-2 h-2 rounded-full transition-all group-hover:scale-150",
                      node.active ? 'bg-primary' : 'bg-muted-foreground/20'
                    )} />
                    <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">{node.name}</span>
                  </div>
                  <span className={cn(
                    "text-[11px] font-mono font-bold tracking-tight",
                    node.active ? 'text-primary' : 'text-muted-foreground/40'
                  )}>{node.latency}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-3xl blur-lg opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <GlassCard className="p-8 relative bg-card/80">
                <div className="space-y-4 mb-8">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Resource Synthesis</span>
                      <span className="text-[11px] font-mono font-black text-primary">72%</span>
                   </div>
                   <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style={{ width: '72%' }} />
                   </div>
                </div>
                <div className="flex items-start gap-5 text-primary">
                   <Zap size={28} className="shrink-0 mt-1" />
                   <p className="text-sm leading-relaxed font-medium italic text-muted-foreground/80">
                     "System health is optimal. The neural grid is currently self-optimizing for peak efficiency across all sectors."
                   </p>
                </div>
            </GlassCard>
            <div 
              onClick={handlePlusClick}
              className="absolute -bottom-4 -right-4 w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 cursor-pointer hover:scale-110 transition-all active:scale-95 border-4 border-background overflow-hidden z-10">
               <img src="/logo.png" alt="A" className="w-7 h-7 object-contain" />
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}
