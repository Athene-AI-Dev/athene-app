'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Search } from 'lucide-react';

export default function AuditPage() {
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAuditLogs();
    }, []);

    const fetchAuditLogs = async () => {
        try {
            const res = await fetch('/api/admin/bi-audit');
            if (res.ok) setAuditLogs(await res.json());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                    BI Access Audit Ledger
                    <Activity className="w-6 h-6 text-slate-400" />
                </h1>
                <p className="text-slate-500 mt-2">
                    Detailed record of all cross-department Business Intelligence data accesses.
                </p>
            </div>

            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
                            <Activity className="w-4 h-4" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">Access History</h2>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Filter audit logs..." 
                            className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/30">
                                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User ID</th>
                                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Analytical Query</th>
                                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source Doc</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-400">Loading audit records...</td>
                                </tr>
                            ) : auditLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">No cross-department access events recorded yet.</td>
                                </tr>
                            ) : (
                                auditLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm font-mono text-slate-500 text-xs">{log.user_id}</td>
                                        <td className="px-6 py-4 text-sm text-slate-900 max-w-[300px] truncate" title={log.query}>{log.query}</td>
                                        <td className="px-6 py-4 text-sm font-mono text-slate-500 text-xs">{log.doc_id || 'System'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
