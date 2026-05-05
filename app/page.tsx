import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, Shield, Zap, Globe, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const { userId } = await auth();
  
  if (userId) {
    redirect("/chat");
  }

  return (
    <div className="relative min-h-screen w-full bg-background dark overflow-hidden flex flex-col font-sans">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-primary/10 blur-[160px] -z-10 rounded-full opacity-50" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 blur-[100px] -z-10 rounded-full" />
      
      {/* Navigation Bar (Glass) */}
      <nav className="h-20 w-full flex items-center justify-between px-8 lg:px-16 z-50 fixed top-0 glass border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center glow-primary">
            <Image src="/logo.png" alt="Athene AI" width={22} height={22} className="invert brightness-0" />
          </div>
          <span className="text-xl font-black tracking-tight text-foreground">
            Athene<span className="text-primary">AI</span>
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/sign-in" className="text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
            Login
          </Link>
          <Button asChild className="rounded-xl px-6 glow-primary font-bold uppercase tracking-widest text-[10px]">
            <Link href="/sign-up">Request Access</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative pt-20 px-6">
        <div className="max-w-5xl w-full text-center space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          
          <div className="flex flex-col items-center space-y-6">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-black animate-pulse">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Enterprise Knowledge Orchestration
            </Badge>
            
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-gradient leading-[1.1] pb-2">
              Synthesize your <br />
              <span className="text-primary">Collective Intelligence</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium opacity-80">
              Athene is the intelligent layer for your organization. Securely unify documents, workflows, and insights into a single autonomous agent.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-10 rounded-2xl glow-primary font-black uppercase tracking-widest text-xs gap-3 group">
              <Link href="/sign-in">
                Enter Workspace
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            
            <Button variant="outline" size="lg" className="h-14 px-10 rounded-2xl glass border-white/5 font-black uppercase tracking-widest text-xs gap-3 hover:border-primary/30 hover:text-primary transition-all">
              <Command className="w-4 h-4" />
              View Capabilities
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="pt-20 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
             <div className="flex flex-col items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">SOC2 Compliant</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <Zap className="w-6 h-6 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Real-time Sync</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <Globe className="w-6 h-6 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Multi-Cloud</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Neural RAG</span>
             </div>
          </div>
        </div>
      </main>

      {/* Footer Decoration */}
      <footer className="py-12 border-t border-white/5 bg-accent/20 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
           <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Systems Operational</span>
        </div>
        <p className="text-[10px] text-muted-foreground/40 font-medium tracking-tight">
          &copy; 2026 ATHENE AI SYSTEMS. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </div>
  );
}

