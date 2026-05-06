"use client";

import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, XCircle, PlayCircle, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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
}

/**
 * AutomationCard Component
 * Handles the display and toggling of individual automations.
 * Implements ATH-49 requirement for interactive state and human-readable cron.
 */
export function AutomationCard({ automation: initialData }: AutomationCardProps) {
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
        toast.success(checked ? "Automation enabled" : "Automation disabled");
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
      toast.success(checked ? "Automation enabled" : "Automation disabled");
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
      default: return type.replace("_", " ");
    }
  };

  const getDescription = (type: string) => {
    switch (type) {
      case "morning_briefing": return "Daily summary of your schedule, emails, and important updates.";
      case "weekly_report": return "Comprehensive review of your week's activity and insights.";
      default: return "";
    }
  };

  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col group hover:border-accent/50 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 border border-accent/20">
            <PlayCircle className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">
              {getTitle(automation.type)}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[240px] leading-relaxed">
              {getDescription(automation.type)}
            </p>
            {automation.cron_expression && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] uppercase tracking-wider font-bold text-accent/80">
                <Calendar className="w-3.5 h-3.5" />
                <span>{cronstrue.toString(automation.cron_expression)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`automation-${automation.id}`} className="sr-only">
            Toggle {getTitle(automation.type)}
          </Label>
          <Switch
            id={`automation-${automation.id}`}
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>
      </div>
      
      <div className="mt-auto pt-5 border-t border-border flex items-center justify-between">
        <div className="flex items-center text-xs text-muted-foreground font-medium gap-2">
          <Clock className="w-4 h-4 opacity-70" />
          {automation.last_run_at 
            ? `Last run: ${new Date(automation.last_run_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` 
            : "Never run"}
        </div>
        
        {automation.last_run_status && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
            automation.last_run_status === "ok" 
              ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" 
              : "text-red-500 bg-red-500/10 border-red-500/20"
          }`}>
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
