"use client";

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
  BrainCircuit
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

const NODES = [
  { id: 1, type: "Trigger", icon: Play, label: "On File Upload", pos: { x: 100, y: 150 }, color: "bg-emerald-500" },
  { id: 2, type: "Action", icon: Search, label: "Semantic Search", pos: { x: 350, y: 150 }, color: "bg-[#D96FAB]" },
  { id: 3, type: "Branch", icon: GitBranch, label: "Classification", pos: { x: 600, y: 150 }, color: "bg-amber-500" },
  { id: 4, type: "Terminal", icon: Terminal, label: "Synth Agent", pos: { x: 850, y: 150 }, color: "bg-[#7AADCF]" },
];

export default function BuilderPage() {
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6 animate-in fade-in duration-700">
      {/* Builder Toolbar */}
      <header className="flex items-center justify-between bg-accent/20 p-5 rounded-[2rem] border border-white/5 shadow-sm">
        <div className="flex items-center gap-10 px-4">
          <div className="flex flex-col">
             <h2 className="text-base font-black tracking-tight text-foreground flex items-center gap-3">
                Agent Workflow <br className="md:hidden" />
                <Badge className="bg-[#D96FAB]/10 text-[#D96FAB] border-none text-[10px] font-bold h-5 px-2">BETA</Badge>
             </h2>
             <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.2em] mt-1">Intelligence Pipeline Editor</p>
          </div>
          <div className="h-10 w-px bg-white/10 hidden md:block" />
          <div className="hidden md:flex items-center gap-2">
             <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-[#D96FAB]/10 hover:text-[#D96FAB] transition-all">
                <MousePointer2 className="w-5 h-5" />
             </Button>
             <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-[#D96FAB]/10 hover:text-[#D96FAB] transition-all">
                <Layers className="w-5 h-5" />
             </Button>
             <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-[#D96FAB]/10 hover:text-[#D96FAB] transition-all">
                <Settings2 className="w-5 h-5" />
             </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 pr-2">
           <Button variant="outline" className="h-12 px-8 rounded-xl border-white/10 text-muted-foreground font-bold uppercase tracking-widest text-[10px] gap-2 hover:bg-white/5">
              <Save className="w-4 h-4 text-[#7AADCF]" />
              Store Config
           </Button>
           <Button className="h-12 px-10 rounded-xl bg-[#D96FAB] text-white hover:bg-[#ECA8CC] font-bold uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-pink-900/20 transition-all active:scale-95">
              <Play className="w-4 h-4 fill-white" />
              Deploy Fleet
           </Button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Components Panel */}
        <aside className="w-80 frosted-card p-8 flex flex-col gap-10">
           <div className="space-y-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground/60">Logic Blocks</h3>
              <div className="grid grid-cols-1 gap-4">
                 {[
                    { label: "Trigger Node", icon: Play, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                    { label: "AI Reasoning", icon: Cpu, color: "text-[#D96FAB]", bg: "bg-[#D96FAB]/10" },
                    { label: "Knowledge retrieval", icon: Database, color: "text-[#7AADCF]", bg: "bg-[#7AADCF]/10" },
                    { label: "Output Stream", icon: ChevronRight, color: "text-amber-400", bg: "bg-amber-400/10" },
                 ].map((comp, i) => (
                    <div key={i} className="group p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-[#D96FAB]/30 hover:bg-white/10 hover:shadow-md cursor-grab active:cursor-grabbing transition-all flex items-center gap-5">
                       <div className={`p-3 rounded-xl shadow-sm ${comp.bg} ${comp.color}`}>
                          <comp.icon className="w-5 h-5" />
                       </div>
                       <span className="text-[14px] font-bold text-muted-foreground/80 group-hover:text-foreground">{comp.label}</span>
                    </div>
                 ))}
              </div>
           </div>

           <div className="mt-auto p-6 rounded-2xl bg-[#EEF6FC]/10 border border-[#C2DCF0]/20 space-y-4">
              <div className="flex items-center gap-2 text-[#5290B8]">
                 <Info className="w-5 h-5" />
                 <span className="text-[12px] font-black uppercase tracking-widest">Builder Logic</span>
              </div>
              <p className="text-[13px] text-muted-foreground/80 leading-relaxed font-medium">
                 Connect **Reasoning Nodes** to **Knowledge retrieval** for cited organizational synthesis.
              </p>
           </div>
        </aside>

        {/* Visual Flow Canvas */}
        <div className="flex-1 bg-background border border-white/5 rounded-[3rem] relative overflow-hidden group/canvas shadow-inner bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:40px_40px]">
           <div className="absolute inset-0 bg-gradient-to-br from-[#D96FAB]/5 via-transparent to-[#7AADCF]/5 opacity-30" />
           
           {/* SVG Lines Connector (Static Mock) */}
           <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <path d="M 200 190 L 350 190" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-pulse" />
              <path d="M 450 190 L 600 190" stroke="#D96FAB" strokeWidth="2" fill="none" strokeDasharray="6 6" />
              <path d="M 700 190 L 850 190" stroke="#7AADCF" strokeWidth="2" fill="none" strokeDasharray="6 6" />
           </svg>

           {/* Nodes */}
           {NODES.map((node) => (
              <div 
                key={node.id}
                className="absolute p-6 rounded-[1.5rem] bg-card border border-white/10 w-52 group/node hover:border-[#D96FAB] hover:shadow-xl hover:shadow-pink-900/20 transition-all cursor-move active:scale-95"
                style={{ left: node.pos.x, top: node.pos.y }}
              >
                <div className="flex items-center justify-between mb-4">
                   <div className={node.color + " p-2.5 rounded-xl text-white shadow-md transition-transform group-hover/node:rotate-6"}>
                      <node.icon className="w-5 h-5" />
                   </div>
                   <Badge variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{node.type}</Badge>
                </div>
                <h4 className="text-[15px] font-black text-foreground mb-1">{node.label}</h4>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">Live Engine</span>
                </div>

                {/* Ports */}
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-card border-2 border-[#D96FAB] group-hover/node:scale-125 transition-transform shadow-sm" />
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-card border-2 border-[#7AADCF] group-hover/node:scale-125 transition-transform shadow-sm" />
              </div>
           ))}
        </div>

        {/* Properties Panel */}
        <aside className="w-80 frosted-card p-10 flex flex-col gap-8">
           <div className="space-y-6">
              <h3 className="text-[12px] uppercase tracking-[0.2em] font-bold text-muted-foreground/60">Properties</h3>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-6">
                 <div className="space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40">Node Name</label>
                    <input defaultValue="Semantic Search" className="w-full h-11 bg-background/50 border border-white/5 rounded-xl px-4 text-foreground text-[13px] font-bold focus:outline-none focus:ring-1 focus:ring-[#D96FAB]/20" />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40">Synthesis Logic</label>
                    <div className="w-full flex items-center justify-between h-11 px-4 bg-[#D96FAB]/10 text-[#D96FAB] border border-[#D96FAB]/20 rounded-xl font-bold text-[12px]">
                       GPT-4o Reasoning
                       <BrainCircuit className="w-4 h-4" />
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-6">
              <h3 className="text-[12px] uppercase tracking-[0.2em] font-bold text-[#6B6B6B]">Execution Guard</h3>
              <div className="space-y-3">
                 {[
                    { label: "Strict Typing", active: true },
                    { label: "Entity Masking", active: true },
                    { label: "Retrieval Audit", active: false },
                 ].map((guard, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#D0D0CE] hover:border-[#7AADCF]/30 transition-all">
                       <span className="text-[13px] font-bold text-[#3D3D3A]">{guard.label}</span>
                       <div className={`h-5 w-10 rounded-full relative transition-colors ${guard.active ? 'bg-[#D96FAB]' : 'bg-[#F1F1F0]'}`}>
                          <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${guard.active ? 'right-1' : 'left-1'}`} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <Button variant="outline" className="mt-auto h-14 w-full rounded-2xl border-[#D0D0CE] text-rose-600 hover:bg-rose-50 font-bold uppercase tracking-widest text-[11px] gap-2 transition-all">
              <Trash2 className="w-5 h-5" />
              Remove Block
           </Button>
        </aside>
      </div>
    </div>
  );
}
