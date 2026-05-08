'use client';

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
      "relative overflow-hidden rounded-2xl border bg-card p-6 transition-all hover:shadow-lg",
      borderColors[type],
      className
    )}>
      {/* Background Gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-50",
        gradients[type]
      )} />

      <div className="relative flex items-start gap-4">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background/50 backdrop-blur-sm",
          borderColors[type]
        )}>
          {icons[type]}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50" />
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg">
            <ReactMarkdown>
              {content || "_No updates for this section._"}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
