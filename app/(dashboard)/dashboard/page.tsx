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

// --- Shared UI Components ---

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

const GlassCard = ({ children, className = "" }: GlassCardProps) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl ${className}`}>
    {children}
  </div>
);

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  status?: string;
  accent?: "blue" | "pink";
}

const MetricCard = ({ icon: Icon, label, value, status }: MetricCardProps) => {
  const accentColor = "text-[#66ADE4]";
  const bgColor = "bg-[#66ADE4]/10";
  
  return (
    <GlassCard className="p-6 hover:border-white/20 transition-all cursor-default">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon size={20} className={accentColor} />
        </div>
        {status && (
          <span className={`text-[10px] font-bold uppercase tracking-widest ${accentColor}`}>
            {status}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
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
    <div className="p-8 font-['Space_Grotesk']">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">System Overview</h2>
          <p className="text-slate-400 text-sm">Real-time health monitoring of the AtheneAI neural grid.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-[#66ADE4]/10 border border-[#66ADE4]/30 rounded-full cursor-help hover:bg-[#66ADE4]/20 transition-all">
          <div className="w-1.5 h-1.5 rounded-full bg-[#66ADE4] animate-pulse" />
          <span className="text-[10px] font-bold text-[#66ADE4] uppercase tracking-widest">Network Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard icon={Database} label="Knowledge Depth" value={`${stats.documents} Docs`} status="Indexed" />
        <MetricCard icon={Cpu} label="Neural Entities" value={`${stats.knowledge_nodes}`} status="Networked" />
        <MetricCard icon={Activity} label="Agent Decisiveness" value={`${stats.actions} HITL`} status="Audited" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Recent Orchestrations</h3>
              <button 
                onClick={handleViewAll}
                className="text-[10px] text-slate-500 hover:text-[#66ADE4] uppercase font-bold transition-colors">View All</button>
            </div>
            <div className="space-y-4">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                ))
              ) : orchestrations.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No recent orchestrations found.</p>
              ) : (
                orchestrations.map((item, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleOrchestrationClick(item.label)}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                        <CpuIcon size={18} className="text-slate-400 group-hover:text-[#66ADE4]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold">{item.label}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                          ID: {item.id} • {new Date(item.time).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest ${
                        item.status === 'Success' ? 'bg-green-500/10 text-green-400' : 
                        item.status === 'Failed' ? 'bg-red-500/10 text-red-400' : 'bg-[#66ADE4]/10 text-[#66ADE4]'
                      }`}>
                        {item.status}
                      </span>
                      <ChevronRight size={16} className="text-slate-600" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard className="p-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-6">Active Nodes</h3>
            <div className="space-y-4">
              {[
                { name: "North America West", latency: `${latencies[0].toFixed(1)}ms`, active: true },
                { name: "Europe Central", latency: `${latencies[1].toFixed(1)}ms`, active: true },
                { name: "Asia Southeast", latency: `${latencies[2].toFixed(1)}ms`, active: true },
                { name: "South America", latency: "Offline", active: false },
              ].map((node, i) => (
                <div key={i} className="flex justify-between items-center group cursor-help">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${node.active ? 'bg-[#66ADE4]' : 'bg-slate-700'} group-hover:scale-150 transition-all`} />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{node.name}</span>
                  </div>
                  <span className={`text-[10px] font-mono ${node.active ? 'text-slate-400' : 'text-slate-600'}`}>{node.latency}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <GlassCard className="p-6 relative">
                <div className="space-y-4 mb-6">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resource Synthesis</span>
                      <span className="text-[10px] font-mono text-[#66ADE4]">72%</span>
                   </div>
                   <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] rounded-full" style={{ width: '72%' }} />
                   </div>
                </div>
                <div className="flex items-center gap-4 text-[#66ADE4]">
                   <Zap size={24} />
                   <p className="text-sm leading-relaxed italic">
                     "System health is optimal. The neural grid is currently self-optimizing for peak efficiency across all sectors."
                   </p>
                </div>
            </GlassCard>
            <div 
              onClick={handlePlusClick}
              className="absolute -bottom-4 -right-4 w-12 h-12 bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 cursor-pointer hover:scale-110 transition-transform active:scale-95 border-2 border-[#06080c] overflow-hidden">
               <img src="/logo.png" alt="A" className="w-6 h-6 object-contain" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
