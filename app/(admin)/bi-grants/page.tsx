'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, List, Activity, Trash2 } from 'lucide-react';

export default function BIGrantsPage() {
    const [grants, setGrants] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [resourceId, setResourceId] = useState('');
    const [resourceType, setResourceType] = useState('document');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchGrants();
        fetchAuditLogs();
    }, []);

    const fetchGrants = async () => {
        try {
            const res = await fetch('/api/admin/bi-grants');
            if (res.ok) setGrants(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const res = await fetch('/api/admin/bi-audit');
            if (res.ok) setAuditLogs(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const handleGrant = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/admin/bi-grants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resource_id: resourceId, resource_type: resourceType })
            });
            if (res.ok) {
                setResourceId('');
                fetchGrants();
            } else {
                alert('Failed to grant access');
            }
        } catch (err) {
            alert('Error granting access');
        }
        setLoading(false);
    };

    const revokeGrant = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/bi-grants/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchGrants();
            } else {
                alert('Failed to revoke grant');
            }
        } catch (err) {
            alert('Error revoking grant');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
            
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                    BI Access Administration
                    <ShieldCheck className="w-5 h-5 text-slate-500" />
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Manage cross-department BI accessibility and view audit logs.
                </p>
            </div>

            <div className="space-y-6">

                {/* Grant BI Access Form */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md shrink-0">
                            <Key className="w-4 h-4" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">Grant BI Access</h2>
                    </div>
                    <form onSubmit={handleGrant} className="p-6 flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-900 mb-1.5">Resource Type</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={resourceType}
                                onChange={(e) => setResourceType(e.target.value)}
                            >
                                <option value="document">Document</option>
                                <option value="folder">Folder</option>
                            </select>
                        </div>
                        <div className="flex-[3] w-full">
                            <label className="block text-sm font-medium text-slate-900 mb-1.5">Resource ID</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="Enter UUID of document or folder"
                                value={resourceId}
                                onChange={(e) => setResourceId(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
                        >
                            {loading ? 'Granting...' : 'Grant Access'}
                        </button>
                    </form>
                </section>

                {/* Active BI Grants */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md shrink-0">
                            <List className="w-4 h-4" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">Active BI Grants</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/30">
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resource ID</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Granted At</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {grants.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">No active grants found</td>
                                    </tr>
                                ) : (
                                    grants.map((g) => (
                                        <tr key={g.grant_id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-900 capitalize">{g.resource_type}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-600">{g.resource_id}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{new Date(g.granted_at).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => revokeGrant(g.grant_id)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium rounded transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Revoke
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* BI Access Audit Log */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md shrink-0">
                            <Activity className="w-4 h-4" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">BI Access Audit Log</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/30">
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User ID</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Query</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Doc ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {auditLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">No audit logs found</td>
                                    </tr>
                                ) : (
                                    auditLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-600">{log.user_id}</td>
                                            <td className="px-6 py-4 text-sm text-slate-900 max-w-[200px] truncate" title={log.query}>{log.query}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-600">{log.doc_id || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

            </div>
        </div>
    );
}
