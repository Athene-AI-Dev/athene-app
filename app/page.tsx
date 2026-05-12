import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, Shield, Zap, Globe, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const { userId } = await auth();
  
  // Redirect to /briefing if already authenticated
  if (userId) {
    redirect("/briefing");
  }

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground overflow-hidden flex flex-col font-['Space_Grotesk'] transition-colors duration-500">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-primary/10 blur-[160px] -z-10 rounded-full opacity-50 animate-pulse" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-secondary/5 blur-[100px] -z-10 rounded-full" />
      
      {/* Navigation Bar (Glass) */}
      <nav className="h-24 w-full flex items-center justify-between px-8 lg:px-16 z-50 fixed top-0 bg-background/30 backdrop-blur-3xl border-b border-border shadow-2xl">
        <div className="flex items-center gap-6 group cursor-pointer">
          <div className="w-12 h-12 rounded-[1.25rem] overflow-hidden flex items-center justify-center shadow-2xl bg-white border border-border group-hover:scale-110 transition-transform duration-500">
            <img src="/logo.png" alt="A" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-black tracking-tighter uppercase">
            Athene<span className="text-primary">AI</span>
          </span>
        </div>
        
        <div className="flex items-center gap-10">
          <Link href="/sign-in" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground hover:text-primary transition-all">
            Neural Login
          </Link>
          <Button asChild className="rounded-2xl px-10 h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-primary/20 transition-all active:scale-95">
            <Link href="/sign-up">Sync Workspace</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative pt-32 px-6">
        <div className="max-w-6xl w-full text-center space-y-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          
          <div className="flex flex-col items-center space-y-10">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-6 py-2.5 text-[10px] uppercase tracking-[0.4em] font-black rounded-full shadow-lg">
              <Sparkles className="w-4 h-4 mr-3 animate-pulse" />
              Cognitive Knowledge Orchestration
            </Badge>
            
            <h1 className="text-7xl md:text-[10rem] font-black tracking-tighter leading-[0.85] pb-4 uppercase">
              Synthesize your <br />
              <span className="text-primary">Collective Intelligence</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-bold tracking-tight opacity-70">
              Athene is the intelligent layer for your organization. Securely unify documents, workflows, and insights into a single autonomous neural agent.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <Link href="/sign-in" className="relative h-20 px-16 rounded-[2.5rem] bg-gradient-to-r from-primary to-secondary text-primary-foreground font-black uppercase tracking-widest text-xs gap-5 flex items-center justify-center group transition-all shadow-2xl shadow-primary/20 active:scale-95 overflow-visible border-none">
               <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-[1.5rem] border-4 border-background bg-white flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
                  <img src="/logo.png" alt="A" className="w-10 h-10 object-contain" />
               </div>
               <span className="ml-8">Enter Workspace</span>
               <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-2" />
            </Link>
            
            <Button asChild variant="outline" size="lg" className="h-20 px-16 rounded-[2.5rem] bg-muted/30 border-border font-black uppercase tracking-widest text-xs gap-5 hover:bg-muted/50 hover:border-primary/40 transition-all text-foreground backdrop-blur-xl">
              <Link href="/sign-up">
                <Command className="w-6 h-6" />
                Neural Capabilities
              </Link>
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="pt-32 grid grid-cols-2 md:grid-cols-4 gap-16 opacity-40 hover:opacity-100 transition-all duration-1000">
             <div className="flex flex-col items-center gap-5 group">
                <div className="p-5 bg-muted/50 rounded-2xl border border-border group-hover:border-primary/40 transition-all shadow-lg">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">SOC2 COMPLIANT</span>
             </div>
             <div className="flex flex-col items-center gap-5 group">
                <div className="p-5 bg-muted/50 rounded-2xl border border-border group-hover:border-primary/40 transition-all shadow-lg">
                  <Zap className="w-8 h-8 text-secondary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Neural Sync</span>
             </div>
             <div className="flex flex-col items-center gap-5 group">
                <div className="p-5 bg-muted/50 rounded-2xl border border-border group-hover:border-primary/40 transition-all shadow-lg">
                  <Globe className="w-8 h-8 text-accent" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Multi-Cloud</span>
             </div>
             <div className="flex flex-col items-center gap-5 group">
                <div className="p-5 bg-muted/50 rounded-2xl border border-border group-hover:border-primary/40 transition-all shadow-lg">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Cognitive RAG</span>
             </div>
          </div>
        </div>
      </main>

      {/* Footer Decoration */}
      <footer className="py-16 border-t border-border bg-card/30 backdrop-blur-3xl flex flex-col items-center gap-8">
        <div className="flex items-center gap-4 bg-muted/50 px-6 py-2.5 rounded-full border border-border shadow-inner">
           <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
           <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Systems Operational</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] text-muted-foreground font-black tracking-[0.5em] uppercase opacity-40">
            &copy; 2026 ATHENE AI SYSTEMS
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>
      </footer>
    </div>
  );
}
