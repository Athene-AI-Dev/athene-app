"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  PieChart,
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PowerBIWorkspace {
  id: string;
  name: string;
  isReadOnly: boolean;
  type: string;
}

interface PowerBIPickerModalProps {
  open: boolean;
  connectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PowerBIPickerModal({ open, connectionId, onClose, onSuccess }: PowerBIPickerModalProps) {
  const [workspaces, setWorkspaces] = useState<PowerBIWorkspace[]>([]);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Fetch departments
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/departments").then(res => res.json()).then(data => {
      setDepartments(data.departments ?? []);
    }).catch(console.error);
  }, [open]);

  const browse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${connectionId}/browse?type=powerbi_workspaces`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWorkspaces(data.workspaces ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load Power BI workspaces");
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (!open) return;
    setWorkspaces([]);
    setSelectedWorkspaceIds(new Set());
    setDepartmentId(null);
    setSearch("");
    browse();
  }, [open, browse]);

  const toggleWorkspace = (id: string) => {
    setSelectedWorkspaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedWorkspaceIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${connectionId}/configure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "powerbi",
          selectedWorkspaceIds: Array.from(selectedWorkspaceIds),
          departmentId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const filteredWorkspaces = workspaces.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-card border border-white/10 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-[2.5rem] animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-white/5 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight">Select Workspaces to Sync</h2>
              <p className="text-xs text-muted-foreground font-bold mt-1">
                Choose which Power BI Workspaces Athene should index.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/5 -mt-1">
              <X className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter workspaces..."
              className="w-full h-11 pl-11 pr-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold placeholder:text-muted-foreground/30 text-foreground outline-none focus:border-[#F2C811]/30 transition-colors"
            />
          </div>
        </div>

        {/* Configuration Section */}
        <div className="px-8 py-4 border-b border-white/5 bg-muted/5">
           <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-2">Department Access</label>
           <Select value={departmentId || "none"} onValueChange={(val) => setDepartmentId(val === "none" ? null : val)}>
             <SelectTrigger className="w-full bg-white/5 border-white/10 rounded-xl">
               <SelectValue placeholder="Map to department..." />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="none">No specific department (Org-wide)</SelectItem>
               {departments.map(dept => (
                 <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
               ))}
             </SelectContent>
           </Select>
        </div>

        {/* Workspace List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-8 py-4 space-y-1">
            {loading && workspaces.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                <span className="text-sm text-destructive font-bold">{error}</span>
              </div>
            )}

            {!loading && !error && workspaces.length === 0 && (
              <div className="py-12 text-center">
                <PieChart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground/40">
                  No workspaces found
                </p>
              </div>
            )}

            {filteredWorkspaces.map((ws) => {
              const isSelected = selectedWorkspaceIds.has(ws.id);
              return (
                <div
                  key={ws.id}
                  onClick={() => toggleWorkspace(ws.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer hover:bg-white/5
                    ${isSelected ? "bg-[#F2C811]/10 border border-[#F2C811]/20" : "border border-transparent"}`}
                >
                  <button className="flex-shrink-0 text-muted-foreground/60 hover:text-[#F2C811] transition-colors">
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-[#F2C811]" />
                      : <Square className="w-4 h-4" />}
                  </button>

                  <PieChart className="w-4 h-4 text-[#F2C811] flex-shrink-0" />

                  <span className="flex-1 text-sm font-bold text-foreground truncate">
                    {ws.name}
                  </span>
                  
                  {ws.isReadOnly && (
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/50 border border-muted-foreground/20 px-1.5 py-0.5 rounded">
                      Read Only
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-white/5 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-bold text-muted-foreground/60">
            {selectedWorkspaceIds.size > 0
              ? `${selectedWorkspaceIds.size} workspace${selectedWorkspaceIds.size !== 1 ? "s" : ""} selected`
              : "No workspaces selected"}
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-10 px-5 rounded-xl border-white/10 hover:bg-white/5 font-bold text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || selectedWorkspaceIds.size === 0}
              className="h-10 px-6 rounded-xl bg-[#F2C811] hover:bg-[#F2C811]/90 text-black font-black text-sm gap-2 shadow-lg shadow-[#F2C811]/20"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Start Syncing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
