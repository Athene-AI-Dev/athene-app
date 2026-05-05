"use client";

import { 
  FileText, 
  Upload, 
  Share2, 
  Trash2, 
  Download, 
  MoreVertical, 
  Search, 
  Filter, 
  Plus,
  HardDrive,
  Cloud,
  Layers,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

const FILES = [
  { name: "Q4_Revenue_Synthesis.pdf", type: "PDF", size: "12.4 MB", date: "2 mins ago", status: "Indexed", risk: "Low" },
  { name: "Board_Meeting_Transcript.docx", type: "DOCX", size: "450 KB", date: "1 hour ago", status: "Indexing", risk: "Medium" },
  { name: "Global_Infrastructure_Map.svg", type: "SVG", size: "2.1 MB", date: "4 hours ago", status: "Indexed", risk: "Low" },
  { name: "Employee_Records_V2.xlsx", type: "XLSX", size: "4.8 MB", date: "Yesterday", status: "Flagged", risk: "High" },
  { name: "Customer_Journey_Audit.pptx", type: "PPTX", size: "18.2 MB", date: "2 days ago", status: "Indexed", risk: "Low" },
  { name: "API_Security_Manual.pdf", type: "PDF", size: "1.1 MB", date: "3 days ago", status: "Indexed", risk: "Low" },
];

export default function FilesPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Page Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-[#D0D0CE] pb-10">
        <div className="space-y-4">
          <Badge className="bg-[#FDF2F7] text-[#D96FAB] border-none px-3 py-1 text-[10px] uppercase tracking-widest font-bold">
            Knowledge Base
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-[#0F0F0E]">
            Enterprise <span className="text-[#D96FAB]">Files</span>
          </h1>
          <p className="text-[#6B6B6B] text-lg max-w-xl font-medium leading-relaxed">
            Secure, centralized management of your organization's unstructured data repository.
          </p>
        </div>

        <div className="flex gap-4">
           <Button variant="outline" className="h-14 px-8 rounded-2xl border-[#D0D0CE] text-[#3D3D3A] font-bold uppercase tracking-widest text-[10px] gap-3 hover:bg-[#F9F9F8] transition-all">
              <Upload className="w-5 h-5 text-[#7AADCF]" />
              Upload Data
           </Button>
           <Button className="h-14 px-10 rounded-2xl bg-[#D96FAB] text-white hover:bg-[#ECA8CC] font-bold uppercase tracking-widest text-[10px] gap-3 shadow-lg shadow-pink-100 transition-all active:scale-95">
              <Plus className="w-5 h-5" />
              New Repository
           </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Sidebar Analytics */}
        <div className="space-y-10">
           <Card className="frosted-card p-10 space-y-8">
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#6B6B6B]">Storage Load</h3>
              <div className="space-y-8">
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                       <span className="flex items-center gap-2 text-[#3D3D3A]"><HardDrive className="w-4 h-4 text-[#7AADCF]" /> Capacity</span>
                       <span className="text-[#D96FAB]">84%</span>
                    </div>
                    <div className="h-2 w-full bg-[#F1F1F0] rounded-full overflow-hidden">
                       <div className="h-full bg-[#D96FAB] rounded-full" style={{ width: '84%' }} />
                    </div>
                 </div>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                       <span className="flex items-center gap-2 text-[#3D3D3A]"><Cloud className="w-4 h-4 text-[#7AADCF]" /> AI Sync</span>
                       <span className="text-emerald-500">Stable</span>
                    </div>
                    <div className="h-2 w-full bg-[#F1F1F0] rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 rounded-full" style={{ width: '22%' }} />
                    </div>
                 </div>
              </div>
           </Card>

           <div className="space-y-4 px-2">
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#6B6B6B]">Intelligence Layers</h3>
              <div className="space-y-2">
                 {[
                    { label: "Financial Records", count: 42, color: "text-emerald-500" },
                    { label: "Legal Discovery", count: 18, color: "text-amber-500" },
                    { label: "Internal Wiki", count: 124, color: "text-[#D96FAB]" },
                    { label: "Audit Logs", count: 56, color: "text-[#7AADCF]" },
                 ].map((cat, i) => (
                    <button key={i} className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-white border border-transparent hover:border-[#D0D0CE] hover:shadow-sm transition-all group text-left">
                       <span className="text-[13px] font-bold text-[#3D3D3A] group-hover:text-[#0F0F0E] flex items-center gap-3">
                          <Layers className={`w-4 h-4 ${cat.color}`} />
                          {cat.label}
                       </span>
                       <Badge className="bg-[#F9F9F8] text-[#6B6B6B] border-none text-[10px] font-bold group-hover:bg-[#FDF2F7] group-hover:text-[#D96FAB] transition-colors">{cat.count}</Badge>
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* File Table Content */}
        <div className="lg:col-span-3 space-y-8">
           <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-[#D0D0CE] shadow-sm">
              <div className="relative group w-80">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B6B6B] group-focus-within:text-[#D96FAB] transition-colors" />
                 <Input placeholder="Search organizational data..." className="h-12 pl-12 rounded-xl bg-[#F9F9F8] border-[#D0D0CE] text-[13px] focus:ring-[#D96FAB]/20" />
              </div>
              <div className="flex items-center gap-4">
                 <Button variant="ghost" className="h-12 px-6 rounded-xl text-[#3D3D3A] font-bold uppercase tracking-widest text-[10px] gap-2 hover:bg-[#FDF2F7] hover:text-[#D96FAB]">
                    <Filter className="w-4 h-4" />
                    Filters
                 </Button>
                 <div className="h-8 w-px bg-[#D0D0CE]" />
                 <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl hover:bg-[#EEF6FC] text-[#7AADCF]">
                    <Download className="w-5 h-5" />
                 </Button>
              </div>
           </div>

           <Card className="frosted-card overflow-hidden">
              <Table>
                 <TableHeader className="bg-[#F9F9F8]">
                    <TableRow className="border-[#D0D0CE]">
                       <TableHead className="px-10 py-6 text-[11px] font-bold uppercase tracking-widest text-[#6B6B6B]">Asset Name</TableHead>
                       <TableHead className="py-6 text-[11px] font-bold uppercase tracking-widest text-[#6B6B6B]">Size</TableHead>
                       <TableHead className="py-6 text-[11px] font-bold uppercase tracking-widest text-[#6B6B6B]">Status</TableHead>
                       <TableHead className="py-6 text-[11px] font-bold uppercase tracking-widest text-[#6B6B6B]">Risk Profile</TableHead>
                       <TableHead className="py-6 text-[11px] font-bold uppercase tracking-widest text-[#6B6B6B] text-right pr-10">Actions</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {FILES.map((file, i) => (
                       <TableRow key={i} className="border-[#D0D0CE] hover:bg-[#F9F9F8] transition-all group">
                          <TableCell className="px-10 py-6">
                             <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center border border-[#D0D0CE] shadow-sm group-hover:scale-105 transition-transform">
                                   <FileText className={`w-5 h-5 ${
                                      file.type === 'PDF' ? 'text-[#D96FAB]' :
                                      file.type === 'XLSX' ? 'text-emerald-500' :
                                      file.type === 'DOCX' ? 'text-[#5290B8]' :
                                      'text-[#7AADCF]'
                                   }`} />
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-[14px] font-bold text-[#0F0F0E] group-hover:text-[#D96FAB] transition-colors">{file.name}</span>
                                   <span className="text-[11px] font-medium text-[#6B6B6B] mt-0.5">{file.date}</span>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="text-[13px] font-bold text-[#3D3D3A]">{file.size}</TableCell>
                          <TableCell>
                             <Badge className={`text-[10px] font-bold tracking-widest px-3 py-1 h-6 border-none ${
                                file.status === 'Indexed' ? 'bg-emerald-100 text-emerald-700' :
                                file.status === 'Indexing' ? 'bg-[#FDF2F7] text-[#D96FAB] animate-pulse' :
                                'bg-rose-100 text-rose-700'
                             }`}>
                                {file.status}
                             </Badge>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-2.5">
                                <div className={`h-2.5 w-2.5 rounded-full ${
                                   file.risk === 'Low' ? 'bg-emerald-500' :
                                   file.risk === 'Medium' ? 'bg-amber-500' : 'bg-rose-600'
                                }`} />
                                <span className="text-[12px] font-bold text-[#3D3D3A]">{file.risk} Profile</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-10">
                             <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TooltipProvider>
                                   <Tooltip>
                                      <TooltipTrigger asChild>
                                         <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-[#EEF6FC] hover:text-[#5290B8]">
                                            <Share2 className="w-5 h-5" />
                                         </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-[#0F0F0E] text-white border-none text-[10px] font-bold uppercase tracking-widest">Share Resource</TooltipContent>
                                   </Tooltip>
                                </TooltipProvider>
                                
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-rose-50 hover:text-rose-600">
                                   <Trash2 className="w-5 h-5" />
                                </Button>
                             </div>
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </Card>
           
           <div className="flex items-center justify-center py-10">
              <Button variant="link" className="text-[#6B6B6B] hover:text-[#D96FAB] text-[11px] font-bold uppercase tracking-widest gap-2 group decoration-none">
                 Browse Full Archive
                 <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
