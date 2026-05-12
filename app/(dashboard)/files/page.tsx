"use client";

import { useState } from "react";
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

export default function FilesPage() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [search, setSearch] = useState("");

  const handleUpload = () => {
    toast.info("Initializing Secure Upload Pipeline", {
      description: "Encrypted stream established. Awaiting selection.",
    });
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

  const handleDownload = (name: string) => {
    toast(`Downloading ${name}`, {
      icon: <Download className="w-4 h-4" />,
    });
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 font-['Space_Grotesk'] transition-colors duration-300">
      {/* Page Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border pb-10">
        <div className="space-y-4">
          <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-lg">
            Knowledge Base
          </Badge>
          <h1 className="text-4xl lg:text-6xl font-black tracking-tighter text-foreground uppercase">
            Enterprise <span className="text-primary">Files</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-xl font-medium leading-relaxed">
            Secure, centralized management of your organization's unstructured data repository.
          </p>
        </div>

        <div className="flex gap-4">
           <Button 
            onClick={handleUpload}
            variant="outline" className="h-14 px-8 rounded-2xl border-border bg-card/50 text-foreground font-black uppercase tracking-widest text-[11px] gap-3 hover:bg-muted/50 transition-all shadow-sm">
              <Upload className="w-5 h-5 text-primary" />
              Upload Data
           </Button>
           <button 
            onClick={handleNewRepo}
            className="h-14 px-10 rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground font-black uppercase tracking-widest text-[11px] gap-3 shadow-xl shadow-primary/10 transition-all active:scale-95 flex items-center justify-center relative overflow-visible group">
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-background bg-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                 <img src="/logo.png" alt="Logo" className="w-4 h-4 object-contain invert" />
              </div>
              <span className="ml-4">New Repository</span>
           </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Sidebar Analytics */}
        <div className="space-y-10">
           <Card className="bg-card/50 backdrop-blur-xl border border-border p-10 space-y-8 rounded-[2.5rem] shadow-2xl transition-colors duration-300">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Storage Load</h3>
              <div className="space-y-8">
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                       <span className="flex items-center gap-2 text-foreground"><HardDrive className="w-4 h-4 text-primary" /> Capacity</span>
                       <span className="text-primary">84%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                       <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: '84%' }} />
                    </div>
                 </div>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                       <span className="flex items-center gap-2 text-foreground"><Cloud className="w-4 h-4 text-primary" /> AI Sync</span>
                       <span className="text-accent">Stable</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                       <div className="h-full bg-accent" style={{ width: '100%' }} />
                    </div>
                 </div>
              </div>
           </Card>

           <div className="space-y-6 px-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Intelligence Layers</h3>
              <div className="space-y-2">
                 {[
                    { label: "Financial Records", count: 42, color: "text-accent" },
                    { label: "Legal Discovery", count: 18, color: "text-secondary" },
                    { label: "Internal Wiki", count: 124, color: "text-primary" },
                    { label: "Audit Logs", count: 56, color: "text-primary" },
                 ].map((cat, i) => (
                    <button key={i} className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-muted/50 border border-transparent hover:border-border transition-all group text-left">
                       <span className="text-sm font-black text-muted-foreground group-hover:text-foreground flex items-center gap-3 transition-colors uppercase tracking-tight">
                          <Layers className={cn("w-4 h-4", cat.color)} />
                          {cat.label}
                       </span>
                       <Badge className="bg-muted text-muted-foreground border-border text-[10px] font-black group-hover:text-primary transition-colors">{cat.count}</Badge>
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* File Table Content */}
        <div className="lg:col-span-3 space-y-8">
           <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-2 rounded-[2rem] bg-muted/10 border border-border backdrop-blur-xl shadow-lg">
              <div className="relative group w-full sm:max-w-md">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                 <Input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search organizational data..." className="h-14 pl-14 rounded-2xl bg-muted/20 border-transparent text-sm font-bold text-foreground focus:border-primary/40 focus:bg-muted/40 transition-all placeholder:text-muted-foreground/30" />
              </div>
              <div className="flex items-center gap-4 pr-2">
                 <Button variant="ghost" className="h-12 px-6 rounded-xl text-muted-foreground font-black uppercase tracking-widest text-[10px] gap-2 hover:bg-muted/50 hover:text-foreground transition-all">
                    <Filter className="w-4 h-4" />
                    Filters
                 </Button>
                 <div className="h-8 w-px bg-border" />
                 <Button 
                  onClick={() => toast("Bulk download initialization...")}
                  variant="ghost" size="icon" className="h-12 w-12 rounded-xl hover:bg-primary/10 text-primary transition-all">
                    <Download className="w-5 h-5" />
                 </Button>
              </div>
           </div>

           <div className="rounded-[2.5rem] bg-card/50 border border-border overflow-hidden backdrop-blur-xl shadow-2xl transition-colors duration-300">
              <Table>
                 <TableHeader className="bg-muted/30 border-b border-border">
                    <TableRow className="hover:bg-transparent border-none">
                       <TableHead className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asset Name</TableHead>
                       <TableHead className="py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Size</TableHead>
                       <TableHead className="py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                       <TableHead className="py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Risk Profile</TableHead>
                       <TableHead className="py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-10">Actions</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody className="divide-y divide-border">
                    {filteredFiles.map((file, i) => (
                       <TableRow key={i} className="hover:bg-muted/20 transition-all group border-none">
                          <TableCell className="px-10 py-8">
                             <div className="flex items-center gap-5">
                                <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform group-hover:border-primary/20">
                                   <FileText className={cn("w-6 h-6",
                                      file.type === 'PDF' ? 'text-primary' :
                                      file.type === 'XLSX' ? 'text-accent' :
                                      file.type === 'DOCX' ? 'text-secondary' :
                                      'text-primary'
                                   )} />
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-base font-black text-foreground group-hover:text-primary transition-colors tracking-tight">{file.name}</span>
                                   <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60 mt-1">{file.date}</span>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="text-sm font-black text-muted-foreground/80 tracking-tight">{file.size}</TableCell>
                          <TableCell>
                             <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1.5 h-auto border shadow-sm",
                                file.status === 'Indexed' ? 'bg-accent/10 text-accent border-accent/20' :
                                file.status === 'Indexing' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' :
                                'bg-destructive/10 text-destructive border-destructive/20'
                             )}>
                                {file.status}
                             </Badge>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-3">
                                <div className={cn("h-2.5 w-2.5 rounded-full shadow-lg",
                                   file.risk === 'Low' ? 'bg-accent shadow-accent/20' :
                                   file.risk === 'Medium' ? 'bg-warning shadow-warning/20' : 'bg-destructive shadow-destructive/20'
                                )} />
                                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest opacity-80">{file.risk} Profile</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-10">
                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                <TooltipProvider>
                                   <Tooltip>
                                      <TooltipTrigger asChild>
                                         <Button 
                                          onClick={() => toast("Asset shared with Neural Flow")}
                                          variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all">
                                            <Share2 className="w-4 h-4" />
                                         </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-popover text-popover-foreground border-border text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl">Share Resource</TooltipContent>
                                   </Tooltip>
                                </TooltipProvider>

                                <Button 
                                  onClick={() => handleDownload(file.name)}
                                  variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-secondary/10 text-muted-foreground hover:text-secondary transition-all">
                                   <Download className="w-4 h-4" />
                                </Button>
                                
                                <Button 
                                  onClick={() => handleDelete(file.name)}
                                  variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-destructive/10 text-destructive/80 hover:text-destructive transition-all">
                                   <Trash2 className="w-4 h-4" />
                                </Button>
                             </div>
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </div>
           
           <div className="flex items-center justify-center py-10">
              <Button 
                onClick={() => toast("Browsing archive clusters...")}
                variant="link" className="text-muted-foreground/60 hover:text-primary text-[10px] font-black uppercase tracking-[0.3em] gap-3 group no-underline transition-all hover:gap-5">
                 Browse Full Archive
                 <ChevronRight className="w-4 h-4 transition-transform" />
              </Button>
           </div>
        </div>
      </div>
    </div>

  );
}
