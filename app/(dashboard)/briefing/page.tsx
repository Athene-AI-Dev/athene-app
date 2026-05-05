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
    fetchTodayBriefing();
    fetchHistory();
  }, []);

  const fetchTodayBriefing = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/briefing?type=today');
      const data = await res.json();
      if (!data.error) {
        setBriefing(data);
      }
    } catch (err) {
      console.error('Failed to fetch briefing', err);
    } finally {
      setLoading(false);
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
        toast.success('Generation job enqueued! Check back in a few minutes.');
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
      <div className="container max-w-5xl space-y-8 py-10 px-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Page Header */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/5 via-background to-background border border-white/5 p-10 lg:p-14 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 group">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] -z-10 translate-x-1/4 -translate-y-1/4" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
          <div className="space-y-4">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 text-[10px] uppercase tracking-widest font-bold">
              Cognitive Digest
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-gradient">
              Intelligence <span className="text-primary">Briefing</span>
            </h1>
            <p className="text-muted-foreground text-base max-w-xl leading-relaxed">
              {briefing 
                ? `Generated at ${new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : "Synthesized updates tailored to your role and current initiatives. Stay informed with automated executive summaries."
              }
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-accent/40 border border-white/5 p-4 rounded-2xl glass">
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 leading-none mb-1">Current Cycle</p>
                <p className="text-sm font-bold text-foreground leading-none">
                  {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl glass border-white/5 hover:border-primary/20 group">
                  <History className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Past Briefings</SheetTitle>
                </SheetHeader>
                <div className="mt-8 space-y-4">
                  {history.length > 0 ? (
                    history.map((item) => (
                      <div 
                        key={item.id} 
                        className="group flex flex-col gap-1 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleHistoryItemClick(item)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {new Date(item.generated_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-background px-1.5 py-0.5 rounded border">
                            {item.id === briefing?.id ? 'Viewing' : 'View'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.summary || 'No summary available'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-10">No past briefings found.</p>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Button 
              onClick={fetchTodayBriefing} 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-2xl glass border-white/5 hover:border-primary/20 group"
              disabled={loading}
            >
              <RefreshCw className={cn("w-5 h-5 group-hover:rotate-180 transition-transform duration-500", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </section>

      {!briefing ? (
        <Card className="frosted-card p-20 flex flex-col items-center justify-center min-h-[400px] text-center space-y-8 border-dashed border-white/10 group">
          <div className="h-24 w-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-2 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 border border-primary/20">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-foreground">Synthesis Required</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
              Athene hasn't generated a brief for today yet. Usually, this happens at 7:00 AM, but you can trigger it manually.
            </p>
          </div>
          <Button 
            size="lg" 
            className="h-14 px-10 rounded-2xl glow-primary font-black uppercase tracking-widest text-xs gap-3 group"
            onClick={handleGenerateNow}
            disabled={enqueuing}
          >
            <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
            {enqueuing ? 'Enqueuing...' : 'Generate now'}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <BriefingSection 
            type="calendar" 
            title="Calendar & Meetings" 
            content={briefing.content?.calendar} 
          />
          <BriefingSection 
            type="emails" 
            title="Priority Emails" 
            content={briefing.content?.emails} 
          />
          <BriefingSection 
            type="docs" 
            title="Document Updates" 
            content={briefing.content?.docs} 
          />
        </div>
      )}
    </div>
  );
}

