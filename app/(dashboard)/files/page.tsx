"use client";

import { useRef, useState } from "react";
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
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { toast } from "sonner";

const INITIAL_FILES = [
  { name: "Q4_Revenue_Synthesis.pdf", type: "PDF", size: "12.4 MB", date: "2 mins ago", status: "Indexed", risk: "Low" },
  { name: "Board_Meeting_Transcript.docx", type: "DOCX", size: "450 KB", date: "1 hour ago", status: "Indexing", risk: "Medium" },
  { name: "Global_Infrastructure_Map.svg", type: "SVG", size: "2.1 MB", date: "4 hours ago", status: "Indexed", risk: "Low" },
  { name: "Employee_Records_V2.xlsx", type: "XLSX", size: "4.8 MB", date: "Yesterday", status: "Flagged", risk: "High" },
  { name: "Customer_Journey_Audit.pptx", type: "PPTX", size: "18.2 MB", date: "2 days ago", status: "Indexed", risk: "Low" },
  { name: "API_Security_Manual.pdf", type: "PDF", size: "1.1 MB", date: "3 days ago", status: "Indexed", risk: "Low" },
];

const MIME_TYPES: Record<string, string> = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  SVG: "image/svg+xml",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  JSON: "application/json",
};

export default function FilesPage() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const fileList = Array.from(selected);
    e.target.value = "";

    for (const file of fileList) {
      const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
      const sizeMB = file.size / (1024 * 1024);
      const sizeStr = sizeMB >= 1 ? `${sizeMB.toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`;

      const placeholder = {
        name: file.name,
        type: ext,
        size: sizeStr,
        date: "Just now",
        status: "Uploading" as string,
        risk: "Low" as string,
      };
      setFiles((prev) => [placeholder, ...prev]);

      try {
        const body = new FormData();
        body.append("file", file);

        const res = await fetch("/api/files/upload", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name && f.status === "Uploading"
              ? { ...f, status: "Indexing", date: "Just now", storagePath: data.storagePath }
              : f
          )
        );
        toast.success(`Uploaded ${file.name}`, {
          icon: <Upload className="w-4 h-4" />,
          description: "File stored and queued for indexing.",
        });
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name && f.status === "Uploading"
              ? { ...f, status: "Flagged" }
              : f
          )
        );
        toast.error(`Failed to upload ${file.name}`, {
          description: err.message,
        });
      }
    }
  };

  const handleNewRepo = () => {
    toast.success("New Knowledge Repository Created", {
      description: "Default RBAC policies applied to #RE-882",
    });
  };

  const handleDelete = (name: string) => {
    setFiles(prev => prev.filter(f => f.name !== name));
    toast.error(`Purged asset: ${name}`, {
      description: "Data removed from Knowledge Graph indexing.",
    });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

 const handleDownload = async (name: string) => {
    const file = files.find((item) => item.name === name) as any;
    toast(`Downloading ${name}...`);

    if (file?.storagePath) {
      const res = await fetch(`/api/files/download?path=${encodeURIComponent(file.storagePath)}`);
      if (res.ok) {
        const blob = await res.blob();
        downloadBlob(blob, name);
        toast.success(`Downloaded ${name}`);
        return;
      }
    }

    // Fallback for dummy files
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    downloadBlob(blob, name);
    toast.success(`Downloaded ${name}`);
  };

  const handleBulkDownload = () => {
    const blob = new Blob(
      [JSON.stringify(filteredFiles, null, 2)],
      { type: "application/json" }
    );

    downloadBlob(blob, "athene-data-sources.json");
    toast.success("Downloaded data sources archive", {
      icon: <Download className="w-4 h-4" />,
    });
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.json,.svg,.txt"
        className="hidden"
        onChange={handleFileSelected}
      />
      {/* Page Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
        <div className="space-y-4">
          <Badge className="bg-[#66ADE4]/10 text-[#66ADE4] border-none px-3 py-1 text-[10px] uppercase tracking-widest font-bold">
            Knowledge Base
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white">
            Enterprise <span className="text-[#66ADE4]">Files</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl font-medium leading-relaxed">
            Secure, centralized management of your organization's unstructured data repository.
          </p>
        </div>

        <div className="flex gap-4">
           <Button 
            onClick={handleUpload}
            variant="outline" className="h-14 px-8 rounded-2xl border-white/10 text-slate-300 font-bold uppercase tracking-widest text-[10px] gap-3 hover:bg-white/5 transition-all">
              <Upload className="w-5 h-5 text-[#66ADE4]" />
              Upload Data
           </Button>
           <button 
            onClick={handleNewRepo}
            className="h-14 px-10 rounded-2xl bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] text-white font-bold uppercase tracking-widest text-[10px] gap-3 shadow-lg shadow-blue-500/10 transition-all active:scale-95 flex items-center justify-center relative overflow-visible">
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-[#06080c] bg-white flex items-center justify-center shadow-lg">
                 <img src="/logo.png" alt="Logo" className="w-4 h-4 object-contain" />
              </div>
              <span className="ml-4">New Repository</span>
           </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Sidebar Analytics */}
        <div className="space-y-10">
           <Card className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 space-y-8 rounded-[2rem]">
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500">Storage Load</h3>
              <div className="space-y-8">
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                       <span className="flex items-center gap-2 text-slate-300"><HardDrive className="w-4 h-4 text-[#66ADE4]" /> Capacity</span>
                       <span className="text-[#66ADE4]">84%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-[#66ADE4]" style={{ width: '84%' }} />
                    </div>
                 </div>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                       <span className="flex items-center gap-2 text-slate-300"><Cloud className="w-4 h-4 text-[#66ADE4]" /> AI Sync</span>
                       <span className="text-emerald-500">Stable</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500" style={{ width: '100%' }} />
                    </div>
                 </div>
              </div>
           </Card>

           <div className="space-y-4 px-2">
              <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500">Intelligence Layers</h3>
              <div className="space-y-2">
                 {[
                    { label: "Financial Records", count: 42, color: "text-emerald-500" },
                    { label: "Legal Discovery", count: 18, color: "text-amber-500" },
                    { label: "Internal Wiki", count: 124, color: "text-[#66ADE4]" },
                    { label: "Audit Logs", count: 56, color: "text-[#66ADE4]" },
                 ].map((cat, i) => (
                    <button key={i} className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group text-left">
                       <span className="text-[13px] font-bold text-slate-400 group-hover:text-white flex items-center gap-3">
                          <Layers className={`w-4 h-4 ${cat.color}`} />
                          {cat.label}
                       </span>
                       <Badge className="bg-white/5 text-slate-500 border-none text-[10px] font-bold group-hover:text-[#66ADE4] transition-colors">{cat.count}</Badge>
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* File Table Content */}
        <div className="lg:col-span-3 space-y-8">
           <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-sm">
              <div className="relative group w-80">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 group-focus-within:text-[#66ADE4] transition-colors" />
                 <Input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search organizational data..." className="h-12 pl-12 rounded-xl bg-black/20 border-white/5 text-[13px] text-white focus:ring-[#66ADE4]/20 placeholder:text-slate-600" />
              </div>
              <div className="flex items-center gap-4">
                 <Button variant="ghost" className="h-12 px-6 rounded-xl text-slate-400 font-bold uppercase tracking-widest text-[10px] gap-2 hover:bg-white/5 hover:text-white">
                    <Filter className="w-4 h-4" />
                    Filters
                 </Button>
                 <div className="h-8 w-px bg-white/10" />
                 <Button 
                  onClick={handleBulkDownload}
                  variant="ghost" size="icon" className="h-12 w-12 rounded-xl hover:bg-[#66ADE4]/10 text-[#66ADE4]">
                    <Download className="w-5 h-5" />
                 </Button>
              </div>
           </div>

           <Card className="bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden rounded-[2rem]">
              <Table>
                 <TableHeader className="bg-white/[0.02]">
                    <TableRow className="border-white/5">
                       <TableHead className="px-10 py-6 text-[11px] font-bold uppercase tracking-widest text-slate-500">Asset Name</TableHead>
                       <TableHead className="py-6 text-[11px] font-bold uppercase tracking-widest text-slate-500">Size</TableHead>
                       <TableHead className="py-6 text-[11px] font-bold uppercase tracking-widest text-slate-500">Status</TableHead>
                       <TableHead className="py-6 text-[11px] font-bold uppercase tracking-widest text-slate-500">Risk Profile</TableHead>
                       <TableHead className="py-6 text-[11px] font-bold uppercase tracking-widest text-slate-500 text-right pr-10">Actions</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {filteredFiles.map((file, i) => (
                       <TableRow key={i} className="border-white/5 hover:bg-white/[0.02] transition-all group">
                          <TableCell className="px-10 py-6">
                             <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-xl bg-black/20 flex items-center justify-center border border-white/5 shadow-sm group-hover:scale-105 transition-transform">
                                   <FileText className={`w-5 h-5 ${
                                      file.type === 'PDF' ? 'text-[#66ADE4]' :
                                      file.type === 'XLSX' ? 'text-emerald-500' :
                                      file.type === 'DOCX' ? 'text-[#66ADE4]' :
                                      'text-[#66ADE4]'
                                   }`} />
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-[14px] font-bold text-white group-hover:text-[#66ADE4] transition-colors">{file.name}</span>
                                   <span className="text-[11px] font-medium text-slate-500 mt-0.5">{file.date}</span>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="text-[13px] font-bold text-slate-300">{file.size}</TableCell>
                          <TableCell>
                             <Badge className={`text-[10px] font-bold tracking-widest px-3 py-1 h-6 border-none ${
                                file.status === 'Indexed' ? 'bg-emerald-500/10 text-emerald-400' :
                                file.status === 'Indexing' ? 'bg-[#66ADE4]/10 text-[#66ADE4] animate-pulse' :
                                'bg-rose-500/10 text-rose-400'
                             }`}>
                                {file.status}
                             </Badge>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-2.5">
                                <div className={`h-2 w-2 rounded-full ${
                                   file.risk === 'Low' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                                   file.risk === 'Medium' ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-rose-600 shadow-[0_0_8px_#e11d48]'
                                }`} />
                                <span className="text-[12px] font-bold text-slate-400">{file.risk} Profile</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-10">
                             <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TooltipProvider>
                                   <Tooltip>
                                      <TooltipTrigger asChild>
                                         <Button 
                                          onClick={() => toast("Asset shared with Neural Flow")}
                                          variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/5 text-slate-400">
                                            <Share2 className="w-4 h-4" />
                                         </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-black text-white border-white/10 text-[10px] font-bold uppercase tracking-widest">Share Resource</TooltipContent>
                                   </Tooltip>
                                </TooltipProvider>

                                <Button 
                                  onClick={() => handleDownload(file.name)}
                                  variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/5 text-slate-400">
                                   <Download className="w-4 h-4" />
                                </Button>
                                
                                <Button 
                                  onClick={() => handleDelete(file.name)}
                                  variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-rose-500/10 text-rose-400">
                                   <Trash2 className="w-4 h-4" />
                                </Button>
                             </div>
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </Card>
           
           <div className="flex items-center justify-center py-10">
              <Button 
                onClick={() => toast("Browsing archive clusters...")}
                variant="link" className="text-slate-500 hover:text-[#66ADE4] text-[11px] font-bold uppercase tracking-widest gap-2 group no-underline">
                 Browse Full Archive
                 <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
