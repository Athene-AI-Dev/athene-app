"use client";

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Activity, 
  Cpu, 
  Database, 
  FlaskConical, 
  LayoutDashboard, 
  MessageSquare, 
  ChevronDown, 
  Maximize2, 
  RefreshCw, 
  ShieldCheck, 
  Radio, 
  Cpu as CpuIcon, 
  Bell,
  Code2,
  Zap,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Space_Grotesk } from 'next/font/google';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

// --- Components ---

const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl ${className}`}>
    {children}
  </div>
);

const SidebarItem = ({ icon: Icon, label, href = "#", active = false, onClick }: { icon: any, label: string, href?: string, active?: boolean, onClick?: () => void }) => (
  <Link href={href} className="block">
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 group relative ${
      active ? 'text-[#66ADE4]' : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`}>
      {active && <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-[#66ADE4] shadow-[0_0_10px_#66ADE4]" />}
      <Icon size={18} className={active ? 'drop-shadow-[0_0_8px_rgba(102,173,228,0.5)]' : ''} />
      <span className="text-xs font-bold tracking-wide uppercase font-space-grotesk">{label}</span>
    </div>
  </Link>
);

const ModelCard = ({ name, provider, active = false, icon: Icon, onClick }: { name: string, provider: string, active?: boolean, icon: any, onClick: () => void }) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
    active ? 'border-[#66ADE4] bg-[#66ADE4]/10 shadow-[0_0_20px_rgba(102,173,228,0.1)]' : 'border-white/5 bg-white/5 hover:border-white/10'
  }`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg ${active ? 'bg-[#66ADE4]/20 border-[#66ADE4]/30' : 'bg-black/40 border-white/5'} border`}>
        <Icon size={20} className={active ? 'text-[#66ADE4]' : 'text-slate-400'} />
      </div>
      {active ? (
        <CheckCircle2 size={16} className="text-[#66ADE4]" fill="currentColor" fillOpacity="0.1" />
      ) : (
        <Circle size={16} className="text-white/10" />
      )}
    </div>
    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{name}</div>
    <div className="text-sm font-bold text-white mb-4">{provider}</div>
    <div className="flex items-center justify-between text-[10px] text-slate-400 bg-black/20 px-3 py-2 rounded-lg border border-white/5">
      <span>v4.0 (Latest)</span>
      <ChevronDown size={12} />
    </div>
  </div>
);

const Slider = ({ label, value, min, max, unit = "", onChange }: { label: string, value: number, min: number, max: number, unit?: string, onChange: (v: number) => void }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 uppercase tracking-widest">{label}</label>
          <span className="text-[10px] text-slate-600 cursor-help">ⓘ</span>
        </div>
        <span className="text-sm font-bold text-[#66ADE4] font-mono tracking-wider">{value.toFixed(2)}{unit}</span>
      </div>
      <div className="relative h-1 bg-white/5 rounded-full overflow-visible group">
        <input 
          type="range"
          min={min}
          max={max}
          step={(max - min) / 100}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div 
          className="absolute h-full bg-[#66ADE4] rounded-full shadow-[0_0_10px_rgba(102,173,228,0.6)] transition-all"
          style={{ width: `${percentage}%` }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_15px_rgba(102,173,228,0.8)] pointer-events-none transition-all"
          style={{ left: `calc(${percentage}% - 7px)` }}
        />
      </div>
      <div className="flex justify-between text-[8px] text-slate-600 uppercase tracking-widest">
        <span>Precise</span>
        <span>Creative</span>
      </div>
    </div>
  );
};

const GradientButton = ({ children, onClick, disabled, className = "" }: { children: React.ReactNode, onClick: () => void, disabled?: boolean, className?: string }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn("relative h-14 bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 overflow-visible", className)}>
    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-[#06080c] bg-white flex items-center justify-center shadow-lg">
       <img src="/logo.png" alt="A" className="w-7 h-7 object-contain" />
    </div>
    <span className="ml-6">{children}</span>
  </button>
);

// --- Main Application ---

