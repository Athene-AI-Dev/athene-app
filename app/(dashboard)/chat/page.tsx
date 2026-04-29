"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send, Bot, User, Sparkles, Database, ExternalLink, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  cited_sources?: any[];
  isAnalytical?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyticalMode, setIsAnalyticalMode] = useState(false);
  const [threadId] = useState<string>(() => `thread-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const userMessage = input.trim();
    if (!userMessage || isLoading) return;

    const userEntry: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
    };

    setMessages((prev) => [...prev, userEntry]);
    setInput("");
    setIsLoading(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", isAnalytical: isAnalyticalMode },
    ]);

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
                        cited_sources: payload.cited_sources || m.cited_sources 
                      }
                    : m
                )
              );
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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto animate-in fade-in duration-700">
      {/* Header with Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            Chat
            <Sparkles className="w-5 h-5 text-blue-500" />
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Interact with your organization's knowledge base and tools.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          <button
            onClick={() => setIsAnalyticalMode(false)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              !isAnalyticalMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Standard
          </button>
          <button
            onClick={() => setIsAnalyticalMode(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              isAnalyticalMode ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Database className="w-3.5 h-3.5" />
            Analytical
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-8 space-y-8 scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-slate-400" />
            </div>
            <div className="space-y-1">
                <p className="text-slate-900 font-medium">How can I help you today?</p>
                <p className="text-slate-500 text-sm max-w-xs">Ask about documents, schedules, or company insights.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm",
                msg.role === "user" ? "bg-blue-600" : "bg-white border border-slate-200"
            )}>
                {msg.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                ) : (
                    <Bot className={cn("w-4 h-4", msg.isAnalytical ? "text-blue-600" : "text-slate-600")} />
                )}
            </div>

            <div className={cn("flex flex-col gap-2 max-w-[85%]", msg.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "rounded-2xl px-5 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                    : "bg-white text-slate-900 border border-slate-200 shadow-sm"
                )}
              >
                {msg.isAnalytical && msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-blue-600 mb-2 border-b border-blue-50 pb-1 w-fit">
                        <Database className="w-3 h-3" />
                        Analytical Mode
                    </div>
                )}
                <div className="whitespace-pre-wrap">{msg.content || <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}</div>
              </div>

              {/* Citations */}
              {msg.cited_sources && msg.cited_sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                    {msg.cited_sources.map((source, idx) => (
                        <a 
                            key={idx}
                            href={source.external_url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <ExternalLink className="w-2.5 h-2.5" />
                            {source.source_type || "Source"} [{source.document_id.slice(0, 4)}]
                        </a>
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="pt-6 border-t border-slate-200">
        <form
            onSubmit={handleSubmit}
            className="relative flex items-center group"
        >
            <div className="absolute left-4 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <Sparkles className="w-4 h-4" />
            </div>
            <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={isAnalyticalMode ? "Ask for analytical insights..." : "Ask something..."}
            className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-14 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
            <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-sm"
            >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
        </form>
        
        {isAnalyticalMode && (
            <div className="mt-3 flex items-center gap-2 px-1 animate-in slide-in-from-top-1 duration-300">
                <div className="p-1 bg-blue-50 text-blue-600 rounded">
                    <Info className="w-3 h-3" />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                    <span className="font-semibold text-blue-700 uppercase mr-1">BI Mode active:</span> 
                    Accesses department-cross knowledge and focuses on trends, gaps, and data patterns.
                </p>
            </div>
        )}
      </div>
    </div>
  );
}
