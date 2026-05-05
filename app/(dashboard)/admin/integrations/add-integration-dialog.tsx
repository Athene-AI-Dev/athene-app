"use client";

import { useState } from "react";
import Image from "next/image";
import { 
  X, 
  Search, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  Blocks 
} from "lucide-react";

import { ProviderConfig, getAllProviders } from "@/lib/integrations/providers";

interface AddIntegrationDialogProps {
  open: boolean;
  onClose: () => void;
  connectedKeys: Set<string>;
  onConnect: (provider: ProviderConfig) => Promise<void>;
  connecting: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  productivity: "Productivity",
  crm: "CRM",
  devtools: "Dev Tools",
  communication: "Communication",
  data: "Data & Analytics",
};

export function AddIntegrationDialog({
  open,
  onClose,
  connectedKeys,
  onConnect,
  connecting
}: AddIntegrationDialogProps) {
  const [search, setSearch] = useState("");
  const providers = getAllProviders();

  if (!open) return null;

  const filteredProviders = providers.filter(
    (p) =>
      search === "" ||
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      CATEGORY_LABELS[p.category].toLowerCase().includes(search.toLowerCase())
  );

  const groupedProviders = Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => ({
    key: catKey,
    label: catLabel,
    providers: filteredProviders.filter((p) => p.category === catKey),
  })).filter((g) => g.providers.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Add Integration</h2>
            <p className="text-sm text-slate-500 mt-1">Connect your data sources to Athene AI</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search integrations by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {groupedProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-600">No integrations found</p>
              <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            groupedProviders.map((group) => (
              <div key={group.key} className="space-y-3">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {group.providers.map((provider) => {
                    const isConnecting = connecting === provider.key;
                    const isConnected = connectedKeys.has(provider.nangoIntegrationId);

                    return (
                      <div
                        key={provider.key}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 p-1.5 flex items-center justify-center shadow-sm">
                            <Image
                              src={provider.icon}
                              alt={provider.displayName}
                              width={40}
                              height={40}
                              className="object-contain"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {provider.displayName}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              {provider.description}
                            </p>
                          </div>
                        </div>

                        {isConnected ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Connected
                          </div>
                        ) : (
                          <button
                            onClick={() => onConnect(provider)}
                            disabled={!!connecting}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm shadow-blue-200 disabled:opacity-50 disabled:bg-slate-400"
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Connecting…
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                Connect
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
