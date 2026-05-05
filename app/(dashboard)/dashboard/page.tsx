"use client";

import { 
  Activity, 
  FileText, 
  Users, 
  Zap, 
  Plus, 
  Search, 
  MoreHorizontal, 
  ArrowUpRight,
  ShieldCheck,
  Globe,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

const STATS = [
  { label: "Active Agents", value: "12", icon: Users, trend: "+2 this week", color: "text-[#D96FAB]" },
  { label: "Processed Files", value: "1,284", icon: FileText, trend: "+124 today", color: "text-[#7AADCF]" },
  { label: "System Health", value: "99.9%", icon: Activity, trend: "Stable", color: "text-emerald-500" },
  { label: "AI Throughput", value: "84ms", icon: Zap, trend: "-12ms vs avg", color: "text-[#5290B8]" },
];

const RECENT_AGENTS = [
  { name: "BI Analyst Pro", status: "Active", uptime: "14d 2h", throughput: "1.2k req/h", load: "24%" },
  { name: "Legal Discovery", status: "Active", uptime: "2d 5h", throughput: "482 req/h", load: "12%" },
  { name: "Customer Synth", status: "Standby", uptime: "0d 0h", throughput: "0 req/h", load: "0%" },
  { name: "Notion Sync Bot", status: "Syncing", uptime: "1h 12m", throughput: "8.4k docs", load: "88%" },
];

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      {/* Hero Section (Gradient Exception) */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#D96FAB] via-[#ECA8CC] to-[#7AADCF] p-12 shadow-xl shadow-pink-100/50">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 blur-[100px] -z-10 translate-x-1/4 -translate-y-1/4 rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="space-y-6">
            <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest">
               Enterprise Intelligence
            </Badge>
            <div className="space-y-2">
               <h1 className="text-4xl lg:text-6xl font-black tracking-tight text-white leading-tight">
                  Synthesis <br /><span className="text-white/80">Command Hub</span>
               </h1>
            </div>
            <p className="text-white/90 text-lg max-w-xl font-medium leading-relaxed">
              Real-time monitoring and management of your autonomous intelligence fleet across the organization.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
             <Button className="h-14 px-10 rounded-2xl bg-white text-[#D96FAB] hover:bg-[#FDF2F7] font-black uppercase tracking-widest text-[11px] gap-3 shadow-lg transition-all active:scale-95">
                <Plus className="w-5 h-5" />
                Deploy Agent
             </Button>
             <Button className="h-14 px-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/30 text-white hover:bg-white/20 font-black uppercase tracking-widest text-[11px] transition-all">
                Search Fleet
             </Button>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {STATS.map((stat, i) => (
          <Card key={i} className={`frosted-card group hover:border-[#D96FAB]/30 transition-all duration-300 stagger-${i+1}`}>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className={`p-4 rounded-2xl bg-accent/40 border border-white/5 ${stat.color} transition-transform group-hover:scale-110`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <Badge variant="ghost" className="text-[11px] font-bold text-muted-foreground/60">
                   {stat.trend}
                </Badge>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground/40 mb-2">{stat.label}</p>
                <p className="text-3xl font-black text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Active Agents Table */}
        <Card className="lg:col-span-2 frosted-card overflow-hidden">
          <CardHeader className="p-10 pb-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black tracking-tight text-foreground">Intelligence Fleet</CardTitle>
              <p className="text-[12px] text-muted-foreground/60 font-bold uppercase tracking-widest mt-2">Live Deployment Metrics</p>
            </div>
            <div className="relative group w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <Input placeholder="Filter agents..." className="h-11 pl-11 rounded-xl bg-background/50 border-white/5 text-[12px] focus:ring-[#D96FAB]/20" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-accent/20">
                <TableRow className="border-white/5">
                  <TableHead className="px-10 py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40">Identity</TableHead>
                  <TableHead className="py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40">Status</TableHead>
                  <TableHead className="py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40">Uptime</TableHead>
                  <TableHead className="py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 text-right pr-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_AGENTS.map((agent, i) => (
                  <TableRow key={i} className="border-white/5 hover:bg-[#D96FAB]/5 transition-colors group">
                    <TableCell className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-accent/40 flex items-center justify-center border border-white/5">
                           <ShieldCheck className="w-5 h-5 text-[#5290B8]" />
                        </div>
                        <span className="text-[14px] font-bold text-foreground">{agent.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] font-bold tracking-widest px-3 py-1 h-6 border-none ${
                        agent.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                        agent.status === 'Syncing' ? 'bg-[#D96FAB]/10 text-[#D96FAB]' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[13px] font-medium text-muted-foreground/80">{agent.uptime}</TableCell>
                    <TableCell className="text-right pr-10">
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-[#D96FAB] hover:bg-[#D96FAB]/10">
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Quick Insights / Actions */}
        <div className="space-y-10">
           <Card className="frosted-card p-10 space-y-8">
              <h3 className="text-[12px] uppercase tracking-[0.2em] font-bold text-muted-foreground/60">System Integrity</h3>
              <div className="space-y-8">
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                       <span className="flex items-center gap-2 text-foreground/80"><Globe className="w-4 h-4 text-[#7AADCF]" /> API Latency</span>
                       <span className="text-[#D96FAB]">Optimal</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-[#D96FAB] rounded-full" style={{ width: '92%' }} />
                    </div>
                 </div>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                       <span className="flex items-center gap-2 text-foreground/80"><Clock className="w-4 h-4 text-[#7AADCF]" /> Sync Frequency</span>
                       <span className="text-[#5290B8]">High Load</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-[#7AADCF] rounded-full" style={{ width: '78%' }} />
                    </div>
                 </div>
              </div>
           </Card>

           <Card className="bg-[#EEF6FC]/10 border border-[#C2DCF0]/20 p-10 rounded-[2.5rem] text-foreground space-y-6 shadow-sm">
              <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center shadow-sm border border-white/5">
                 <Zap className="w-7 h-7 text-[#5290B8]" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black tracking-tight text-foreground">Scale Synthesis</h3>
                 <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
                    Unleash more concurrent agents and priority indexing. Upgrade to the Enterprise Suite today.
                 </p>
              </div>
              <Button className="w-full bg-[#D96FAB] text-white hover:bg-[#ECA8CC] font-bold uppercase tracking-widest text-[11px] h-14 rounded-2xl shadow-lg shadow-pink-900/20 transition-all active:scale-95">
                 Get Started
                 <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
           </Card>
        </div>
      </div>
    </div>
  );
}
