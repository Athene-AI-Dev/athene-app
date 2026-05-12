"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Bot, Loader2, AlertCircle } from "lucide-react";
import { AutomationCard, type Automation } from "@/components/automation-card";
import { AutomationModal } from "@/components/automations/automation-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | undefined>();

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/automations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAutomations(data || []);
      setError(null);
    } catch (e: any) {
      setError("Failed to load automation registry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const handleCreate = () => {
    setEditingAutomation(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automation?")) return;
    
    try {
      const res = await fetch(`/api/admin/automations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setAutomations(prev => prev.filter(a => a.id !== id));
      import("sonner").then(({ toast }) => toast.success("Automation deleted"));
    } catch (e) {
      import("sonner").then(({ toast }) => toast.error("Failed to delete automation"));
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-['Space_Grotesk']">
      <AutomationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchAutomations}
        automation={editingAutomation}
      />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-border">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase">
              Admin <span className="text-primary">Automations</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl font-medium leading-relaxed">
            Orchestrate recurring intelligence tasks. Configure morning briefings, 
            weekly reports, and system synchronization cycles.
          </p>
        </div>
        
        <Button 
          onClick={handleCreate}
          size="lg" 
          className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[11px] gap-3 shadow-xl shadow-primary/10 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          New Automation
        </Button>
      </div>

      <div className="relative">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-[2.5rem] bg-muted/20 border border-border animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="col-span-full py-20 text-center space-y-4 bg-muted/10 rounded-[3rem] border border-border">
             <AlertCircle className="w-12 h-12 text-destructive mx-auto opacity-20" />
             <p className="text-muted-foreground font-bold">{error}</p>
             <Button variant="outline" onClick={fetchAutomations} className="rounded-xl">Try Again</Button>
          </div>
        ) : automations.length === 0 ? (
          <div className="mt-8 p-12 py-32 rounded-[3rem] border-2 border-dashed border-border bg-muted/5 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-muted/10 flex items-center justify-center mb-6">
              <Plus className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-2">No Active Automations</h3>
            <p className="text-muted-foreground max-w-sm font-medium">
              Initialize your first automated workflow to synthesize intelligence across your organization.
            </p>
            <Button 
              onClick={handleCreate}
              className="mt-8 h-12 px-8 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold"
            >
              Initialize Automation →
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
            {automations.map((automation) => (
              <AutomationCard 
                key={automation.id} 
                automation={automation} 
                onEdit={() => handleEdit(automation)}
                onDelete={() => handleDelete(automation.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

