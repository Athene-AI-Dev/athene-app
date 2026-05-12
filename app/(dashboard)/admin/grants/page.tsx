'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Key, 
  List, 
  Trash2, 
  ShieldCheck, 
  Lock, 
  FileText, 
  Folder,
  Loader2,
  AlertCircle,
  Plus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function GrantsPage() {
    const [grants, setGrants] = useState<any[]>([]);
    const [resourceId, setResourceId] = useState('');
    const [resourceType, setResourceType] = useState('document');
    const [loading, setLoading] = useState(true);
    const [isGranting, setIsGranting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchGrants();
    }, []);


    const fetchGrants = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/bi-grants');
            if (res.ok) {
                const data = await res.json();
                setGrants(data);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load active grants");
        } finally {
            setLoading(false);
        }
    };

    const handleGrant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resourceId.trim()) return;
        
        setIsGranting(true);
        try {
            const res = await fetch('/api/admin/bi-grants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resource_id: resourceId, resource_type: resourceType })
            });
            
            if (res.ok) {
                setResourceId('');
                toast.success("BI access granted successfully");
                fetchGrants();
            } else {
                const error = await res.json();
                toast.error(error.error || 'Failed to grant access');
            }
        } catch (err) {
            toast.error('Error granting access');
        } finally {
            setIsGranting(false);
        }
    };

    const revokeGrant = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/bi-grants/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Grant revoked");
                fetchGrants();
            } else {
                toast.error('Failed to revoke grant');
            }
        } catch (err) {
            toast.error('Error revoking grant');
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-['Space_Grotesk']">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-white/5">
                            <Lock className="w-7 h-7 text-emerald-400" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter text-white">
                            BI <span className="text-emerald-400">Grants</span>
                        </h1>
                    </div>
                    <p className="text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
                        Explicitly authorize cross-department access for specific documents and folders.
                        These overrides bypass standard RLS for Super Users.
                    </p>
                </div>
                
                <div className="flex flex-col items-end mr-4 hidden sm:flex">
                    <span className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1">Active Grants</span>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold text-white">{grants.length} Managed Resources</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-10">
                {/* Grant BI Access Form */}
                <Card className="bg-white/5 border-white/5 rounded-[2.5rem] p-10 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -z-10" />
                    
                    <div className="flex items-center gap-4 mb-10">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <Key className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-white tracking-tight">Authorize Resource</h2>
                    </div>

                    <form onSubmit={handleGrant} className="flex flex-col lg:flex-row gap-6 items-end">
                        <div className="w-full lg:w-48 space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Type</label>
                            <Select value={resourceType} onValueChange={setResourceType}>
                                <SelectTrigger className="h-14 bg-black/40 border-white/10 rounded-2xl text-white font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0c1015] border-white/10 text-white rounded-xl">
                                    <SelectItem value="document">Document</SelectItem>
                                    <SelectItem value="folder">Folder</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 w-full space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Resource UUID</label>
                            <div className="relative group">
                                <Input
                                    value={resourceId}
                                    onChange={(e) => setResourceId(e.target.value)}
                                    placeholder="00000000-0000-0000-0000-000000000000"
                                    className="h-14 bg-black/40 border-white/10 rounded-2xl pl-12 text-white font-mono text-sm focus:border-emerald-500/50 transition-all"
                                />
                                {resourceType === 'document' ? (
                                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-emerald-400" />
                                ) : (
                                    <Folder className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-emerald-400" />
                                )}
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={isGranting || !resourceId.trim()}
                            className="h-14 px-10 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-widest text-[11px] gap-3 shadow-xl shadow-emerald-500/10 disabled:opacity-50"
                        >
                            {isGranting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Grant Access
                        </Button>
                    </form>
                </Card>

                {/* Active BI Grants */}
                <div className="rounded-[2.5rem] bg-white/5 border border-white/5 overflow-hidden backdrop-blur-sm">
                    <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                                <List className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-black text-white tracking-tight">Access Registry</h2>
                        </div>
                    </div>
                    
                    <Table>
                        <TableHeader className="bg-white/5 border-b border-white/5">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="py-6 px-10 text-[10px] font-black uppercase tracking-widest text-slate-500">Resource</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Identity UUID</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Authorization Date</TableHead>
                                <TableHead className="text-right py-6 px-10"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i} className="border-white/5">
                                        <TableCell colSpan={4} className="py-12 px-10"><Loader2 className="w-6 h-6 animate-spin text-slate-800 mx-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : grants.length === 0 ? (
                                <TableRow className="border-white/5">
                                    <TableCell colSpan={4} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-20">
                                            <ShieldCheck className="w-16 h-16 text-slate-400" />
                                            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No explicit grants registered</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                grants.map((g) => (
                                    <TableRow key={g.grant_id} className="hover:bg-white/[0.02] border-white/5 group transition-colors">
                                        <TableCell className="py-6 px-10">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 shadow-sm",
                                                    g.resource_type === 'document' ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"
                                                )}>
                                                    {g.resource_type === 'document' ? <FileText className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                                                </div>
                                                <span className="font-black text-sm text-white tracking-tight capitalize">{g.resource_type}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-slate-500">{g.resource_id}</TableCell>
                                        <TableCell className="text-xs font-bold text-slate-400">
                                            {mounted ? new Date(g.granted_at).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : '---'}
                                        </TableCell>

                                        <TableCell className="text-right py-6 px-10">
                                            <Button
                                                onClick={() => revokeGrant(g.grant_id)}
                                                variant="ghost"
                                                className="h-10 px-4 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-400/10 gap-2 font-bold text-xs uppercase tracking-widest transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Revoke
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
