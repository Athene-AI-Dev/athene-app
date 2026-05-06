"use client";

import { useEffect, useRef } from "react";
import { User, Zap, Loader2, Database, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  cited_sources?: CitedSource[];
  isAnalytical?: boolean;
  isLoading?: boolean;
}

export interface CitedSource {
  document_id: string;
  title: string | null;
  external_url?: string | null;
  chunk_index: number;
  source_type: string;
}

interface MessageListProps {
  messages: Message[];
  awaitingApproval?: boolean;
}

// Match [doc_id] patterns only — alphanumeric, hyphens, underscores
const CITATION_REGEX = /\[([a-zA-Z0-9_-]+)\]/g;

export function MessageList({ messages, awaitingApproval }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  function renderContent(content: string, citedSources?: CitedSource[]) {
    if (!citedSources || citedSources.length === 0) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    const parts: React.ReactNode[] = [];
    // Reset lastIndex to avoid stale state from previous calls
    CITATION_REGEX.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = CITATION_REGEX.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }

      const docId = match[1];
      const source = citedSources.find((s) => s.document_id === docId);

      if (source) {
        parts.push(
          <Tooltip key={`cite-${docId}-${match.index}`}>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center px-2 py-0.5 mx-0.5 bg-[#EEF6FC]/10 border border-[#C2DCF0]/20 rounded text-[10px] font-bold uppercase tracking-wider text-[#5290B8] cursor-pointer hover:bg-[#EEF6FC]/20 transition-colors"
                onClick={() => {
                  if (source.external_url) {
                    window.open(source.external_url, "_blank");
                  }
                }}
              >
                [{docId.slice(0, 8)}]
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-black text-white border-white/10 text-xs max-w-xs">
              <div className="space-y-1">
                <p className="font-bold">{source.title || "Untitled Document"}</p>
                <p className="text-muted-foreground">
                  Type: {source.source_type}
                </p>
                {source.external_url && (
                  <p className="text-[#5290B8] flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Open document
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      } else {
        parts.push(
          <span key={`cite-${docId}-${match.index}`}>[{docId}]</span>
        );
      }

      lastIndex = CITATION_REGEX.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>{content.slice(lastIndex)}</span>
      );
    }

    return <div className="whitespace-pre-wrap">{parts}</div>;
  }

  return (
    <TooltipProvider>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-10"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "flex max-w-[85%] gap-5",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center border shadow-sm",
                  msg.role === "assistant"
                    ? "bg-[#EEF6FC]/10 border-[#C2DCF0]/20 text-[#5290B8]"
                    : "bg-[#D96FAB]/10 border-[#F7DDE9]/20 text-[#D96FAB]"
                )}
              >
                {msg.role === "assistant" ? (
                  msg.isLoading ? (
                    <Loader2 className="h-5.5 w-5.5 animate-spin" />
                  ) : (
                    <Zap className="h-5.5 w-5.5" />
                  )
                ) : (
                  <User className="h-5.5 w-5.5" />
                )}
              </div>

              <div className="space-y-2">
                <div
                  className={cn(
                    "p-6 rounded-[2rem] text-[15px] leading-relaxed font-medium shadow-sm transition-all hover:shadow-md",
                    msg.role === "assistant"
                      ? "bg-card border border-white/5 text-foreground"
                      : "bg-[#D96FAB] text-white border-none shadow-pink-900/20"
                  )}
                >
                  {msg.isAnalytical && msg.role === "assistant" && (
                    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] font-bold text-[#D96FAB] mb-4 border-b border-white/5 pb-3 w-fit">
                      <Database className="w-4 h-4" />
                      Business Intelligence Synthesis
                    </div>
                  )}

                  {msg.isLoading && !msg.content ? (
                    <div className="flex items-center gap-4 py-2">
                      <Loader2 className="w-5 h-5 animate-spin text-[#D96FAB]" />
                      <span className="text-muted-foreground animate-pulse text-[12px] font-bold uppercase tracking-widest">
                        Athene is Synthesizing...
                      </span>
                    </div>
                  ) : (
                    renderContent(msg.content, msg.cited_sources)
                  )}

                  {msg.cited_sources && msg.cited_sources.length > 0 && (
                    <div className="mt-8 flex flex-wrap gap-3 pt-6 border-t border-white/5">
                      {msg.cited_sources.map((source, idx) => (
                        <Tooltip key={`${source.document_id}-${idx}`}>
                          <TooltipTrigger asChild>
                            <a
                              href={source.external_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-[#D96FAB] hover:border-[#D96FAB]/30 transition-all duration-200"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#7AADCF]" />
                              {source.source_type || "Source"}
                            </a>
                          </TooltipTrigger>
                          <TooltipContent className="bg-black text-white border-white/10 text-[10px] font-bold uppercase tracking-widest">
                            Document ID: {source.document_id.slice(0, 8)}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    "flex items-center gap-3 px-6 mt-1",
                    msg.role === "user" && "flex-row-reverse"
                  )}
                >
                  <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest opacity-60">
                    {msg.timestamp}
                  </span>
                  {msg.role === "assistant" && (
                    <div className="flex gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                      <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {awaitingApproval && (
          <div className="flex justify-center">
            <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs font-bold uppercase tracking-widest">
              Awaiting approval...
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
