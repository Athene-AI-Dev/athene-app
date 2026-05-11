'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Calendar, Mail, FileText, ChevronRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

type SectionType = 'calendar' | 'emails' | 'docs' | 'knowledge';

interface BriefingSectionProps {
  type: SectionType;
  title: string;
  content: string;
  className?: string;
}

const icons = {
  calendar: <Calendar className="w-5 h-5 text-blue-500" />,
  emails: <Mail className="w-5 h-5 text-purple-500" />,
  docs: <FileText className="w-5 h-5 text-emerald-500" />,
  knowledge: <Brain className="w-5 h-5 text-amber-500" />,
};

const gradients = {
  calendar: 'from-blue-500/10 to-transparent',
  emails: 'from-purple-500/10 to-transparent',
  docs: 'from-emerald-500/10 to-transparent',
  knowledge: 'from-amber-500/10 to-transparent',
};

const borderColors = {
  calendar: 'border-blue-500/20',
  emails: 'border-purple-500/20',
  docs: 'border-emerald-500/20',
  knowledge: 'border-amber-500/20',
};

export function BriefingSection({ type, title, content, className }: BriefingSectionProps) {
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-3xl border bg-card/30 p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 glass",
      borderColors[type],
      className
    )}>
      {/* Dynamic Background Glow */}
      <div className={cn(
        "absolute -right-20 -top-20 h-64 w-64 blur-[100px] transition-opacity duration-700 opacity-20 group-hover:opacity-40",
        gradients[type]
      )} />

      <div className="relative flex flex-col md:flex-row items-start gap-6">
        <div className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-background/50 backdrop-blur-xl shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
          borderColors[type]
        )}>
          {React.cloneElement(icons[type] as React.ReactElement<{ className: string }>, { className: "w-7 h-7" })}
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60">Intelligence Feed</p>
              <h3 className="text-2xl font-black tracking-tight text-foreground">{title}</h3>
            </div>
            <div className={cn(
              "h-8 w-8 rounded-full border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0",
              borderColors[type]
            )}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="prose prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-strong:font-bold prose-sm max-w-none prose-headings:text-foreground prose-headings:font-black">
            <ReactMarkdown>
              {content || "_System currently indexing updates for this sector._"}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
