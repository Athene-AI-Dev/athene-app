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
    <div className="relative min-h-screen w-full bg-[#06080c] text-white overflow-hidden flex flex-col font-['Space_Grotesk']">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[#66ADE4]/10 blur-[160px] -z-10 rounded-full opacity-50" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#66ADE4]/5 blur-[100px] -z-10 rounded-full" />
      
      {/* Navigation Bar (Glass) */}
      <nav className="h-20 w-full flex items-center justify-between px-8 lg:px-16 z-50 fixed top-0 bg-black/20 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(102,173,228,0.3)] bg-white">
            <img src="/logo.png" alt="A" className="w-full h-full object-contain p-1" />
          </div>
          <span className="text-xl font-black tracking-tighter text-white">
            Athene<span className="text-[#66ADE4]">AI</span>
          </span>
        </div>
        
        <div className="flex items-center gap-8">
          <Link href="/sign-in" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors">
            Login
          </Link>
          <Button asChild className="rounded-xl px-8 bg-[#66ADE4] text-black hover:bg-[#599bc9] font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20">
            <Link href="/sign-up">Request Access</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative pt-20 px-6">
        <div className="max-w-5xl w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          
          <div className="flex flex-col items-center space-y-8">
            <Badge variant="outline" className="bg-white/5 text-[#66ADE4] border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] font-black animate-pulse">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Enterprise Knowledge Orchestration
            </Badge>
            
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[1.1] pb-2 text-white">
              Synthesize your <br />
              <span className="text-[#66ADE4]">Collective Intelligence</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium opacity-80">
              Athene is the intelligent layer for your organization. Securely unify documents, workflows, and insights into a single autonomous agent.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/sign-in" className="relative h-16 px-12 rounded-2xl bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] text-white font-black uppercase tracking-widest text-xs gap-4 flex items-center justify-center group transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] overflow-visible">
               <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-[#06080c] bg-white flex items-center justify-center shadow-lg">
                  <img src="/logo.png" alt="A" className="w-6 h-6 object-contain" />
               </div>
               <span className="ml-6">Enter Workspace</span>
               <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            
            <Button asChild variant="outline" size="lg" className="h-16 px-12 rounded-2xl bg-white/5 border-white/10 font-black uppercase tracking-widest text-xs gap-4 hover:bg-white/10 hover:border-[#66ADE4]/30 transition-all text-white">
              <Link href="/sign-up">
                <Command className="w-5 h-5" />
                View Capabilities
              </Link>
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="pt-24 grid grid-cols-2 md:grid-cols-4 gap-12 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
             <div className="flex flex-col items-center gap-3">
                <Shield className="w-6 h-6 text-[#66ADE4]" />
                <span className="text-[10px] font-black uppercase tracking-widest">SOC2 Compliant</span>
             </div>
             <div className="flex flex-col items-center gap-3">
                <Zap className="w-6 h-6 text-[#66ADE4]" />
                <span className="text-[10px] font-black uppercase tracking-widest">Real-time Sync</span>
             </div>
             <div className="flex flex-col items-center gap-3">
                <Globe className="w-6 h-6 text-[#66ADE4]" />
                <span className="text-[10px] font-black uppercase tracking-widest">Multi-Cloud</span>
             </div>
             <div className="flex flex-col items-center gap-3">
                <Sparkles className="w-6 h-6 text-[#66ADE4]" />
                <span className="text-[10px] font-black uppercase tracking-widest">Neural RAG</span>
             </div>
          </div>
        </div>
      </main>

      {/* Footer Decoration */}
      <footer className="py-12 border-t border-white/5 bg-black/20 flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
           <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Systems Operational</span>
        </div>
        <p className="text-[10px] text-slate-600 font-medium tracking-widest">
          &copy; 2026 ATHENE AI SYSTEMS. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </div>
  );
}
