"use client";

import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, XCircle, PlayCircle, Calendar, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import cronstrue from "cronstrue";


/**
 * Automation Interface
 */
export interface Automation {
  id: string;
  type: string;
  status: "active" | "paused" | "error";
  config?: any;
  cron_expression?: string;
  last_run_at?: string;
  last_run_status?: string;
}

interface AutomationCardProps {
  automation: Automation;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * AutomationCard Component
 * Handles the display and toggling of individual automations.
 * Implements ATH-49 requirement for interactive state and human-readable cron.
 */
export function AutomationCard({ automation: initialData, onEdit, onDelete }: AutomationCardProps) {
  const [automation, setAutomation] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);

  const isEnabled = automation.status === "active";

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    const newStatus = checked ? "active" : "paused";
    
    // Optimistic update
    setAutomation({ ...automation, status: newStatus });

    try {
      // Mock API call for mock data
      if (automation.id.startsWith("mock-")) {
        await new Promise(resolve => setTimeout(resolve, 600)); 
        setAutomation({ ...automation, status: newStatus });
        toast.success(checked ? "Automation enabled" : "Automation paused");
        return;
      }

      // Update API path to /api/admin/automations as per ATH-49
      const response = await fetch(`/api/admin/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          config: automation.config 
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update automation");
      }

      const updated = await response.json();
      setAutomation(updated);
      toast.success(checked ? "Automation enabled" : "Automation paused");
    } catch (error) {
      // Revert on error
      setAutomation(initialData);
      toast.error("Failed to update automation status");
      console.warn("Update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = (type: string) => {
    switch (type) {
      case "morning_briefing": return "Morning Briefing";
      case "weekly_report": return "Weekly Report";
      case "data_sync": return "Data Sync";
      default: return type.replace("_", " ");
    }
  };

  const getDescription = (type: string) => {
    switch (type) {
      case "morning_briefing": return "Daily summary of your schedule, emails, and important updates.";
      case "weekly_report": return "Comprehensive review of your week's activity and insights.";
      case "data_sync": return "Automated knowledge synchronization across all connected enterprise tools.";
      default: return "";
    }
  };

  return (
    <div className="bg-card text-card-foreground rounded-[2rem] border border-border shadow-sm p-8 flex flex-col group hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 flex gap-2">
         <Button 
          variant="ghost" 
          size="icon" 
          onClick={onEdit}
          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 text-muted-foreground hover:text-primary"
         >
            <Settings2 className="w-4 h-4" />
         </Button>
         <Button 
          variant="ghost" 
          size="icon" 
          onClick={onDelete}
          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
         >
            <XCircle className="w-4 h-4" />
         </Button>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-lg shadow-primary/5">
            <PlayCircle className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-xl font-black tracking-tight font-['Space_Grotesk'] uppercase">
              {getTitle(automation.type)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border",
                isEnabled ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"
              )}>
                {automation.status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Switch
            id={`automation-${automation.id}`}
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isLoading}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed font-medium">
        {getDescription(automation.type)}
      </p>

      {automation.cron_expression && (
        <div className="flex items-center gap-2.5 mb-8 p-3 rounded-xl bg-muted/30 border border-border w-fit">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {cronstrue.toString(automation.cron_expression)}
          </span>
        </div>
      )}
      
      <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
        <div className="flex items-center text-[10px] uppercase tracking-widest text-muted-foreground font-black gap-2">
          <Clock className="w-4 h-4 opacity-50" />
          {automation.last_run_at 
            ? `${new Date(automation.last_run_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` 
            : "Standby"}
        </div>
        
        {automation.last_run_status && (
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
            automation.last_run_status === "ok" 
              ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" 
              : "text-rose-500 bg-rose-500/10 border-rose-500/20"
          )}>
            {automation.last_run_status === "ok" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            {automation.last_run_status}
          </span>
        )}
      </div>
    </div>
  );
}

