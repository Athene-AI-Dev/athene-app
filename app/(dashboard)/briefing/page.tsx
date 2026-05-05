'use client';

import { useState, useEffect } from 'react';
import { BriefingSection } from '@/components/briefing/section';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { History, Sparkles, RefreshCw, Clock } from 'lucide-react';
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
    <div className="container max-w-5xl space-y-8 py-10 px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Morning Briefing
          </h1>
          {briefing && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Clock className="w-3.5 h-3.5" />
              Generated at {new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <History className="w-4 h-4" />
                History
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
                      <div className="flex gap-3 mt-1 opacity-60">
                         <span className="text-[10px] flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {item.calendar_items || 0} Cal</span>
                         <span className="text-[10px] flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> {item.email_items || 0} Emails</span>
                      </div>
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
            variant="ghost" 
            size="icon" 
            className="h-9 w-9"
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </header>

      {!briefing ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center border-2 border-dashed rounded-3xl bg-muted/10 space-y-6">
          <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20">
            <Sparkles className="w-10 h-10 text-blue-500" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-xl font-semibold">No briefing for today yet</h2>
            <p className="text-muted-foreground">
              Your daily summary is usually generated at 7:00 AM. You can manually trigger a generation now.
            </p>
          </div>
          <Button 
            size="lg" 
            className="gap-2 rounded-full px-8 shadow-lg shadow-blue-500/20"
            onClick={handleGenerateNow}
            disabled={enqueuing}
          >
            <Sparkles className="w-4 h-4" />
            {enqueuing ? 'Enqueuing...' : 'Generate now'}
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
