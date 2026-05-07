"use client";

import { useEffect, useState } from "react";
import { useOrganization, useAuth, OrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { syncUserAndOrg } from "./actions";
import { ProviderConfig, getAllProviders } from "@/lib/integrations/providers";
import Nango from "@nangohq/frontend";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Blocks, ChevronRight, CheckCircle2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";

const CATEGORY_LABELS: Record<string, string> = {
  productivity: "Productivity",
  crm: "Sales & CRM",
  devtools: "Development",
  communication: "Communications",
  data: "Data & BI",
};

export default function OrgSelectionPage() {
  const { orgId, isLoaded: isAuthLoaded } = useAuth();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const router = useRouter();

  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedKeys, setConnectedKeys] = useState<Set<string>>(new Set());

  const providers = getAllProviders();
  const groupedProviders = Object.entries(CATEGORY_LABELS)
    .map(([catKey, catLabel]) => ({
      key: catKey,
      label: catLabel,
      providers: providers.filter((p) => p.category === catKey),
    }))
    .filter((g) => g.providers.length > 0);

  // When an organization is selected, sync it to our DB
  useEffect(() => {
    if (orgId && syncStatus === "idle" && isOrgLoaded && organization) {
      setSyncStatus("syncing");
      syncUserAndOrg().then((res) => {
        if (res.success) {
          setSyncStatus("success");
        } else {
          console.error(res.error);
          setSyncStatus("error");
        }
      });
    }
  }, [orgId, syncStatus, isOrgLoaded, organization]);

  const handleConnect = async (provider: ProviderConfig) => {
    try {
      setConnecting(provider.key);

      const sessionRes = await fetch("/api/nango/session", { method: "POST" });
      if (!sessionRes.ok) throw new Error("Failed to secure Nango session");

      const { token } = await sessionRes.json();
      const nango = new Nango({ connectSessionToken: token });

      await nango.openConnectUI({
        integrationId: provider.nangoIntegrationId,
      });

      setConnectedKeys((prev) => new Set(prev).add(provider.key));
    } catch (err) {
      console.error("[nango] Connection failed:", err);
      alert("Failed to connect integration. Please try again.");
    } finally {
      setConnecting(null);
    }
  };

  // Phase 0: Loading auth state
  if (!isAuthLoaded || !isOrgLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Phase 1: No Organization Selected
  if (!orgId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Welcome to Athene</h1>
            <p className="text-sm font-medium text-muted-foreground">
              Please select or create an organization to continue.
            </p>
          </div>
          <div className="flex justify-center">
            <OrganizationList 
              hidePersonal={true} 
              afterSelectOrganizationUrl="/org-selection"
              afterCreateOrganizationUrl="/org-selection"
            />
          </div>
        </div>
      </div>
    );
  }

  // Phase 2: Syncing
  if (syncStatus === "syncing" || syncStatus === "idle") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse tracking-widest uppercase">
          Provisioning Workspace...
        </p>
      </div>
    );
  }

  if (syncStatus === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <p className="text-red-500 font-bold">Failed to provision workspace.</p>
        <Button onClick={() => setSyncStatus("idle")}>Retry</Button>
      </div>
    );
  }

  // Phase 3: Setup Integrations
  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-background py-16 px-6">
      <div className="max-w-3xl w-full space-y-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Workspace Ready
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground">
            Connect your tools
          </h1>
          <p className="text-muted-foreground text-lg">
            Empower Athene with your organization's knowledge by connecting your favorite integrations. You can always add more later.
          </p>
        </div>

        {/* Integration Picker */}
        <div className="bg-card border border-white/5 shadow-xl rounded-3xl p-6 space-y-8">
          {groupedProviders.map((group) => (
            <div key={group.key} className="space-y-4">
              <h3 className="text-xs font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-2">
                {group.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.providers.map((provider) => {
                  const isConnecting = connecting === provider.key;
                  const isConnected = connectedKeys.has(provider.key);

                  return (
                    <div
                      key={provider.key}
                      className={cn(
                        "group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                        isConnected 
                          ? "bg-accent/5 border-emerald-500/20" 
                          : "bg-white/5 border-white/10 hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                      )}
                      onClick={() => !isConnected && !isConnecting && handleConnect(provider)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 p-1.5 flex items-center justify-center">
                          <Image
                            src={provider.icon}
                            alt={provider.displayName}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-black text-foreground">
                            {provider.displayName}
                          </p>
                          <p className="text-[10px] font-medium text-muted-foreground/60 line-clamp-1 max-w-[150px]">
                            {provider.description}
                          </p>
                        </div>
                      </div>

                      {isConnected ? (
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 font-black text-[9px] uppercase tracking-widest text-emerald-400 border-emerald-400/20">
                          Active
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground group-hover:text-primary transition-colors"
                          disabled={!!connecting}
                        >
                          {isConnecting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Action Footer */}
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            onClick={() => router.push("/")}
            className="rounded-2xl px-12 h-14 font-black uppercase tracking-widest text-xs gap-3 glow-primary"
          >
            Enter Workspace
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        
      </div>
    </div>
  );
}

