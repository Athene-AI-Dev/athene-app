"use client";

import { useState } from "react";
import { 
  Plus, 
  Play, 
  Save, 
  Settings2, 
  Database, 
  Cpu, 
  Search, 
  GitBranch, 
  Terminal,
  Layers,
  ChevronRight,
  MousePointer2,
  Trash2,
  Info,
  BrainCircuit,
  RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const INITIAL_NODES = [
  { id: 1, type: "Trigger", icon: Play, label: "On File Upload", pos: { x: 100, y: 150 }, color: "bg-emerald-500" },
  { id: 2, type: "Action", icon: Search, label: "Semantic Search", pos: { x: 350, y: 150 }, color: "bg-[#66ADE4]" },
  { id: 3, type: "Branch", icon: GitBranch, label: "Classification", pos: { x: 600, y: 150 }, color: "bg-amber-500" },
  { id: 4, type: "Terminal", icon: Terminal, label: "Synth Agent", pos: { x: 850, y: 150 }, color: "bg-[#66ADE4]" },
];

export default function BuilderPage() {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [isDeploying, setIsDeploying] = useState(false);

  const handleStoreConfig = async () => {
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Neural Pipeline " + new Date().toLocaleDateString(),
          config: nodes,
        }),
      });

      if (!res.ok) throw new Error("Failed to save configuration");

      toast.success("Configuration Stored", {
        description: "Pipeline configuration saved to cloud vault.",
      });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeployFleet = () => {
    setIsDeploying(true);
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 3000)),
      {
        loading: "Provisioning neural fleet nodes...",
        success: () => {
          setIsDeploying(false);
          return "Fleet deployed successfully";
        },
        error: "Deployment error",
      }
    );
  };

  const removeNode = (id: number) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    toast.error("Node removed from pipeline");
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-['Space_Grotesk'] transition-colors duration-300">
      {/* Builder Toolbar */}
      <header className="flex items-center justify-between bg-card/50 backdrop-blur-2xl p-6 rounded-[3rem] border border-border shadow-2xl">
        <div className="flex items-center gap-12 px-6">
          <div className="flex flex-col">
             <h2 className="text-lg font-black tracking-tighter text-foreground flex items-center gap-4 uppercase">
                Agent Workflow
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black h-5 px-3 tracking-widest uppercase">BETA</Badge>
             </h2>
             <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] mt-1 opacity-60">Intelligence Pipeline Editor</p>
          </div>
          <div className="h-12 w-px bg-border hidden md:block" />
          <div className="hidden md:flex items-center gap-4">
             <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95">
                <MousePointer2 className="w-6 h-6" />
             </Button>
             <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95">
                <Layers className="w-6 h-6" />
             </Button>
             <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95">
                <Settings2 className="w-6 h-6" />
             </Button>
          </div>
        </div>

        <div className="flex items-center gap-5 pr-4">
           <Button 
            onClick={handleStoreConfig}
            variant="outline" className="h-14 px-10 rounded-[1.5rem] border-border bg-muted/20 text-muted-foreground font-black uppercase tracking-widest text-[11px] gap-3 hover:bg-muted/50 hover:border-primary/40 transition-all active:scale-95">
              <Save className="w-5 h-5 text-primary" />
              Store Config
           </Button>
           <button 
            onClick={handleDeployFleet}
            disabled={isDeploying}
            className="h-14 px-12 rounded-[1.5rem] bg-gradient-to-r from-primary to-secondary text-primary-foreground font-black uppercase tracking-[0.2em] text-[11px] gap-4 shadow-2xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center relative overflow-visible group">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-[1.25rem] border-4 border-background bg-white flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
                 <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
              </div>
              <span className="ml-8 flex items-center gap-3">
                 {isDeploying ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-primary-foreground" />}
                 {isDeploying ? "Deploying..." : "Deploy Fleet"}
              </span>
           </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Components Panel */}
        <aside className="w-80 bg-card/50 backdrop-blur-2xl border border-border p-10 flex flex-col gap-12 rounded-[3.5rem] shadow-2xl">
           <div className="space-y-8">
              <h3 className="text-[10px] uppercase tracking-[0.4em] font-black text-muted-foreground">Logic Blocks</h3>
              <div className="grid grid-cols-1 gap-5">
                 {[
                    { label: "Trigger Node", icon: Play, color: "text-accent", bg: "bg-accent/10" },
                    { label: "AI Reasoning", icon: Cpu, color: "text-primary", bg: "bg-primary/10" },
                    { label: "Knowledge retrieval", icon: Database, color: "text-primary", bg: "bg-primary/10" },
                    { label: "Output Stream", icon: ChevronRight, color: "text-secondary", bg: "bg-secondary/10" },
                 ].map((comp, i) => (
                    <div 
                      key={i} 
                      onClick={() => toast(`Drafted ${comp.label}`)}
                      className="group p-6 rounded-[2rem] bg-muted/10 border border-border hover:border-primary/40 hover:bg-muted/30 hover:shadow-2xl hover:shadow-primary/5 cursor-grab active:cursor-grabbing transition-all flex items-center gap-6">
                       <div className={cn("p-4 rounded-xl shadow-lg border border-border group-hover:border-primary/20 transition-all", comp.bg, comp.color)}>
                          <comp.icon className="w-5 h-5" />
                       </div>
                       <span className="text-[14px] font-black text-muted-foreground group-hover:text-foreground uppercase tracking-tight transition-colors">{comp.label}</span>
                    </div>
                 ))}
              </div>
           </div>

           <div className="mt-auto p-8 rounded-[2rem] bg-primary/5 border border-primary/10 space-y-5 shadow-inner">
              <div className="flex items-center gap-3 text-primary">
                 <Info className="w-6 h-6" />
                 <span className="text-[11px] font-black uppercase tracking-[0.3em]">Builder Neural Logic</span>
              </div>
              <p className="text-[14px] text-muted-foreground leading-relaxed font-bold tracking-tight opacity-70">
                 Connect **Reasoning Nodes** to **Knowledge retrieval** for high-fidelity organizational synthesis.
              </p>
           </div>
        </aside>

        {/* Visual Flow Canvas */}
        <div className="flex-1 bg-muted/30 border border-border rounded-[4rem] relative overflow-hidden group/canvas shadow-2xl backdrop-blur-sm bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[length:40px_40px]">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
           
           {/* SVG Lines Connector (Static Mock) */}
           <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <path d="M 200 190 L 350 190" stroke="var(--border)" strokeWidth="3" fill="none" strokeDasharray="8 8" className="animate-pulse" />
              <path d="M 450 190 L 600 190" stroke="var(--primary)" strokeWidth="3" fill="none" strokeDasharray="8 8" className="opacity-40" />
              <path d="M 700 190 L 850 190" stroke="var(--primary)" strokeWidth="3" fill="none" strokeDasharray="8 8" className="opacity-40" />
           </svg>

           {/* Nodes */}
           {nodes.map((node) => (
              <div 
                key={node.id}
                className="absolute p-8 rounded-[2.5rem] bg-card/90 backdrop-blur-3xl border border-border w-64 group/node hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-all cursor-move active:scale-95 shadow-2xl"
                style={{ left: node.pos.x, top: node.pos.y }}
              >
                <div className="flex items-center justify-between mb-6">
                   <div className={cn("p-4 rounded-2xl text-primary-foreground shadow-2xl transition-transform group-hover/node:rotate-12 group-hover/node:scale-110", node.color.replace('bg-', 'bg-').replace('500', '600'))}>
                      <node.icon className="w-6 h-6" />
                   </div>
                   <Badge variant="ghost" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">{node.type}</Badge>
                </div>
                <h4 className="text-xl font-black text-foreground mb-2 uppercase tracking-tighter">{node.label}</h4>
                <div className="flex items-center gap-3">
                   <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                   <span className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Neural Active</span>
                </div>

                {/* Ports */}
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-[3px] border-primary group-hover/node:scale-125 transition-all shadow-2xl" />
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-[3px] border-primary group-hover/node:scale-125 transition-all shadow-2xl" />
              </div>
           ))}
        </div>

        {/* Properties Panel */}
        <aside className="w-80 bg-card/50 backdrop-blur-2xl border border-border p-12 flex flex-col gap-10 rounded-[3.5rem] shadow-2xl">
           <div className="space-y-8">
              <h3 className="text-[10px] uppercase tracking-[0.4em] font-black text-muted-foreground">Node Synthesis</h3>
              <div className="p-8 rounded-[2rem] bg-muted/10 border border-border space-y-8 shadow-inner">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 px-2">Pipeline Label</label>
                    <input defaultValue="Semantic Search" className="w-full h-14 bg-muted/20 border border-border rounded-2xl px-6 text-foreground text-sm font-black focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all uppercase tracking-tight" />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 px-2">Core Logic Engine</label>
                    <div className="w-full flex items-center justify-between h-14 px-6 bg-primary/10 text-primary border border-primary/20 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-sm">
                       GPT-4o Reasoning
                       <BrainCircuit className="w-5 h-5" />
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <h3 className="text-[10px] uppercase tracking-[0.4em] font-black text-muted-foreground">Execution Guard</h3>
              <div className="space-y-4">
                 {[
                    { label: "Strict Typing", active: true },
                    { label: "Entity Masking", active: true },
                    { label: "Retrieval Audit", active: false },
                 ].map((guard, i) => (
                    <div key={i} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-muted/10 border border-border hover:border-primary/30 transition-all group">
                       <span className="text-[12px] font-black text-muted-foreground uppercase tracking-tight group-hover:text-foreground">{guard.label}</span>
                       <div className={cn("h-6 w-12 rounded-full relative transition-all duration-500 shadow-inner", guard.active ? 'bg-primary' : 'bg-muted')}>
                          <div className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-md", guard.active ? 'right-1' : 'left-1')} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <Button 
            onClick={() => removeNode(nodes[nodes.length - 1]?.id)}
            variant="outline" className="mt-auto h-16 w-full rounded-[2rem] border-border text-destructive hover:bg-destructive/10 hover:border-destructive/20 font-black uppercase tracking-[0.3em] text-[10px] gap-3 transition-all active:scale-95">
              <Trash2 className="w-5 h-5" />
              Deconstruct Block
           </Button>
        </aside>
      </div>
    </div>

  );
}
