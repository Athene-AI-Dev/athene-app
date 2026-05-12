"use client";

import { useState, useCallback } from "react";
import { 
  Blocks, 
  ArrowRight, 
  Plus, 
  CheckCircle2, 
  Loader2,
  Sparkles,
  Cloud
} from "lucide-react";
import Link from "next/link";
import Nango from "@nangohq/frontend";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderConfig, getProvider, PROVIDERS } from "@/lib/integrations/providers";
import { cn } from "@/lib/utils";

export default function OnboardingConnectionsPage() {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);

  const handleConnect = useCallback(async (provider: ProviderConfig) => {
    setConnecting(provider.key);
    try {
      const sessionRes = await fetch("/api/nango/session", { method: "POST" });
      if (!sessionRes.ok) throw new Error("Failed to secure Nango session");
      const { token } = await sessionRes.json();

      const nango = new Nango({ connectSessionToken: token });

      await nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "connect") {
            const saveRes = await fetch("/api/admin/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                connectionId: (event as any).connectionId,
                provider: provider.key,
              }),
            });

            if (saveRes.ok) {
              setConnectedCount(prev => prev + 1);
            }
          }
          if (event.type === "close") {
            setConnecting(null);
          }
        },
      });
    } catch (e: any) {
      console.error("Integration failed:", e.message);
      setConnecting(null);
    }
  }, []);

  const topProviders = [
    getProvider("sharepoint"),
    getProvider("google_drive"),
    getProvider("slack"),
    getProvider("notion")
  ].filter(Boolean) as ProviderConfig[];

  return (
    <div className="min-h-screen bg-[#06080c] text-white flex flex-col font-['Space_Grotesk'] overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[#66ADE4]/5 blur-[160px] -z-10 rounded-full opacity-50" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#D96FAB]/5 blur-[120px] -z-10 rounded-full" />

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-white/5 fixed top-0 left-0 z-50">
         <div className="h-full bg-gradient-to-r from-[#D96FAB] to-[#66ADE4] transition-all duration-1000" style={{ width: '75%' }} />
      </div>

      <main className="flex-1 container max-w-5xl mx-auto flex flex-col items-center justify-center p-6 pt-20">
        
        <div className="w-full text-center space-y-6 mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                 <Blocks className="w-6 h-6 text-[#66ADE4]" />
              </div>
           </div>
           
           <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
             Connect your <span className="text-gradient">Neural Grid</span>
           </h1>
           <p className="text-slate-400 max-w-xl mx-auto font-medium">
             Athene becomes smarter with every source you connect. Integrate your primary workspaces to begin the knowledge synthesis.
           </p>

           {connectedCount > 0 && (
             <div className="flex items-center justify-center gap-2 animate-in zoom-in duration-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{connectedCount} Sources Synthesized</span>
             </div>
           )}
        </div>

        {/* Integration Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150">
           {topProviders.map((provider) => (
              <div 
                key={provider.key}
                className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 flex flex-col items-center text-center transition-all duration-500 hover:border-[#66ADE4]/30 hover:bg-white/10"
              >
                 <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-xl transition-transform duration-500 group-hover:scale-110">
                    <img src={provider.icon} alt={provider.displayName} className="w-10 h-10 object-contain" />
                 </div>
                 <h3 className="font-bold text-sm mb-2">{provider.displayName}</h3>
                 <p className="text-[10px] text-slate-500 mb-6 line-clamp-2 leading-relaxed">
                   {provider.description}
                 </p>
                 <Button 
                   onClick={() => handleConnect(provider)}
                   disabled={connecting === provider.key}
                   className={cn(
                     "w-full h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all",
                     connecting === provider.key ? "bg-white/10 text-slate-400" : "bg-white text-black hover:bg-white/90"
                   )}
                 >
                    {connecting === provider.key ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-2" />
                        Connect
                      </>
                    )}
                 </Button>
              </div>
           ))}
        </div>

        {/* Footer Actions */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-8 py-10 border-t border-white/5 animate-in fade-in duration-1000 delay-300">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                 <Cloud className="w-5 h-5 text-slate-600" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Enterprise Encryption Active</span>
              </div>
              <div className="flex items-center gap-3">
                 <Sparkles className="w-5 h-5 text-slate-600" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">OIDC Verified</span>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors px-6">
                Skip for now
              </Link>
              <Button asChild size="lg" className="h-14 px-10 rounded-2xl bg-[#66ADE4] text-black hover:bg-[#599bc9] font-black uppercase tracking-widest text-[10px] gap-3 shadow-xl shadow-blue-500/20 group">
                <Link href="/dashboard">
                  Initialize Athene
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
           </div>
        </div>
      </main>
    </div>
  );
}
