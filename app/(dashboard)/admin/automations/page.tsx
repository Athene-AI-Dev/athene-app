import { Suspense } from "react";
import { headers } from "next/headers";
import { getContextFromHeaders, withRLS } from "@/lib/supabase/rls-client";
import { AutomationCard } from "@/components/automation-card";
import { CreateAutomationButton } from "@/components/create-automation-button";
import { Plus } from "lucide-react";

/**
 * Server component to fetch and display the list of automations.
 * Implements ATH-49 requirement for data fetching and empty state.
 */
async function AutomationList() {
  const context = getContextFromHeaders(await headers());
  if (!context) return null;

  const automations = await withRLS(context, async (supabase) => {
    const { data } = await supabase
      .from("automations")
      .select("*")
      .order("created_at", { ascending: false });
    return data || [];
  });

  if (automations.length === 0) {
    return (
      <div className="mt-8 p-12 rounded-xl border border-border bg-accent/5 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <Plus className="w-8 h-8 text-accent/50" />
        </div>
        <h3 className="text-xl font-semibold">No automations found</h3>
        <p className="text-muted-foreground max-w-sm mt-2">
          Create your first automated workflow to stay on top of your schedule and insights.
        </p>
        <CreateAutomationButton className="mt-6">
          Create Automation
        </CreateAutomationButton>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
      {automations.map((automation) => (
        <AutomationCard key={automation.id} automation={automation} />
      ))}
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Automations
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Configure recurring tasks like briefings and weekly reports.
          </p>
        </div>
        <CreateAutomationButton size="lg" className="shadow-lg shadow-accent/20" iconClassName="w-5 h-5 mr-2">
          New Automation
        </CreateAutomationButton>
      </div>

      <Suspense fallback={
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl border border-border bg-accent/5 animate-pulse" />
          ))}
        </div>
      }>
        <AutomationList />
      </Suspense>
    </div>
  );
}
