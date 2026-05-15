"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Folder, 
  Database, 
  ChevronRight, 
  Search, 
  Tag, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  HardDrive,
  Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Resource {
  id: string;
  name: string;
  type: 'folder' | 'workspace' | 'shared_drive';
  metadata?: any;
}

interface ResourceBrowserProps {
  connectionId: string;
  provider: string;
  onSave: (selections: Array<{ id: string; name: string; type: string; departmentId?: string }>) => Promise<void>;
}

export function ResourceBrowser({ connectionId, provider, onSave }: ResourceBrowserProps) {
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<Resource[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [selections, setSelections] = useState<Record<string, { selected: boolean; departmentId?: string }>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/resources?connectionId=${connectionId}&provider=${provider}`);
      if (!res.ok) throw new Error("Failed to fetch resources");
      const data = await res.json();
      setResources(data.resources || []);
      
      const deptRes = await fetch("/api/admin/departments");
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connectionId, provider]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const toggleSelection = (id: string) => {
    setSelections(prev => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id]?.selected }
    }));
  };

  const setDepartment = (resourceId: string, departmentId: string) => {
    setSelections(prev => ({
      ...prev,
      [resourceId]: { ...prev[resourceId], selected: true, departmentId }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedResources = resources
        .filter(r => selections[r.id]?.selected)
        .map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          departmentId: selections[r.id]?.departmentId
        }));
      await onSave(selectedResources);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredResources = resources.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Scanning resources...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground tracking-tight uppercase">
              Resource <span className="text-primary">Picker</span>
            </h3>
            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
              Select and tag {provider} sources for indexing
            </p>
          </div>
          <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-primary/10 border-primary/20 text-primary font-black text-[10px] tracking-widest uppercase">
            {Object.values(selections).filter(s => s.selected).length} Selected
          </Badge>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Resource List */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-3">
          {filteredResources.length === 0 ? (
            <div className="py-20 text-center opacity-40">
              <Folder className="w-12 h-12 mx-auto mb-4" />
              <p className="font-bold">No resources found</p>
            </div>
          ) : (
            filteredResources.map(resource => (
              <div 
                key={resource.id}
                className={cn(
                  "group flex flex-col p-4 rounded-2xl border transition-all duration-300",
                  selections[resource.id]?.selected 
                    ? "bg-primary/5 border-primary/30 shadow-lg shadow-primary/5" 
                    : "bg-white/5 border-white/5 hover:border-white/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-110",
                      selections[resource.id]?.selected ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 text-muted-foreground"
                    )}>
                      {resource.type === 'workspace' && <Layout className="w-5 h-5" />}
                      {resource.type === 'folder' && <Folder className="w-5 h-5" />}
                      {resource.type === 'shared_drive' && <HardDrive className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">{resource.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{resource.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSelection(resource.id)}
                    className={cn(
                      "rounded-lg font-black text-[10px] uppercase tracking-widest",
                      selections[resource.id]?.selected ? "text-primary bg-primary/10" : "text-muted-foreground"
                    )}
                  >
                    {selections[resource.id]?.selected ? "Selected" : "Select"}
                  </Button>
                </div>

                {selections[resource.id]?.selected && (
                  <div className="mt-4 pt-4 border-t border-primary/10 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                    <Tag className="w-3 h-3 text-primary/60" />
                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mr-2">Tag Department:</span>
                    <div className="flex flex-wrap gap-2">
                      {departments.map(dept => (
                        <button
                          key={dept.id}
                          onClick={() => setDepartment(resource.id, dept.id)}
                          className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                            selections[resource.id]?.departmentId === dept.id
                              ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                              : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/30"
                          )}
                        >
                          {dept.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-8 border-t border-white/5 bg-accent/5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1">
            {error && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold">{error}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="px-8 rounded-2xl border-white/10 font-bold uppercase tracking-widest text-[11px]"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saving || Object.values(selections).filter(s => s.selected).length === 0}
              className="px-10 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save Selections
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
