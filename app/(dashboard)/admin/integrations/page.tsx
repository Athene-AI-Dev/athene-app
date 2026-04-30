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
} from "lucide-react";
import Nango from "@nangohq/frontend";
import { IntegrationCard, type Integration } from "./integration-card";
import { AddIntegrationDialog } from "./add-integration-dialog";

import { ProviderConfig, getProvider } from "@/lib/integrations/providers";

// ─── Main Page ────────────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <WifiOff className="w-5 h-5 text-red-500" />
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Disconnect {providerName}?
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          This will remove the OAuth connection and stop all future syncs.
          Already-indexed data is not deleted.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null); 
  const [disconnecting, setDisconnecting] = useState<Integration | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Fetch active integrations ──────────────────────────────────────────────
  const fetchIntegrations = useCallback(async () => {
    try {
      // ✅ Fix: Use the admin-enforced API route
      const res = await fetch("/api/admin/integrations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setIntegrations(json.integrations ?? []);
      setError(null);
    } catch (e: any) {
      setError("Failed to load integrations. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // ── Auto-dismiss toast ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Connect via Nango ──────────────────────────────────────────────────────
  const handleConnect = useCallback(async (provider: ProviderConfig) => {
    setConnecting(provider.key);
    try {
      const sessionRes = await fetch("/api/nango/session", { method: "POST" });
      if (!sessionRes.ok) throw new Error("Failed to create session");
      const { token } = await sessionRes.json();

      const nango = new Nango({ connectSessionToken: token });

      await nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "close") {
            setConnecting(null);
          }
          if (event.type === "connect") {
            // ✅ Fix ATH-32: Save connection to Supabase
            const saveRes = await fetch("/api/admin/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                connectionId: event.connectionId,
                provider: provider.key,
              }),
            });

            if (!saveRes.ok) {
              setToast({ msg: `Authenticated but failed to save: ${saveRes.statusText}`, type: "error" });
            } else {
              setToast({ msg: `${provider.displayName} connected and saved successfully.`, type: "success" });
              fetchIntegrations();
              setShowAddDialog(false);
            }
            setConnecting(null);
          }
        },
      });
    } catch (e: any) {
      setToast({ msg: `Failed to connect ${provider.displayName}: ${e.message}`, type: "error" });
      setConnecting(null);
    }
  }, [fetchIntegrations]);

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    if (!disconnecting) return;
    setDisconnectLoading(true);
    try {
      // ✅ Fix: Use the admin-enforced API route with JSON body
      const res = await fetch("/api/admin/integrations", { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: disconnecting.connectionId,
          provider: disconnecting.provider,
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const meta = getProvider(disconnecting.provider as any);
      setToast({ msg: `${meta?.displayName ?? "Integration"} disconnected.`, type: "success" });
      setIntegrations((prev) =>
        prev.filter((c) => c.connectionId !== disconnecting.connectionId)
      );
    } catch (e: any) {
      setToast({ msg: `Failed to disconnect: ${e.message}`, type: "error" });
    } finally {
      setDisconnectLoading(false);
      setDisconnecting(null);
    }
  }, [disconnecting]);

  // ── Trigger Manual Indexing ────────────────────────────────────────────────
  const handleIndex = useCallback(async (integration: Integration) => {
    try {
      const res = await fetch(`/api/admin/integrations/${integration.connectionId}/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: integration.provider }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      setToast({ 
        msg: `Indexing job started for ${integration.displayName}.`, 
        type: "success" 
      });
    } catch (e: any) {
      setToast({ msg: `Failed to start indexing: ${e.message}`, type: "error" });
      throw e;
    }
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const connectedKeys = new Set(integrations.map((i) => i.provider));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 duration-300 ${
            toast.type === "success"
              ? "bg-white border-emerald-200 text-emerald-800"
              : "bg-white border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          )}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Disconnect confirm dialog */}
      <ConfirmDialog
        open={!!disconnecting}
        providerName={getProvider(disconnecting?.provider as any)?.displayName ?? "this integration"}
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnecting(null)}
        loading={disconnectLoading}
      />

      {/* Add Integration Dialog */}
      <AddIntegrationDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        connectedKeys={connectedKeys}
        onConnect={handleConnect}
        connecting={connecting}
      />

      <div className="max-w-5xl mx-auto space-y-10 pb-12">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight flex items-center gap-2">
              Integrations
              <Blocks className="w-5 h-5 text-blue-600" />
            </h1>
            <p className="text-sm text-[var(--sidebar-text-secondary)] mt-1">
              Connect your enterprise tools so Athene AI can securely index and query your data.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span>{integrations.length} active {integrations.length === 1 ? "connection" : "connections"}</span>
            </div>
            <button
              onClick={() => setShowAddDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-blue-100"
            >
              <Plus className="w-4 h-4" />
              Add Integration
            </button>
          </div>
        </div>

        {/* ── Active Connections ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Connections
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 h-32 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : integrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 bg-white rounded-xl border border-dashed border-slate-200 text-center">
              <Blocks className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No integrations connected yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Connect a tool to start syncing your data.
              </p>
              <button
                onClick={() => setShowAddDialog(true)}
                className="mt-4 text-sm text-blue-600 font-medium hover:underline"
              >
                Browse Integrations →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((integration) => {
                const meta = getProvider(integration.provider as any);
                return (
                  <IntegrationCard
                    key={integration.connectionId}
                    integration={integration}
                    icon={meta?.icon ?? "/integrations/generic.svg"}
                    description={meta?.description ?? "Connected integration"}
                    onDisconnect={(i) => setDisconnecting(i)}
                    onIndex={handleIndex}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