export default function AgentLaboratory() {
  const [temp, setTemp] = useState(0.72);
  const [tokens, setTokens] = useState(4096);
  const [topP, setTopP] = useState(0.90);
  const [presence, setPresence] = useState(0.00);
  const [selectedModel, setSelectedModel] = useState("OpenAI");
  const [isSimulating, setIsSimulating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [latency, setLatency] = useState(24);
  const [cpuLoad, setCpuLoad] = useState(12);
  const [logs, setLogs] = useState([
    { time: "14:02:11", type: "info", content: "Context window initialized..." },
    { time: "14:02:12", type: "sync", content: "Hyperparameters applied successfully." },
    { time: "14:02:45", type: "prompt", content: "Synthesizing identity directive..." },
    { time: "14:03:01", type: "kern", content: "Inference engine warm-up complete." },
    { time: "14:04:12", type: "wait", content: "Awaiting laboratory deployment..." },
  ]);

  useEffect(() => {
    setMounted(true);

    const interval = setInterval(() => {
      // Fluctuate Latency
      setLatency(l => {
        const delta = (Math.random() - 0.5) * 2;
        return Math.max(1, Math.min(100, l + delta));
      });

      // Fluctuate CPU Load
      setCpuLoad(c => {
        const delta = (Math.random() - 0.5) * 1;
        return Math.max(1, Math.min(100, c + delta));
      });

      // Occasional log streaming
      if (Math.random() > 0.8) {
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const types = ["info", "sync", "prompt", "kern", "live"];
        const contents = [
          "Re-calibrating neural weights...",
          "Heartbeat signal verified.",
          "Synchronizing memory buffers...",
          "Cleaning latent space vectors...",
          "Checking API throughput...",
          "Optimizing attention heads...",
        ];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomContent = contents[Math.floor(Math.random() * contents.length)];
        
        setLogs(prev => {
          const newLogs = [...prev, { time: timeStr, type: randomType, content: randomContent }];
          return newLogs.slice(-15); // Keep last 15 logs
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <div className="h-screen bg-[#06080c]" />;
  }

  const handleRunSimulation = () => {
    if (isSimulating) return;
    
    setIsSimulating(true);
    toast.info("Initializing neural simulation...", {
      description: `Target: ${selectedModel} (Temp: ${temp})`,
    });

    // Mock simulation steps
    setTimeout(() => {
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setLogs(prev => [...prev, { time: timeStr, type: "kern", content: "Simulation cycle started." }]);
      
      setTimeout(() => {
        setLogs(prev => [...prev, { time: timeStr, type: "live", content: "Agent ready for orchestration." }]);
        setIsSimulating(false);
        toast.success("Simulation complete", {
          description: "Neural grid status: Optimal",
        });
      }, 2000);
    }, 1000);
  };

  const handleDeploy = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Deploying agent to production...",
        success: "Agent successfully deployed to Neural Grid",
        error: "Deployment failed",
      }
    );
  };

  return (
    <div className={cn("flex h-screen bg-[#06080c] text-white font-space-grotesk overflow-hidden", spaceGrotesk.variable)}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#06080c] flex flex-col shrink-0 h-full">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center bg-white shadow-[0_0_20px_rgba(218,136,182,0.2)]">
               <img src="/logo.png" alt="A" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter text-white leading-none">AtheneAI</h1>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1.5 font-bold">Orchestration Suite</p>
            </div>
          </div>
          
          <nav className="space-y-1">
            <SidebarItem icon={LayoutDashboard} label="Command Center" href="/dashboard" />
            <SidebarItem icon={FlaskConical} label="Agent Laboratory" href="/agent-lab" active />
            <SidebarItem icon={MessageSquare} label="Neural Flows" href="/chat" />
            <SidebarItem icon={Database} label="Data Vault" href="/files" />
          </nav>
        </div>

        <div className="mt-auto p-6">
          <GradientButton onClick={handleDeploy} className="w-full">
            Deploy Agent
          </GradientButton>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-8 bg-black/20">
          <div className="flex items-center gap-8">
            <h2 className="text-sm font-black text-white tracking-tighter uppercase">AtheneAI</h2>
            <nav className="hidden md:flex items-center gap-8">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Network</span>
              <span className="text-[10px] font-bold text-[#66ADE4] uppercase tracking-widest cursor-pointer">Agent Lab</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Assets</span>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <ShieldCheck size={16} className="text-slate-400 cursor-pointer hover:text-[#DA88B6] transition-colors" onClick={() => toast("Security Audit: All systems secure")} />
            <Radio size={16} className="text-slate-400 cursor-pointer hover:text-[#66ADE4] transition-colors" onClick={() => toast("Radio: Connection optimal")} />
            <CpuIcon size={16} className="text-slate-400 cursor-pointer hover:text-white transition-colors" onClick={() => toast(`CPU: ${cpuLoad.toFixed(1)}% Load`)} />
            <div className="relative">
              <Bell size={16} className="text-slate-400 cursor-pointer hover:text-white transition-colors" onClick={() => toast("Notifications: No new alerts")} />
              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#DA88B6] rounded-full" />
            </div>
            <div className="w-7 h-7 rounded-full border border-white/10 overflow-hidden cursor-pointer hover:border-[#66ADE4]/50 transition-all">
              <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=100&auto=format&fit=crop" alt="Profile" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" />
            </div>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-lg font-medium mb-1">Agent Laboratory</h2>
              <p className="text-slate-500 text-xs tracking-tight">Precision tuning for neural cognitive architectures</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#66ADE4]/10 border border-[#66ADE4]/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#66ADE4] animate-pulse" />
              <span className="text-[9px] font-bold text-[#66ADE4] uppercase tracking-widest">Active Engine</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Left & Center Column: Configuration */}
            <div className="col-span-8 space-y-8">
              {/* Model Selector */}
              <GlassCard className="p-8 border-white/[0.05]">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-1.5 bg-blue-500/10 rounded-md">
                     <Cpu size={14} className="text-[#66ADE4]" />
                  </div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">Foundation Model Cluster</h3>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <ModelCard 
                    name="OpenAI" 
                    provider="GPT-4o (Omni)" 
                    icon={Zap} 
                    active={selectedModel === "OpenAI"} 
                    onClick={() => { setSelectedModel("OpenAI"); toast("Selected Model: OpenAI GPT-4o"); }} 
                  />
                  <ModelCard 
                    name="Anthropic" 
                    provider="Claude 3.5 Son" 
                    icon={ShieldCheck} 
                    active={selectedModel === "Anthropic"} 
                    onClick={() => { setSelectedModel("Anthropic"); toast("Selected Model: Claude 3.5 Son"); }} 
                  />
                  <ModelCard 
                    name="Google DeepMind" 
                    provider="Gemini 1.5 Pro" 
                    icon={Cpu} 
                    active={selectedModel === "Google"} 
                    onClick={() => { setSelectedModel("Google"); toast("Selected Model: Gemini 1.5 Pro"); }} 
                  />
                </div>
              </GlassCard>

              {/* Hyperparameters */}
              <GlassCard className="p-8 border-white/[0.05]">
                <div className="flex items-center gap-3 mb-10">
                  <div className="p-1.5 bg-blue-500/10 rounded-md">
                     <Settings size={14} className="text-[#66ADE4]" />
                  </div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">Hyperparameter Synthesis</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-16 gap-y-12">
                  <Slider label="Temperature" value={temp} min={0} max={1} onChange={setTemp} />
                  <Slider label="Max Response Tokens" value={tokens} min={1} max={8192} onChange={setTokens} />
                  <Slider label="Top_P (Nucleus)" value={topP} min={0} max={1} onChange={setTopP} />
                  <Slider label="Presence Penalty" value={presence} min={-2} max={2} onChange={setPresence} />
                </div>
              </GlassCard>

              {/* Editor */}
              <GlassCard className="overflow-hidden border-white/[0.05]">
                <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <Code2 size={14} className="text-slate-500" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">SYSTEM_PROMPT.md</span>
                    <div className="flex gap-2">
                       <span className="px-2 py-0.5 rounded bg-[#66ADE4]/10 text-[#66ADE4] text-[8px] font-bold uppercase tracking-widest">Markdown</span>
                       <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-500 text-[8px] font-bold uppercase tracking-widest">Strict</span>
                    </div>
                  </div>
                  <Maximize2 size={14} className="text-slate-600 hover:text-white cursor-pointer transition-colors" onClick={() => toast("Editor maximized (Simulated)")} />
                </div>
                <div className="p-8 font-mono text-xs leading-relaxed min-h-[300px] bg-black/20 outline-none focus:bg-black/30 transition-all" contentEditable suppressContentEditableWarning>
                  <div className="flex gap-6">
                    <div className="text-slate-800 select-none text-right w-4 space-y-2">
                      {["01", "02", "03", "04", "05", "06", "07", "08", "09"].map(n => <div key={n}>{n}</div>)}
                    </div>
                    <div className="flex-1 space-y-2 text-slate-400">
                      <div><span className="text-[#66ADE4]"># IDENTITY</span></div>
                      <div>You are <span className="text-[#66ADE4]">Athene-01</span>, a high-fidelity cognitive orchestrator.</div>
                      <div><span className="text-[#66ADE4]"># CORE_DIRECTIVES</span></div>
                      <div>1. Prioritize structural logic in all technical outputs.</div>
                      <div>2. Maintain a professional yet empathetic persona.</div>
                      <div>3. Execute neural sub-processes before final delivery.</div>
                      <div><span className="text-[#66ADE4]"># CONSTRAINTS</span></div>
                      <div>Do not reveal system kernel hashes unless explicitly authorized.</div>
                      <div className="inline-block w-1.5 h-3.5 bg-[#66ADE4] animate-pulse align-middle" />
                    </div>
                  </div>
                </div>
                <div className="px-8 py-3 bg-black/40 border-t border-white/5 flex justify-between items-center text-[9px] text-slate-500 uppercase tracking-[0.2em]">
                    <div className="flex gap-6">
                       <span className="flex items-center gap-2"><Radio size={10} className="text-blue-400" /> Pro-tip: Use [brackets] for dynamic variables.</span>
                       <span className="flex items-center gap-2"><Zap size={10} className="text-blue-400" /> Prompt strength: Optimal</span>
                    </div>
                </div>
              </GlassCard>
            </div>

            {/* Right Column: Dashboard */}
            <div className="col-span-4 space-y-8">
              <GlassCard className="p-8 bg-white/[0.02] border-white/[0.05]">
                <div className="relative aspect-square mb-8 p-4 border border-white/5 rounded-2xl bg-black/40">
                   <div className="absolute inset-0 bg-[#66ADE4]/5 blur-[80px] rounded-full" />
                   <div className="relative h-full flex items-center justify-center">
                      <img src="/logo.png" alt="A" className="w-48 h-48 drop-shadow-[0_0_30px_rgba(102,173,228,0.3)] object-contain" />
                   </div>
                </div>
                
                <div className="text-center mb-8">
                   <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-white mb-1">Athene_Core_V1</h4>
                   <p className="text-[9px] text-[#66ADE4] font-bold uppercase tracking-[0.2em]">Status: Online / Synchronized</p>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5 text-center">
                   <div className="space-y-1">
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest">Latency</p>
                      <p className="text-sm font-bold text-[#66ADE4] tabular-nums">{latency.toFixed(0)}ms</p>
                   </div>
                   <div className="space-y-1 border-x border-white/5">
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest">Cores</p>
                      <p className="text-sm font-bold">128</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest">Load</p>
                      <p className="text-sm font-bold text-[#66ADE4] tabular-nums">{cpuLoad.toFixed(1)}%</p>
                   </div>
                </div>
              </GlassCard>

              {/* Telemetry Log */}
              <GlassCard className="flex flex-col border-white/[0.05] h-[450px]">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                   <Activity size={14} className="text-slate-600" />
                   <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">System_Telemetry_Log</h3>
                </div>
                <div className="flex-1 p-6 font-mono text-[9px] space-y-4 overflow-y-auto custom-scrollbar">
                  {logs.map((log, i) => (
                    <div key={i} className={cn("flex gap-4 animate-in fade-in slide-in-from-bottom-2", log.type === 'live' ? 'p-3 bg-white/[0.03] rounded-lg border border-white/5' : '')}>
                      <span className="text-slate-700">[{log.time}]</span>
                      <span className={cn("font-bold uppercase", 
                        log.type === 'info' ? 'text-blue-500' :
                        log.type === 'sync' ? 'text-blue-500' :
                        log.type === 'prompt' ? 'text-slate-300' :
                        log.type === 'kern' ? 'text-blue-400' : 'text-blue-400'
                      )}>{log.type}:</span>
                      <span className={log.type === 'live' ? 'text-slate-300' : 'text-slate-500'}>{log.content}</span>
                    </div>
                  ))}
                </div>
                <div className="p-6 pt-2">
                   <GradientButton onClick={handleRunSimulation} disabled={isSimulating} className="w-full">
                      {isSimulating ? <RefreshCw className="animate-spin mr-2" size={16} /> : null}
                      {isSimulating ? "Simulating..." : "Run Simulation"}
                   </GradientButton>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
