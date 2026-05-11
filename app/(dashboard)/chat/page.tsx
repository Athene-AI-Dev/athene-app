"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { 
  Send, 
  User, 
  Paperclip, 
  Mic, 
  RefreshCcw,
  ShieldCheck,
  BrainCircuit,
  Zap,
  Layout,
  Search,
  Database,
  Loader2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { 
  Tabs, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HitlModal } from "@/components/chat/hitl-modal";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "standard" | "bi";
  timestamp: string;
  cited_sources?: any[];
  isAnalytical?: boolean;
  awaiting_approval?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-assistant",
      role: "assistant",
      content: "Welcome to the Athene Synthesis Environment. I've initialized your organizational knowledge graph. How can I assist your objectives today?",
      timestamp: "10:24 AM",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyticalMode, setIsAnalyticalMode] = useState(false);
  const [threadId, setThreadId] = useState<string>("");
  const [isHitlModalOpen, setIsHitlModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ tool: string; payload: any } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThreadId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const userMessage = input.trim();
    if (!userMessage || isLoading) return;

    const userEntry: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userEntry]);
    setInput("");
    setIsLoading(true);

    const assistantId = `assistant-${Date.now()}`;
    const assistantEntry: Message = { 
        id: assistantId, 
        role: "assistant", 
        content: "", 
        isAnalytical: isAnalyticalMode,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, assistantEntry]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage, 
          threadId,
          task_type: isAnalyticalMode ? "analytical" : "general"
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { 
                        ...m, 
                        content: payload.content,
                        cited_sources: payload.cited_sources || m.cited_sources,
                        awaiting_approval: payload.awaiting_approval
                      }
                    : m
                )
              );

              if (payload.awaiting_approval && payload.pending_write_action) {
                setPendingAction(payload.pending_write_action);
                setIsHitlModalOpen(true);
              }
            }
          } catch { }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: err instanceof Error ? `Error: ${err.message}` : "An unexpected error occurred." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleHitlDecision(action: 'approve' | 'reject' | 'edit', edits?: any) {
    try {
      const res = await fetch(`/api/threads/${threadId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, edits }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to process decision");
      }

      toast.success(`Action ${action}ed successfully`);
      
      // After approval, we might want to trigger the next step of the graph
      // The backend /approve endpoint already resumes the graph in the background.
      // We should probably start a new stream to listen for the results.
      
      // For now, let's just clear the pending action
      setPendingAction(null);
      
      // Optionally, send a follow-up message or just wait for the background process to complete
      // In a real app, we might poll or use WebSockets/SSE to see the resumed output.
      // Since the backend resumes background execution, we might need a way to reconnect to the stream.
      
    } catch (error: any) {
      toast.error(error.message);
      throw error;
    }
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-8 animate-in fade-in duration-700 overflow-hidden font-['Space_Grotesk']">
      <div className="flex flex-1 gap-8 overflow-hidden">
        
        {/* Main Conversation Column */}
        <div className="flex flex-1 flex-col min-w-0 gap-6">
          
          {/* Header Section */}
          <div className="flex items-center justify-between bg-white/5 p-6 rounded-[2.5rem] border border-white/5 shadow-sm">
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-md">
                <img src="/logo.png" alt="A" className="h-8 w-8 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-black tracking-tight text-white">Synthesis v4.2</h2>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[9px] font-bold h-4.5 px-2">LIVE</Badge>
                </div>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.15em] flex items-center gap-2 mt-0.5">
                   <ShieldCheck className="w-3.5 h-3.5 text-[#66ADE4]" />
                   Encrypted Pipeline
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <Tabs 
                    value={isAnalyticalMode ? "analytical" : "standard"} 
                    onValueChange={(v) => setIsAnalyticalMode(v === "analytical")}
                    className="hidden md:block"
                >
                    <TabsList className="bg-background/50 border border-white/5 p-1 rounded-xl h-11">
                    <TabsTrigger value="standard" className="rounded-lg px-6 text-[10px] font-bold uppercase tracking-wider transition-all data-[state=active]:bg-white/10 data-[state=active]:text-[#66ADE4] data-[state=active]:shadow-sm">
                        Standard
                    </TabsTrigger>
                    <TabsTrigger value="analytical" className="rounded-lg px-6 text-[10px] font-bold uppercase tracking-wider transition-all data-[state=active]:bg-white/10 data-[state=active]:text-[#66ADE4] data-[state=active]:shadow-sm flex items-center gap-2">
                        <Database className="w-3.5 h-3.5" />
                        Analytical
                    </TabsTrigger>
                    </TabsList>
                </Tabs>
               <div className="flex items-center gap-2 pr-2">
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-[#66ADE4]/10 hover:text-[#66ADE4] border border-transparent hover:border-white/10">
                     <RefreshCcw className="w-4.5 h-4.5" />
                  </Button>
               </div>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-10 py-6" ref={scrollRef}>
              {messages.map((msg, i) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn(
                    "flex max-w-[85%] gap-5",
                    msg.role === "user" && "flex-row-reverse"
                  )}>
                    <div className={cn(
                      "h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center border shadow-sm",
                      msg.role === "assistant" 
                        ? "bg-white border-white/10 text-black" 
                        : "bg-[#DA88B6] border-none text-white"
                    )}>
                      {msg.role === "assistant" ? <img src="/logo.png" alt="A" className="w-6 h-6 object-contain" /> : <User className="h-5.5 w-5.5" />}
                    </div>
                    
                    <div className="space-y-2">
                      <div className={cn(
                        "p-6 rounded-[2rem] text-[15px] leading-relaxed font-medium shadow-sm transition-all hover:shadow-md",
                        msg.role === "assistant" 
                          ? "bg-white/5 border border-white/5 text-white" 
                          : "bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] text-white border-none shadow-blue-900/20"
                      )}>
                        {msg.isAnalytical && msg.role === "assistant" && (
                            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] font-bold text-[#66ADE4] mb-4 border-b border-white/5 pb-3 w-fit">
                                <Database className="w-4 h-4" />
                                Business Intelligence Synthesis
                            </div>
                        )}
                        <div className="whitespace-pre-wrap">
                            {msg.content || (
                            <div className="flex items-center gap-4 py-2">
                                <Loader2 className="w-5 h-5 animate-spin text-[#66ADE4]" />
                                <span className="text-slate-500 animate-pulse text-[12px] font-bold uppercase tracking-widest">Athene is Synthesizing...</span>
                            </div>
                            )}
                        </div>
                        
                        {msg.cited_sources && msg.cited_sources.length > 0 && (
                          <div className="mt-8 flex flex-wrap gap-3 pt-6 border-t border-white/5">
                             {msg.cited_sources.map((source, idx) => (
                                <TooltipProvider key={idx}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <a 
                                                href={source.external_url || "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#66ADE4] hover:border-[#66ADE4]/30 transition-all duration-200"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5 text-[#66ADE4]" />
                                                {source.source_type || "Source"}
                                            </a>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-black text-white border-white/10 text-[10px] font-bold uppercase tracking-widest">
                                            Document ID: {source.document_id?.slice(0, 8)}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                             ))}
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        "flex items-center gap-3 px-6 mt-1",
                        msg.role === "user" && "flex-row-reverse"
                      )}>
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest opacity-60">{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Bar */}
          <div className="bg-white/5 p-4 rounded-[3rem] border border-white/5 flex flex-col gap-3 shadow-2xl shadow-black/20 relative z-10 mx-6 mb-4 group focus-within:border-[#66ADE4]/50 transition-all">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-[#66ADE4]/10 text-slate-400 transition-all">
                   <Paperclip className="w-5.5 h-5.5" />
                </Button>
                
                <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-4">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                        placeholder={isAnalyticalMode ? "Synthesize department-wide BI patterns..." : "Ask Athene to synthesize anything..."}
                        className="flex-1 bg-transparent border-none focus:outline-none text-white text-[15px] font-medium placeholder:text-slate-600 placeholder:font-bold placeholder:uppercase placeholder:tracking-widest h-12"
                    />
                    
                    <div className="flex items-center gap-3 pr-2">
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-[#66ADE4]/10 text-slate-400 transition-all">
                            <Mic className="w-5.5 h-5.5" />
                        </Button>
                        <Button 
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="h-12 w-12 rounded-full bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] text-white hover:shadow-lg hover:shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center"
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6 fill-white" />}
                        </Button>
                    </div>
                </form>
            </div>
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <aside className="hidden xl:flex w-80 flex-col gap-8 pr-4 pb-10">
           <Card className="bg-white/5 border border-white/10 p-10 space-y-8 rounded-[2.5rem]">
              <h3 className="text-[12px] uppercase tracking-[0.2em] font-black text-slate-500">Session Context</h3>
              <div className="space-y-6">
                 <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-5 group hover:border-[#66ADE4]/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                       <Layout className="w-5 h-5 text-[#66ADE4]" />
                       <Badge className="bg-white/5 text-slate-500 border-white/10 text-[10px] font-bold">3 SOURCES</Badge>
                    </div>
                    <p className="text-[14px] font-black text-white leading-tight">Knowledge Graph Synthesis Init</p>
                    <div className="flex items-center gap-3">
                       <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#66ADE4]" style={{ width: '100%' }} />
                       </div>
                       <span className="text-[11px] font-black text-[#66ADE4]">100%</span>
                    </div>
                 </div>
              </div>
           </Card>

           <Card className="bg-white/5 border border-white/10 flex-1 p-10 space-y-8 overflow-hidden rounded-[2.5rem]">
              <h3 className="text-[12px] uppercase tracking-[0.2em] font-black text-slate-500">Active Reasoning</h3>
              <div className="space-y-4">
                 {[
                   { name: "Retrieval Scout", status: "Active", icon: Search, color: "text-[#66ADE4]", bg: "bg-[#66ADE4]/10" },
                   { name: "Logic Engine", status: "Ready", icon: BrainCircuit, color: "text-[#66ADE4]", bg: "bg-[#66ADE4]/10" },
                   { name: "Audit Sentry", status: "Wait", icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                 ].map((agent, i) => (
                    <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 group hover:border-[#66ADE4]/20 transition-all">
                       <div className="flex items-center gap-4">
                          <div className={cn("p-3 rounded-xl shadow-sm bg-black/40", agent.color)}>
                             <agent.icon className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[13px] font-black text-white">{agent.name}</span>
                             <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{agent.status}</span>
                          </div>
                       </div>
                       <ChevronRight className="w-4 h-4 text-slate-800 group-hover:text-[#66ADE4] group-hover:translate-x-1 transition-all" />
                    </div>
                 ))}
              </div>
           </Card>
        </aside>
      </div>

      <HitlModal 
        isOpen={isHitlModalOpen}
        onClose={() => setIsHitlModalOpen(false)}
        threadId={threadId}
        pendingAction={pendingAction}
        onDecision={handleHitlDecision}
      />
    </div>
  );
}
