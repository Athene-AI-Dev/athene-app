'use client';

import { useState, useEffect } from 'react';
import { BriefingSection } from '@/components/briefing/section';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  History, 
  Sparkles, 
  RefreshCw, 
  Clock, 
  Calendar,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function BriefingPage() {
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [enqueuing, setEnqueuing] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTodayBriefing(), fetchHistory()]);
      setLoading(false);
    };
    init();
  }, []);

  const fetchTodayBriefing = async () => {
    try {
      const res = await fetch('/api/briefing?type=today');
      const data = await res.json();
      if (!data.error) {
        setBriefing(data);
      }
    } catch (err) {
      console.error('Failed to fetch briefing', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/briefing?type=history');
      const data = await res.json();
      if (!data.error) {
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const handleHistoryItemClick = async (item: any) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/briefing?id=${item.id}`);
      const data = await res.json();
      if (!data.error) {
        setBriefing(data);
        toast.success(`Viewing briefing from ${new Date(item.generated_at).toLocaleDateString()}`);
      }
    } catch (err) {
      toast.error('Failed to load past briefing');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNow = async () => {
    try {
      setEnqueuing(true);
      const res = await fetch('/api/briefing', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Generation job enqueued! Check back in a few minutes.', {
          description: 'Our agents are currently synthesizing your updates.',
          icon: <Sparkles className="h-4 w-4 text-primary" />,
        });
      } else {
        toast.error(data.error || 'Failed to enqueue job');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setEnqueuing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-12 py-10 px-6 animate-pulse">
        <div className="h-64 w-full rounded-[2.5rem] bg-muted/20 border border-white/5" />
        <div className="grid gap-8">
          <div className="h-80 w-full rounded-3xl bg-muted/10 border border-white/5" />
          <div className="h-80 w-full rounded-3xl bg-muted/10 border border-white/5" />
          <div className="h-80 w-full rounded-3xl bg-muted/10 border border-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-1000">
      {/* Page Header */}
      <header className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/10 via-background to-background border border-white/5 p-10 lg:p-14 transition-all duration-500 hover:shadow-[0_0_50px_-12px_rgba(217,111,171,0.2)] group">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 blur-[140px] -z-10 translate-x-1/3 -translate-y-1/3 animate-pulse" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] font-black">
                Cognitive Intelligence
              </Badge>
              {briefing && (
                <Badge variant="secondary" className="bg-accent/50 text-accent-foreground border-white/5 px-3 py-1 text-[10px] uppercase tracking-wider font-bold">
                  Active Session
                </Badge>
              )}
            </div>
            
            <div className="space-y-2">
              <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-gradient leading-tight">
                Morning <span className="text-foreground">Briefing</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl leading-relaxed font-medium">
                {briefing 
                  ? `Your customized intelligence summary, synthesized at ${new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
                  : "Welcome back. Athene is ready to synthesize your cross-platform updates into a high-density morning summary."
                }
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 bg-card/40 border border-white/10 p-5 rounded-[2rem] glass shadow-xl">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 leading-none mb-1.5">Temporal Context</p>
                <p className="text-lg font-black text-foreground leading-none">
                  {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="h-16 w-16 rounded-3xl glass border-white/10 hover:border-primary/40 group shadow-lg">
                    <History className="w-6 h-6 group-hover:scale-110 transition-transform duration-500" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] sm:w-[540px] border-l border-white/10 glass shadow-2xl">
                  <SheetHeader className="pb-8 border-b border-white/5">
                    <SheetTitle className="text-3xl font-black tracking-tight flex items-center gap-3">
                      <Clock className="w-8 h-8 text-primary" />
                      Briefing History
                    </SheetTitle>
                    <p className="text-muted-foreground text-sm font-medium">Access your intelligence archive from the last 7 cycles.</p>
                  </SheetHeader>
                  <div className="mt-8 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)] pr-4 scrollbar-hide">
                    {history.length > 0 ? (
                      history.map((item, i) => (
                        <div 
                          key={item.id} 
                          className={cn(
                            "group flex flex-col gap-3 p-5 rounded-3xl border transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-right-4",
                            item.id === briefing?.id 
                              ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/5" 
                              : "bg-muted/20 border-white/5 hover:bg-muted/40 hover:border-white/20"
                          )}
                          style={{ animationDelay: `${i * 100}ms` }}
                          onClick={() => handleHistoryItemClick(item)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-base tracking-tight">
                              {new Date(item.generated_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </span>
                            <Badge variant={item.id === briefing?.id ? "default" : "outline"} className="rounded-full text-[9px] px-2 py-0">
                              {item.id === briefing?.id ? 'Current' : 'Archive'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 font-medium">{item.summary || 'Strategic summary indexing...'}</p>
                          <div className="flex items-center gap-3 pt-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60">
                              <Calendar className="w-3 h-3" /> {item.calendar_items || 0}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60">
                              <Mail className="w-3 h-3" /> {item.email_items || 0}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                        <p className="text-sm font-bold text-muted-foreground tracking-tight">Archive currently empty.</p>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              <Button 
                onClick={fetchTodayBriefing} 
                variant="outline" 
                size="icon" 
                className="h-16 w-16 rounded-3xl glass border-white/10 hover:border-primary/40 group shadow-lg"
                disabled={loading}
              >
                <RefreshCw className={cn("w-6 h-6 group-hover:rotate-180 transition-transform duration-700", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {!briefing ? (
        <Card className="frosted-card p-24 flex flex-col items-center justify-center min-h-[500px] text-center space-y-10 border-dashed border-white/10 group overflow-hidden relative">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="h-32 w-32 bg-primary/10 rounded-[3rem] flex items-center justify-center mb-2 transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 border border-primary/20 shadow-2xl relative z-10">
            <Sparkles className="h-16 w-16 text-primary animate-pulse" />
          </div>
          <div className="space-y-4 relative z-10">
            <h3 className="text-4xl font-black tracking-tighter text-foreground leading-none">Synthesis Required</h3>
            <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed font-medium">
              Athene hasn't generated your briefing for this cycle. Trigger our agents now to process your unread data.
            </p>
          </div>
          <Button 
            size="lg" 
            className="h-16 px-12 rounded-[2rem] glow-primary font-black uppercase tracking-[0.2em] text-xs gap-4 group relative z-10"
            onClick={handleGenerateNow}
            disabled={enqueuing}
          >
            <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
            {enqueuing ? 'Synthesizing...' : 'Trigger Generation'}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <BriefingSection 
            type="calendar" 
            title="Calendar & Strategic Alignment" 
            content={briefing.content?.calendar} 
            className="stagger-1"
          />
          <BriefingSection 
            type="emails" 
            title="High-Priority Communications" 
            content={briefing.content?.emails} 
            className="stagger-2"
          />
          <BriefingSection 
            type="docs" 
            title="Knowledge & Document Evolution" 
            content={briefing.content?.docs} 
            className="stagger-3"
          />
        </div>
      )}
    </div>
  );
}
