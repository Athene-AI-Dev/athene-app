"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Blocks,
  CheckCircle2,
  AlertCircle,
  X,
  Wifi,
  Loader2,
  Plus,
  WifiOff,
  Search,
  Filter,
} from "lucide-react";
import Nango from "@nangohq/frontend";
import { IntegrationCard, type Integration } from "./integration-card";
import { AddIntegrationDialog } from "./add-integration-dialog";
import { ProviderConfig, getProvider } from "@/lib/integrations/providers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function ConfirmDialog({
  open,
  providerName,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  providerName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-card border border-white/10 shadow-2xl p-8 max-w-sm w-full mx-4 rounded-[2rem] animate-in zoom-in-95 duration-300">
        <div className="flex items-start justify-between mb-6">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
            <WifiOff className="w-6 h-6 text-destructive" />
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full hover:bg-white/5">
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
        <h3 className="text-xl font-black text-foreground tracking-tight mb-2">
          Disconnect {providerName}?
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          This will revoke access for Athene AI and stop all future data synchronization.
          Already-indexed data will remain archived.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl border-white/10 hover:bg-white/5 font-bold"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-12 rounded-xl font-bold shadow-lg shadow-destructive/20"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [mounted, setMounted] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [disconnecting, setDisconnecting] = useState<Integration | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/integrations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setIntegrations(json.integrations ?? []);
      setError(null);
    } catch (e: any) {
      setError("Failed to load active system connectors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchIntegrations();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchIntegrations]);

  const handleConnect = useCallback(async (provider: ProviderConfig) => {
    setConnecting(provider.key);
    try {
      const sessionRes = await fetch("/api/nango/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!sessionRes.ok) throw new Error("Failed to secure Nango session");
      const { token } = await sessionRes.json();
      if (!token) throw new Error("Nango session token missing");

      const nango = new Nango({ connectSessionToken: token });

      nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "close") {
            setConnecting(null);
          }
          if (event.type === "connect") {
            const saveRes = await fetch("/api/admin/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                connectionId: (event as any).connectionId,
                provider: provider.key,
              }),
            });

            if (!saveRes.ok) {
              setToast({ msg: `Access granted, but metadata sync failed: ${saveRes.statusText}`, type: "error" });
            } else {
              setToast({ msg: `${provider.displayName} integrated successfully.`, type: "success" });
              fetchIntegrations();
              setShowAddDialog(false);
            }
            setConnecting(null);
          }
        },
      });
    } catch (e: any) {
      setToast({ msg: `Integration failed: ${e.message}`, type: "error" });
      setConnecting(null);
    }
  }, [fetchIntegrations]);

  const handleDisconnect = useCallback(async () => {
    if (!disconnecting) return;
    setDisconnectLoading(true);
    try {
      const res = await fetch("/api/admin/integrations", { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: disconnecting.connectionId as string,
          provider: disconnecting.provider,
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const meta = getProvider(disconnecting.provider as any);
      setToast({ msg: `${meta?.displayName ?? "Integration"} successfully removed.`, type: "success" });
      setIntegrations((prev) =>
        prev.filter((c) => c.connectionId !== disconnecting.connectionId)
      );
    } catch (e: any) {
      setToast({ msg: `Disconnection failed: ${e.message}`, type: "error" });
    } finally {
      setDisconnectLoading(false);
      setDisconnecting(null);
    }
  }, [disconnecting]);

  const handleIndex = useCallback(async (integration: Integration) => {
    try {
      const res = await fetch(`/api/admin/integrations/${integration.connectionId}/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: integration.provider }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      setToast({ 
        msg: `Knowledge indexing started for ${integration.displayName}.`, 
        type: "success" 
      });
    } catch (e: any) {
      setToast({ msg: `Manual sync failed: ${e.message}`, type: "error" });
    }
  }, []);

  const filteredIntegrations = integrations.filter(i => {
    const meta = getProvider(i.provider as any);
    const searchStr = (meta?.displayName || i.displayName || "").toLowerCase();
    return searchStr.includes(search.toLowerCase());
  });

  const connectedKeys = new Set(integrations.map((i) => i.provider));

  if (!mounted) return null;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-['Space_Grotesk']">
      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-10 right-10 z-[100] flex items-center gap-4 px-6 py-4 rounded-2xl border shadow-2xl animate-in slide-in-from-right-10 duration-500",
          toast.type === "success" ? "bg-accent/20 border-accent/30 text-accent" : "bg-destructive/10 border-destructive/30 text-destructive"
        )}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold text-sm tracking-tight">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
             <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!disconnecting}
        providerName={getProvider(disconnecting?.provider as any)?.displayName ?? "this system"}
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnecting(null)}
        loading={disconnectLoading}
      />

      <AddIntegrationDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        connectedKeys={connectedKeys}
        onConnect={handleConnect}
        connecting={connecting}
      />

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border shadow-lg">
              <Blocks className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase">
              System <span className="text-primary">Connectors</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl font-medium leading-relaxed">
            Manage your enterprise knowledge sources. Connect tools like SharePoint, 
            Google Drive, and Notion to empower Athene with contextual intelligence.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4 hidden sm:flex">
              <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/40 mb-1">Status</span>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/20 border border-border">
                <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-bold text-foreground tracking-tight">{integrations.length} Active Feeds</span>
              </div>
           </div>
           <Button 
            onClick={() => setShowAddDialog(true)}
            className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[11px] gap-3 shadow-xl shadow-primary/10 group"
           >
             <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
             Integrate Tool
           </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center p-2 rounded-2xl bg-muted/10 border border-border">
         <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter system connectors..." 
              className="w-full h-12 pl-12 pr-4 bg-transparent outline-none text-sm font-bold placeholder:text-muted-foreground/40 text-foreground"
            />
         </div>
         <Button variant="ghost" className="h-12 px-6 rounded-xl gap-2 text-muted-foreground font-black uppercase tracking-widest text-[10px] hover:bg-muted/50">
            <Filter className="w-4 h-4" />
            Categories
         </Button>
      </div>

      {/* Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-[2.5rem] bg-muted/20 border border-border animate-pulse" />
          ))
        ) : error ? (
          <div className="col-span-full py-20 text-center space-y-4 bg-muted/10 rounded-[3rem] border border-border">
             <AlertCircle className="w-12 h-12 text-destructive mx-auto opacity-20" />
             <p className="text-muted-foreground font-bold">{error}</p>
             <Button variant="outline" onClick={fetchIntegrations} className="rounded-xl border-border">Try Again</Button>
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center bg-muted/5 rounded-[3rem] border-2 border-dashed border-border text-center">
            <div className="w-20 h-20 rounded-3xl bg-muted/10 flex items-center justify-center mb-6">
              <Blocks className="w-10 h-10 text-muted-foreground/20" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-2">
              {search ? "No matches found" : "No Active Connectors"}
            </h3>
            <p className="text-muted-foreground max-w-sm font-medium">
              {search ? "Adjust your search parameters to find the connector you're looking for." : "Start by adding your first enterprise integration to build Athene's knowledge base."}
            </p>
            <Button 
              onClick={() => {
                if (search) setSearch("");
                else setShowAddDialog(true);
              }}
              className="mt-8 h-12 px-8 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold"
            >
              {search ? "Clear Search" : "Integrate Tool →"}
            </Button>
          </div>
        ) : (
          filteredIntegrations.map((integration) => {
            const meta = getProvider(integration.provider as any);
            return (
              <IntegrationCard
                key={integration.connectionId}
                integration={integration}
                icon={meta?.icon ?? "/integrations/generic.svg"}
                description={meta?.description ?? "Connected enterprise system."}
                onDisconnect={(i) => setDisconnecting(i)}
                onIndex={handleIndex}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

