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
    <div className="flex h-[calc(100vh-120px)] flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-hidden font-['Space_Grotesk'] transition-colors duration-300">
      <div className="flex flex-1 gap-8 overflow-hidden">
        
        {/* Main Conversation Column */}
        <div className="flex flex-1 flex-col min-w-0 gap-6">
          
          {/* Header Section */}
          <div className="flex items-center justify-between bg-card/50 p-6 rounded-[2.5rem] border border-border shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-border/50 group hover:scale-105 transition-transform">
                <img src="/logo.png" alt="A" className="h-8 w-8 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-black tracking-tight text-foreground uppercase tracking-widest">Synthesis <span className="text-primary">v4.2</span></h2>
                  <Badge className="bg-accent/10 text-accent border-accent/20 text-[9px] font-black h-4.5 px-2 tracking-widest uppercase">LIVE</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] flex items-center gap-2 mt-0.5">
                   <ShieldCheck className="w-3.5 h-3.5 text-primary" />
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
                    <TabsList className="bg-muted/30 border border-border p-1 rounded-xl h-11">
                    <TabsTrigger value="standard" className="rounded-lg px-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
                        Standard
                    </TabsTrigger>
                    <TabsTrigger value="analytical" className="rounded-lg px-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-lg flex items-center gap-2">
                        <Database className="w-3.5 h-3.5" />
                        Analytical
                    </TabsTrigger>
                    </TabsList>
                </Tabs>
               <div className="flex items-center gap-2 pr-2">
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/10 transition-all">
                     <RefreshCcw className="w-4.5 h-4.5" />
                  </Button>
               </div>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4 custom-scrollbar">
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
                      "h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center border shadow-xl transition-all group hover:scale-110",
                      msg.role === "assistant" 
                        ? "bg-white border-border text-black" 
                        : "bg-gradient-to-br from-primary to-secondary border-none text-white"
                    )}>
                      {msg.role === "assistant" ? <img src="/logo.png" alt="A" className="w-6 h-6 object-contain" /> : <User className="h-5.5 w-5.5" />}
                    </div>
                    
                    <div className="space-y-3">
                      <div className={cn(
                        "p-8 rounded-[2.5rem] text-[15px] leading-relaxed font-bold shadow-2xl transition-all hover:shadow-primary/5",
                        msg.role === "assistant" 
                          ? "bg-card/50 border border-border text-foreground backdrop-blur-xl" 
                          : "bg-gradient-to-r from-primary to-secondary text-primary-foreground border-none"
                      )}>
                        {msg.isAnalytical && msg.role === "assistant" && (
                            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] font-black text-primary mb-6 border-b border-border/50 pb-4 w-fit">
                                <Database className="w-4 h-4" />
                                Business Intelligence Synthesis
                            </div>
                        )}
                        <div className="whitespace-pre-wrap tracking-tight">
                            {msg.content || (
                            <div className="flex items-center gap-5 py-3">
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                                </div>
                                <span className="text-muted-foreground/40 text-[11px] font-black uppercase tracking-[0.3em]">Synthesizing Reality...</span>
                            </div>
                            )}
                        </div>
                        
                        {msg.cited_sources && msg.cited_sources.length > 0 && (
                          <div className="mt-10 flex flex-wrap gap-3 pt-8 border-t border-border/50">
                             {msg.cited_sources.map((source, idx) => (
                                <TooltipProvider key={idx}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <a 
                                                href={source.external_url || "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-3 px-5 py-2.5 bg-muted/20 border border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-muted/40 transition-all duration-300 shadow-sm"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                                {source.source_type || "Source"}
                                            </a>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-popover text-popover-foreground border-border text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl">
                                            Document ID: {source.document_id?.slice(0, 8)}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                             ))}
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        "flex items-center gap-3 px-8 mt-1",
                        msg.role === "user" && "flex-row-reverse"
                      )}>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">{msg.timestamp}</span>
                        {msg.role === "assistant" && (
                          <div className="flex items-center gap-2">
                             <div className="h-1 w-1 rounded-full bg-primary" />
                             <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Verified Synthesis</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Bar */}
          <div className="bg-card/50 p-5 rounded-[3.5rem] border border-border flex flex-col gap-3 shadow-2xl shadow-black/40 relative z-10 mx-10 mb-6 group focus-within:border-primary/50 focus-within:shadow-primary/5 transition-all backdrop-blur-2xl">
            <div className="flex items-center gap-5">
                <Button variant="ghost" size="icon" className="h-14 w-14 rounded-full hover:bg-muted/80 text-muted-foreground transition-all group/btn">
                   <Paperclip className="w-6 h-6 group-hover/btn:text-primary transition-colors" />
                </Button>
                
                <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-5">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                        placeholder={isAnalyticalMode ? "Synthesize department-wide BI patterns..." : "Ask Athene to synthesize anything..."}
                        className="flex-1 bg-transparent border-none focus:outline-none text-foreground text-base font-bold placeholder:text-muted-foreground/30 placeholder:font-black placeholder:uppercase placeholder:tracking-[0.2em] h-14"
                    />
                    
                    <div className="flex items-center gap-4 pr-3">
                        <Button variant="ghost" size="icon" className="h-14 w-14 rounded-full hover:bg-muted/80 text-muted-foreground transition-all group/btn">
                            <Mic className="w-6 h-6 group-hover/btn:text-primary transition-colors" />
                        </Button>
                        <Button 
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground hover:shadow-2xl hover:shadow-primary/20 transition-all active:scale-95 flex items-center justify-center border-none"
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6 fill-primary-foreground" />}
                        </Button>
                    </div>
                </form>
            </div>
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <aside className="hidden xl:flex w-80 flex-col gap-8 pr-4 pb-10 overflow-y-auto custom-scrollbar">
           <Card className="bg-card/50 backdrop-blur-xl border border-border p-10 space-y-8 rounded-[2.5rem] shadow-2xl transition-colors duration-300">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Session Context</h3>
              <div className="space-y-6">
                 <div className="p-8 rounded-[2rem] bg-muted/20 border border-border/50 space-y-6 group hover:border-primary/40 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                       <Layout className="w-6 h-6 text-primary" />
                       <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest">3 SOURCES</Badge>
                    </div>
                    <p className="text-base font-black text-foreground leading-tight tracking-tight uppercase">Knowledge Graph Synthesis Init</p>
                    <div className="space-y-3">
                       <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                          <span>Progress</span>
                          <span className="text-primary">100%</span>
                       </div>
                       <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: '100%' }} />
                       </div>
                    </div>
                 </div>
              </div>
           </Card>

           <Card className="bg-card/50 backdrop-blur-xl border border-border flex-1 p-10 space-y-10 overflow-hidden rounded-[2.5rem] shadow-2xl transition-colors duration-300">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Active Reasoning</h3>
              <div className="space-y-6">
                 {[
                   { name: "Retrieval Scout", status: "Active", icon: Search, color: "text-primary", bg: "bg-primary/10" },
                   { name: "Logic Engine", status: "Ready", icon: BrainCircuit, color: "text-primary", bg: "bg-primary/10" },
                   { name: "Audit Sentry", status: "Watching", icon: ShieldCheck, color: "text-accent", bg: "bg-accent/10" },
                 ].map((agent, i) => (
                    <div key={i} className="flex items-center justify-between p-6 rounded-2xl bg-muted/10 border border-border group hover:border-primary/20 hover:bg-muted/20 transition-all cursor-help shadow-sm">
                       <div className="flex items-center gap-5">
                          <div className={cn("p-4 rounded-xl shadow-lg border border-border group-hover:border-primary/20 transition-colors", agent.bg)}>
                             <agent.icon className={cn("w-5 h-5", agent.color)} />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-sm font-black text-foreground uppercase tracking-tight">{agent.name}</span>
                             <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">{agent.status}</span>
                          </div>
                       </div>
                       <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
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
