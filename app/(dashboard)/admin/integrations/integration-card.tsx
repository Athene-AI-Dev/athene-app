"use client";

import { useState } from "react";
import Image from "next/image";
import { 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  Trash2, 
  Blocks,
  Loader2
} from "lucide-react";

export interface Integration {
  connectionId: string;
  provider: string;
  displayName: string;
  category: string;
  resources: string[];
  status: "connected" | "syncing" | "error";
  createdAt: string | null;
}

interface IntegrationCardProps {
  integration: Integration;
  icon: string;
  description: string;
  onDisconnect: (integration: Integration) => void;
  onIndex: (integration: Integration) => Promise<void>;
}

export function IntegrationCard({ 
  integration, 
  icon, 
  description, 
  onDisconnect,
  onIndex 
}: IntegrationCardProps) {
  const [indexing, setIndexing] = useState(false);

  const handleIndex = async () => {
    setIndexing(true);
    try {
      await onIndex(integration);
    } finally {
      setIndexing(false);
    }
  };

  const statusStyles = {
    connected: "text-emerald-700 bg-emerald-50 border-emerald-200",
    syncing: "text-blue-700 bg-blue-50 border-blue-200",
    error: "text-amber-700 bg-amber-50 border-amber-200",
  };

  const statusIcons = {
    connected: <CheckCircle2 className="w-3 h-3" />,
    syncing: <RefreshCw className="w-3 h-3 animate-spin" />,
    error: <AlertCircle className="w-3 h-3" />,
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col group hover:border-blue-300 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-lg bg-white border border-slate-100 p-1 flex items-center justify-center overflow-hidden">
            <Image
              src={icon}
              alt={integration.displayName}
              width={36}
              height={36}
              className="object-contain"
              fallback={
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                  <Blocks className="w-4 h-4 text-slate-400" />
                </div>
              }
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {integration.displayName}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[140px]">
              {integration.connectionId}
            </p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusStyles[integration.status]}`}>
          {statusIcons[integration.status]}
          {integration.status === 'connected' ? 'Live' : integration.status}
        </span>
      </div>

      <p className="text-[11px] text-slate-500 line-clamp-2 mb-4">
        {description}
      </p>

      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={handleIndex}
          disabled={indexing}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
        >
          {indexing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Sync Now
        </button>
        
        <button
          onClick={() => onDisconnect(integration)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Disconnect"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
