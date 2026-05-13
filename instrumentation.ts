/**
 * Next.js Instrumentation — runs once at server startup.
 * Initializes OpenTelemetry if the OTLP endpoint is configured.
 */
import { initTelemetry } from "@/lib/telemetry/spans";

export async function register() {
  // Only initialize on server side
  if (typeof window === "undefined") {
    initTelemetry();
  }
}
