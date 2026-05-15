/**
 * Next.js Instrumentation — runs once at server startup.
 *
 * 1. Initializes OpenTelemetry if the OTLP endpoint is configured.
 * 2. Auto-registers system QStash cron schedules (hitl-cleanup, checkpoint-prune)
 *    so they are always live after every deploy without manual admin action.
 *
 * Dynamic imports keep Node-only modules out of the Edge bundle.
 */
export async function register() {
  // Only run in the Node.js runtime — Edge runtime doesn't support these SDKs.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. OpenTelemetry
    const { initTelemetry } = await import("@/lib/telemetry/spans");
    initTelemetry();

    // 2. System cron registration (idempotent — safe to run on every cold start)
    const { registerSystemCrons } = await import("@/lib/qstash/system-crons");
    await registerSystemCrons().catch((err: Error) => {
      console.error("[startup] Failed to register system crons:", err?.message);
    });
  }
}
