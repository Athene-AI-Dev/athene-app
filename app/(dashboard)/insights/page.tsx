import { BarChart3, TrendingUp, PieChart, Activity, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function InsightsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Page Header */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/5 via-background to-background border border-white/5 p-10 lg:p-14 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 group">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] -z-10 translate-x-1/4 -translate-y-1/4" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
          <div className="space-y-4">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 text-[10px] uppercase tracking-widest font-bold">
              Business Intelligence
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-gradient">
              Executive <span className="text-primary">Insights</span>
            </h1>
            <p className="text-muted-foreground text-base max-w-xl leading-relaxed">
              Real-time analytics and predictive trends synthesized from across your entire enterprise system.
            </p>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-10 w-10 rounded-full border-2 border-background bg-accent flex items-center justify-center text-[10px] font-bold">
                    AN
                  </div>
                ))}
             </div>
             <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">4 Analysts Active</p>
          </div>
        </div>
      </section>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Knowledge Density", value: "84.2%", icon: Activity },
          { label: "Sync Velocity", value: "1.2gb/s", icon: TrendingUp },
          { label: "Query Precision", value: "99.4%", icon: PieChart },
          { label: "Insight Generation", value: "12k", icon: Sparkles },
        ].map((stat, i) => (
          <Card key={i} className="glass border-white/5 p-6 space-y-4 hover:glow-primary transition-all duration-300">
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-foreground">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 frosted-card p-12 flex flex-col items-center justify-center min-h-[400px] text-center space-y-8 border-dashed border-white/10 group">
          <div className="relative">
             <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
             <div className="relative h-24 w-24 bg-accent/40 rounded-[2.5rem] flex items-center justify-center transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12">
               <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
             </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-black text-foreground tracking-tight">Predictive Modeling Pending</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed font-medium">
              Insufficient data points to generate high-fidelity cross-department trends. Connect more data sources to unlock advanced modeling.
            </p>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-4 py-1.5 text-[10px] uppercase tracking-widest font-black">
            Requirement: 3+ Active Connectors
          </Badge>
        </Card>

        <Card className="glass border-white/5 p-8 space-y-8">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground/60">
            Intelligence Health
          </h3>
          <div className="space-y-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-3">
                 <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-muted-foreground/60">Department {i}</span>
                    <span className="text-primary">{100 - (i * 15)}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${100 - (i * 15)}%` }} />
                 </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

