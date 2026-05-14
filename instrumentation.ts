/**
 * Next.js Instrumentation — runs once at server startup.
 * Initializes OpenTelemetry if the OTLP endpoint is configured.
 *
 * Dynamic import keeps spans.ts out of the Edge bundle entirely —
 * a static import would cause "process.on is not supported in Edge Runtime".
 */
export async function register() {
  // Only initialize in the Node.js runtime — the Edge runtime doesn't support
  // process.on or the full OpenTelemetry SDK.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initTelemetry } = await import("@/lib/telemetry/spans");
    initTelemetry();
  }
}
