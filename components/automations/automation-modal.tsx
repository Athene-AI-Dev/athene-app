"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, PlayCircle, Calendar, Settings2 } from "lucide-react";
import type { Automation } from "@/components/automation-card";

interface AutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  automation?: Automation; // If provided, we are in Edit mode
}

export function AutomationModal({ isOpen, onClose, onSuccess, automation }: AutomationModalProps) {
  const [type, setType] = useState<string>("morning_briefing");
  const [cron, setCron] = useState<string>("0 9 * * 1-5"); // Default: 9 AM weekdays
  const [loading, setLoading] = useState(false);

  const isEdit = !!automation;

  useEffect(() => {
    if (automation) {
      setType(automation.type);
      setCron(automation.cron_expression || "0 9 * * 1-5");
    } else {
      setType("morning_briefing");
      setCron("0 9 * * 1-5");
    }
  }, [automation, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEdit ? `/api/admin/automations/${automation.id}` : "/api/admin/automations";
      const method = isEdit ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          cron_expression: cron,
          status: isEdit ? automation.status : "active",
          config: isEdit ? automation.config : {}
        }),
      });

      if (res.ok) {
        toast.success(isEdit ? "Automation updated" : "Automation created");
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save automation");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground rounded-[2rem] shadow-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight">
            {isEdit ? "Edit Automation" : "New Automation"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            {isEdit ? "Update your automated workflow configuration." : "Configure a new recurring automated task."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <PlayCircle className="w-3 h-3" />
              Workflow Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-12 bg-background border-border rounded-xl">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="morning_briefing">Morning Briefing</SelectItem>
                <SelectItem value="weekly_report">Weekly Report</SelectItem>
                <SelectItem value="data_sync">Data Synchronization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cron" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Schedule (Cron Expression)
            </Label>
            <Input
              id="cron"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 9 * * 1-5"
              required
              className="h-12 bg-background border-border rounded-xl focus:ring-primary focus:border-primary text-sm font-mono"
            />
            <p className="text-[9px] text-muted-foreground font-medium">
              Standard cron format: <code className="text-primary">min hour dom month dow</code>
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="rounded-xl font-bold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-xl px-8 shadow-lg shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                isEdit ? "Update Automation" : "Create Automation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
