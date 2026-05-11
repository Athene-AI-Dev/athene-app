"use client";
import { Database } from "lucide-react";

export default function DataSourcesPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Data Sources</h1>
          <p className="text-sm text-slate-500">Connected sources indexed by Athene.</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">No data sources connected yet.</p>
      </div>
    </div>
  );
}