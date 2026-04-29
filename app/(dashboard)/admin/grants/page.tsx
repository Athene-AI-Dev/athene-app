'use client';

import React, { useState, useEffect } from 'react';
import { Key, List, Trash2, ShieldCheck } from 'lucide-react';

export default function GrantsPage() {
    const [grants, setGrants] = useState<any[]>([]);
    const [resourceId, setResourceId] = useState('');
    const [resourceType, setResourceType] = useState('document');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchGrants();
    }, []);

    const fetchGrants = async () => {
        try {
            const res = await fetch('/api/admin/bi-grants');
            if (res.ok) setGrants(await res.json());
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
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                    BI Access Management
                    <ShieldCheck className="w-6 h-6 text-slate-400" />
                </h1>
                <p className="text-slate-500 mt-2">
                    Manage cross-department BI accessibility for documents and folders.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Grant BI Access Form */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md shrink-0">
                            <Key className="w-4 h-4" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">Grant New Access</h2>
                    </div>
                    <form onSubmit={handleGrant} className="p-6 flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-900 mb-1.5">Resource Type</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={resourceType}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setResourceType(e.target.value)}
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResourceId(e.target.value)}
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
            </div>
        </div>
    );
}
