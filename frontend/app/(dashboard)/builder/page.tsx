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

const INITIAL_NODES = [
  { id: 1, type: "Trigger", icon: Play, label: "On File Upload", pos: { x: 100, y: 150 }, color: "bg-emerald-500" },
  { id: 2, type: "Action", icon: Search, label: "Semantic Search", pos: { x: 350, y: 150 }, color: "bg-[#66ADE4]" },
  { id: 3, type: "Branch", icon: GitBranch, label: "Classification", pos: { x: 600, y: 150 }, color: "bg-amber-500" },
  { id: 4, type: "Terminal", icon: Terminal, label: "Synth Agent", pos: { x: 850, y: 150 }, color: "bg-[#66ADE4]" },
];

export default function BuilderPage() {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [isDeploying, setIsDeploying] = useState(false);

  const handleStoreConfig = () => {
    toast.success("Configuration Stored", {
      description: "Pipeline #ATH-FLOW-88 saved to cloud vault.",
    });
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
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6 animate-in fade-in duration-700">
      {/* Builder Toolbar */}
      <header className="flex items-center justify-between bg-white/5 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 shadow-sm">
        <div className="flex items-center gap-10 px-4">
          <div className="flex flex-col">
             <h2 className="text-base font-black tracking-tight text-white flex items-center gap-3">
                Agent Workflow
                <Badge className="bg-[#66ADE4]/10 text-[#66ADE4] border-none text-[10px] font-bold h-5 px-2">BETA</Badge>
             </h2>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Intelligence Pipeline Editor</p>
          </div>
          <div className="h-10 w-px bg-white/10 hidden md:block" />
          <div className="hidden md:flex items-center gap-2">
             <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-[#66ADE4]/10 hover:text-[#66ADE4] transition-all">
                <MousePointer2 className="w-5 h-5" />
             </Button>
             <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-[#66ADE4]/10 hover:text-[#66ADE4] transition-all">
                <Layers className="w-5 h-5" />
             </Button>
             <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-[#66ADE4]/10 hover:text-[#66ADE4] transition-all">
                <Settings2 className="w-5 h-5" />
             </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 pr-2">
           <Button 
            onClick={handleStoreConfig}
            variant="outline" className="h-12 px-8 rounded-xl border-white/10 text-slate-400 font-bold uppercase tracking-widest text-[10px] gap-2 hover:bg-white/5">
              <Save className="w-4 h-4 text-[#66ADE4]" />
              Store Config
           </Button>
           <button 
            onClick={handleDeployFleet}
            disabled={isDeploying}
            className="h-12 px-10 rounded-xl bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] text-white font-bold uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-blue-500/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center relative overflow-visible">
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-[#06080c] bg-white flex items-center justify-center shadow-lg">
                 <img src="/logo.png" alt="Logo" className="w-4 h-4 object-contain" />
              </div>
              <span className="ml-4">
                 {isDeploying ? <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> : <Play className="w-4 h-4 fill-white inline mr-2" />}
                 {isDeploying ? "Deploying..." : "Deploy Fleet"}
              </span>
           </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Components Panel */}
        <aside className="w-80 bg-white/5 backdrop-blur-xl border border-white/10 p-8 flex flex-col gap-10 rounded-[2.5rem]">
           <div className="space-y-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500">Logic Blocks</h3>
              <div className="grid grid-cols-1 gap-4">
                 {[
                    { label: "Trigger Node", icon: Play, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                    { label: "AI Reasoning", icon: Cpu, color: "text-[#66ADE4]", bg: "bg-[#66ADE4]/10" },
                    { label: "Knowledge retrieval", icon: Database, color: "text-[#66ADE4]", bg: "bg-[#66ADE4]/10" },
                    { label: "Output Stream", icon: ChevronRight, color: "text-amber-400", bg: "bg-amber-400/10" },
                 ].map((comp, i) => (
                    <div 
                      key={i} 
                      onClick={() => toast(`Drafted ${comp.label}`)}
                      className="group p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-[#66ADE4]/30 hover:bg-white/10 hover:shadow-md cursor-grab active:cursor-grabbing transition-all flex items-center gap-5">
                       <div className={`p-3 rounded-xl shadow-sm ${comp.bg} ${comp.color}`}>
                          <comp.icon className="w-5 h-5" />
                       </div>
                       <span className="text-[14px] font-bold text-slate-400 group-hover:text-white">{comp.label}</span>
                    </div>
                 ))}
              </div>
           </div>

           <div className="mt-auto p-6 rounded-2xl bg-[#66ADE4]/5 border border-[#66ADE4]/10 space-y-4">
              <div className="flex items-center gap-2 text-[#66ADE4]">
                 <Info className="w-5 h-5" />
                 <span className="text-[12px] font-black uppercase tracking-widest">Builder Logic</span>
              </div>
              <p className="text-[13px] text-slate-400 leading-relaxed font-medium">
                 Connect **Reasoning Nodes** to **Knowledge retrieval** for cited organizational synthesis.
              </p>
           </div>
        </aside>

        {/* Visual Flow Canvas */}
        <div className="flex-1 bg-black/20 border border-white/5 rounded-[3rem] relative overflow-hidden group/canvas shadow-inner bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:40px_40px]">
           <div className="absolute inset-0 bg-gradient-to-br from-[#66ADE4]/5 via-transparent to-[#66ADE4]/5 opacity-30" />
           
           {/* SVG Lines Connector (Static Mock) */}
           <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <path d="M 200 190 L 350 190" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-pulse" />
              <path d="M 450 190 L 600 190" stroke="#66ADE4" strokeWidth="2" fill="none" strokeDasharray="6 6" />
              <path d="M 700 190 L 850 190" stroke="#66ADE4" strokeWidth="2" fill="none" strokeDasharray="6 6" />
           </svg>

           {/* Nodes */}
           {nodes.map((node) => (
              <div 
                key={node.id}
                className="absolute p-6 rounded-[1.5rem] bg-[#0b0e14]/80 backdrop-blur-md border border-white/10 w-52 group/node hover:border-[#66ADE4] hover:shadow-xl hover:shadow-blue-900/10 transition-all cursor-move active:scale-95"
                style={{ left: node.pos.x, top: node.pos.y }}
              >
                <div className="flex items-center justify-between mb-4">
                   <div className={node.color + " p-2.5 rounded-xl text-white shadow-md transition-transform group-hover/node:rotate-6"}>
                      <node.icon className="w-5 h-5" />
                   </div>
                   <Badge variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{node.type}</Badge>
                </div>
                <h4 className="text-[15px] font-black text-white mb-1">{node.label}</h4>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Live Engine</span>
                </div>

                {/* Ports */}
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-black border-2 border-[#66ADE4] group-hover/node:scale-125 transition-transform shadow-sm" />
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-black border-2 border-[#66ADE4] group-hover/node:scale-125 transition-transform shadow-sm" />
              </div>
           ))}
        </div>

        {/* Properties Panel */}
        <aside className="w-80 bg-white/5 backdrop-blur-xl border border-white/10 p-10 flex flex-col gap-8 rounded-[2.5rem]">
           <div className="space-y-6">
              <h3 className="text-[12px] uppercase tracking-[0.2em] font-bold text-slate-500">Properties</h3>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-6">
                 <div className="space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-600">Node Name</label>
                    <input defaultValue="Semantic Search" className="w-full h-11 bg-black/40 border border-white/5 rounded-xl px-4 text-white text-[13px] font-bold focus:outline-none focus:ring-1 focus:ring-[#66ADE4]/20" />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-600">Synthesis Logic</label>
                    <div className="w-full flex items-center justify-between h-11 px-4 bg-[#66ADE4]/10 text-[#66ADE4] border border-[#66ADE4]/20 rounded-xl font-bold text-[12px]">
                       GPT-4o Reasoning
                       <BrainCircuit className="w-4 h-4" />
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-6">
              <h3 className="text-[12px] uppercase tracking-[0.2em] font-bold text-slate-500">Execution Guard</h3>
              <div className="space-y-3">
                 {[
                    { label: "Strict Typing", active: true },
                    { label: "Entity Masking", active: true },
                    { label: "Retrieval Audit", active: false },
                 ].map((guard, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#66ADE4]/30 transition-all">
                       <span className="text-[13px] font-bold text-slate-300">{guard.label}</span>
                       <div className={`h-5 w-10 rounded-full relative transition-colors ${guard.active ? 'bg-[#66ADE4]' : 'bg-white/10'}`}>
                          <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${guard.active ? 'right-1' : 'left-1'}`} ordnance-content="" />
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <Button 
            onClick={() => removeNode(nodes[nodes.length - 1]?.id)}
            variant="outline" className="mt-auto h-14 w-full rounded-2xl border-white/10 text-rose-500 hover:bg-rose-500/10 font-bold uppercase tracking-widest text-[11px] gap-2 transition-all">
              <Trash2 className="w-5 h-5" />
              Remove Block
           </Button>
        </aside>
      </div>
    </div>
  );
}
