import { BookOpen, Sparkles, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function BriefingPage() {
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
              Synthesized updates tailored to your role and current initiatives. Stay informed with automated executive summaries.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-accent/40 border border-white/5 p-4 rounded-2xl glass">
            <Calendar className="h-6 w-6 text-primary" />
            <div>
               <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 leading-none mb-1">Current Cycle</p>
               <p className="text-sm font-bold text-foreground leading-none">May 4, 2026</p>
            </div>
          </div>
        </div>
      </section>

      {/* Placeholder Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="col-span-1 md:col-span-2 frosted-card p-10 flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 border-dashed border-white/10 group">
          <div className="h-20 w-20 bg-accent/40 rounded-[2.5rem] flex items-center justify-center mb-2 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Synthesis in Progress</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
              Athene is currently analyzing your organization's latest activity to generate your personalized brief.
            </p>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 text-[9px] uppercase tracking-widest font-bold">
            <Sparkles className="w-3 h-3 mr-2 animate-pulse" />
            Generating Intelligence
          </Badge>
        </Card>

        <div className="space-y-6">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 px-2">
            Upcoming Cycles
          </h3>
          {[1, 2, 3].map((i) => (
            <Card key={i} className="glass border-white/5 p-6 space-y-4 opacity-50 grayscale">
              <div className="h-4 w-3/4 bg-white/5 rounded-full" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-white/5 rounded-full" />
                <div className="h-3 w-1/2 bg-white/5 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

