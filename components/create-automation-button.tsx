"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CreateAutomationButtonProps {
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children: React.ReactNode;
  iconClassName?: string;
}

export function CreateAutomationButton({
  size = "default",
  className,
  children,
  iconClassName = "w-4 h-4 mr-2",
}: CreateAutomationButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateAutomation = async () => {
    if (isCreating) return;

    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "morning_briefing",
          status: "paused",
          config: {},
          cron_expression: "0 7 * * *",
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create automation");
      }

      toast.success("Automation created");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create automation");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button size={size} className={className} onClick={handleCreateAutomation} disabled={isCreating}>
      <Plus className={iconClassName} />
      {isCreating ? "Creating..." : children}
    </Button>
  );
}
