"use client";
 
import { useState, useEffect } from "react";
import { 
  Activity, 
  Search, 
  Shield, 
  UserCircle, 
  History, 
  Database, 
  Filter,
  ArrowRight,
  UserCheck,
  UserMinus,
  UserPlus,
  Settings,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AuditPage() {
    const [biLogs, setBiLogs] = useState<any[]>([]);
    const [adminLogs, setAdminLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const [biRes, adminRes] = await Promise.all([
                    fetch('/api/admin/bi-audit'),
                    fetch('/api/admin/audit-log')
                ]);
                
                if (biRes.ok) setBiLogs(await biRes.json());
                if (adminRes.ok) setAdminLogs(await adminRes.json());
            } catch (e) {
                console.error("Failed to fetch audit logs", e);
            }
            setLoading(false);
        };
        fetchAll();
    }, []);

    const getActionIcon = (action: string) => {
      switch (action) {
        case 'invite_user': return <UserPlus className="w-4 h-4 text-emerald-400" />;
        case 'deactivate_user': return <UserMinus className="w-4 h-4 text-red-400" />;
        case 'reactivate_user': return <UserCheck className="w-4 h-4 text-blue-400" />;
        case 'change_role': return <Shield className="w-4 h-4 text-purple-400" />;
        default: return <Settings className="w-4 h-4 text-slate-400" />;
      }
    };

    const formatAction = (action: string) => {
      return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-['Space_Grotesk']">
            
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5">
                    <History className="w-7 h-7 text-purple-400" />
                  </div>
                  <h1 className="text-4xl font-black tracking-tighter text-white uppercase">
                    Audit <span className="text-purple-400">Ledger</span>
                  </h1>
                </div>
                <p className="text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
                  Transparent record of all administrative modifications and high-privilege analytical access within the organization.
                </p>
              </div>
            </div>

            <Tabs defaultValue="admin" className="space-y-8">
              <div className="flex flex-col sm:flex-row gap-6 items-center justify-between p-2 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                <TabsList className="bg-transparent border-none gap-2">
                  <TabsTrigger 
                    value="admin" 
                    className="h-11 px-6 rounded-xl data-[state=active]:bg-purple-500 data-[state=active]:text-white text-slate-400 font-bold transition-all gap-2"
                  >
                    <Shield className="w-4 h-4" /> Admin Actions
                  </TabsTrigger>
                  <TabsTrigger 
                    value="bi" 
                    className="h-11 px-6 rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400 font-bold transition-all gap-2"
                  >
                    <Activity className="w-4 h-4" /> BI Access
                  </TabsTrigger>
                </TabsList>

                <div className="relative flex-1 max-w-md group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition-colors group-focus-within:text-purple-400" />
                  <input 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search ledger..." 
                    className="w-full h-11 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl outline-none text-sm font-medium text-white placeholder:text-slate-600 focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>

              <TabsContent value="admin" className="mt-0 outline-none">
                <div className="rounded-[2.5rem] bg-white/5 border border-white/5 overflow-hidden backdrop-blur-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/5">
                        <tr>
                          <th className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Timestamp</th>
                          <th className="text-[10px] font-black uppercase tracking-widest text-slate-500">Administrator</th>
                          <th className="text-[10px] font-black uppercase tracking-widest text-slate-500">Action</th>
                          <th className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target User</th>
                          <th className="text-[10px] font-black uppercase tracking-widest text-slate-500">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {loading ? (
                          [...Array(3)].map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td colSpan={5} className="py-8 px-8 h-20 bg-white/[0.01]" />
                            </tr>
                          ))
                        ) : adminLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-20 text-center">
                              <div className="flex flex-col items-center gap-4 text-slate-500">
                                <AlertCircle className="w-10 h-10 opacity-20" />
                                <p className="font-bold">No administrative actions recorded yet.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          adminLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                              <td className="py-6 px-8 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-white">{new Date(log.performed_at).toLocaleDateString()}</span>
                                  <span className="text-[10px] text-slate-500 font-bold">{new Date(log.performed_at).toLocaleTimeString()}</span>
                                </div>
                              </td>
                              <td className="py-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-[10px] font-black text-purple-400 border border-purple-500/20">
                                    {log.admin?.full_name?.charAt(0) || log.admin?.email?.charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-white leading-none">{log.admin?.full_name}</span>
                                    <span className="text-[10px] text-slate-500 font-bold mt-1">{log.admin?.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-white/5 text-slate-300 border-white/10 rounded-lg px-2 py-1 gap-1.5 font-bold text-[10px]">
                                    {getActionIcon(log.action)}
                                    {formatAction(log.action)}
                                  </Badge>
                                </div>
                              </td>
                              <td className="py-6">
                                {log.target ? (
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-400 border border-white/5">
                                      {log.target?.full_name?.charAt(0) || log.target?.email?.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-black text-white leading-none">{log.target?.full_name}</span>
                                      <span className="text-[10px] text-slate-500 font-bold mt-1">{log.target?.email}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">System</span>
                                )}
                              </td>
                              <td className="py-6 pr-8">
                                <div className="max-w-xs overflow-hidden">
                                   <pre className="text-[9px] font-mono text-slate-500 truncate bg-black/20 p-2 rounded-lg">
                                     {JSON.stringify(log.details)}
                                   </pre>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bi" className="mt-0 outline-none">
                <div className="rounded-[2.5rem] bg-white/5 border border-white/5 overflow-hidden backdrop-blur-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/5">
                        <tr>
                          <th className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Timestamp</th>
                          <th className="text-[10px] font-black uppercase tracking-widest text-slate-500">Analyst ID</th>
                          <th className="text-[10px] font-black uppercase tracking-widest text-slate-500">Analytical Query</th>
                          <th className="text-[10px] font-black uppercase tracking-widest text-slate-500">Source Object</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {loading ? (
                          [...Array(3)].map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td colSpan={4} className="py-8 px-8 h-20 bg-white/[0.01]" />
                            </tr>
                          ))
                        ) : biLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-20 text-center">
                              <div className="flex flex-col items-center gap-4 text-slate-500">
                                <AlertCircle className="w-10 h-10 opacity-20" />
                                <p className="font-bold">No high-privilege access events recorded.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          biLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-6 px-8 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-white">{new Date(log.created_at || log.timestamp).toLocaleDateString()}</span>
                                  <span className="text-[10px] text-slate-500 font-bold">{new Date(log.created_at || log.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </td>
                              <td className="py-6">
                                <div className="flex items-center gap-2 font-mono text-[10px] text-blue-400 bg-blue-400/5 px-2 py-1 rounded-lg border border-blue-400/10 w-fit">
                                  <UserCircle className="w-3 h-3" />
                                  {log.user_id.slice(0, 8)}...
                                </div>
                              </td>
                              <td className="py-6">
                                <p className="text-xs font-medium text-slate-300 max-w-md line-clamp-2 leading-relaxed">
                                  {log.query}
                                </p>
                              </td>
                              <td className="py-6 pr-8">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                  <Database className="w-3 h-3" />
                                  {log.doc_id || "Cross-Department Synthesizer"}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
        </div>
    );
}
