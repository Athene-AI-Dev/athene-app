// tests/load/agent-stream.k6.js
// Load test for agent streaming endpoint
//
// NOTE: k6 does NOT support true HTTP streaming. The http.post() call
// waits for the full response body before returning. Therefore:
//   - "TTFB" below = time until k6 receives the full response
//   - "first_token_latency" = approximate, based on TTFB
//
// For true streaming-latency measurement, use Artillery Pro or a custom
// Node.js script with fetch() + ReadableStream.
//
// Run: k6 run --vus 50 --duration 30s tests/load/agent-stream.k6.js

import http from "k6/http";
import { check } from "k6";
import { Trend, Rate } from "k6/metrics";

// Custom metrics
const firstTokenLatency = new Trend("first_token_latency");
const ttfb = new Trend("ttfb");
const errorRate = new Rate("error_rate");

// Config from env
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const CLERK_TOKEN = __ENV.CLERK_TOKEN || "";

function randomThreadId() {
  return "test-thread-" + Math.random().toString(36).substring(2, 10);
}

// Build request params — only set Authorization if token is provided
function getParams() {
  const headers = {
    "Content-Type": "application/json",
  };
  if (CLERK_TOKEN) {
    headers["Authorization"] = `Bearer ${CLERK_TOKEN}`;
  }
  return {
    headers,
    timeout: "60s",
    tags: { page: "agent" },
  };
}

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 50 },
    { duration: "30s", target: 50 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    "http_req_duration{page:agent}": ["p(95)<30000"], // 95% under 30s (LLM streaming is slow)
    "ttfb{page:agent}": ["p(95)<500"],              // TTFB under 500ms
    "first_token_latency": ["p(95)<1500"],           // 95% under 1.5s
    "error_rate": ["rate<0.05"],                       // <5% errors
  },
};

export default function () {
  const url = `${BASE_URL}/api/agent`;
  const payload = JSON.stringify({
    message: "What are the latest Q1 sales figures?",
    threadId: randomThreadId(),
    task_type: "general",
  });

  const PARAMS = getParams();

  // Measure TTFB (Time to First Byte)
  const startTime = Date.now();
  const res = http.post(url, payload, PARAMS);
  const ttfbMs = Date.now() - startTime;
  ttfb.add(ttfbMs, { page: "agent" });

  const success = check(res, {
    "status is 200": (r) => r.status === 200,
    "content-type is SSE": (r) => r.headers["Content-Type"]?.includes("text/event-stream"),
  });

  if (!success) {
    errorRate.add(1);
    return;
  }
  errorRate.add(0);

  // Parse SSE stream for first token latency
  // NOTE: k6 buffers the entire response, so this is approximate.
  // The first 'token' frame in the body is our best proxy for first-token latency.
  const body = res.body ? res.body.toString() : "";
  const lines = body.split("\n");

  let firstTokenFound = false;
  for (const line of lines) {
    const trimmed = line.trim();
    // Match "data:..." (with or without space after colon, per SSE spec)
    if (!trimmed.startsWith("data:")) continue;
    try {
      const data = JSON.parse(trimmed.slice(trimmed.indexOf(":") + 1).trim());
      if (data.token && !firstTokenFound) {
        firstTokenFound = true;
        // Approximate: use TTFB since k6 doesn't expose streaming
        firstTokenLatency.add(ttfbMs);
      }
      if (data.final_answer) break;
    } catch (e) {
      // Skip non-JSON lines (e.g., empty "data:" heartbeats)
    }
  }
}

export function handleSummary(data) {
  const m = data.metrics;

  const summary = {
    http_req_p50_ms: m.http_req_duration?.values?.["p(50)"] || 0,
    http_req_p95_ms: m.http_req_duration?.values?.["p(95)"] || 0,
    http_req_p99_ms: m.http_req_duration?.values?.["p(99)"] || 0,
    first_token_p50_ms: m.first_token_latency?.values?.["p(50)"] || 0,
    first_token_p95_ms: m.first_token_latency?.values?.["p(95)"] || 0,
    first_token_p99_ms: m.first_token_latency?.values?.["p(99)"] || 0,
    ttfb_p50_ms: m.ttfb?.values?.["p(50)"] || 0,
    ttfb_p95_ms: m.ttfb?.values?.["p(95)"] || 0,
    ttfb_p99_ms: m.ttfb?.values?.["p(99)"] || 0,
    error_rate: m.error_rate?.values?.rate || 0,
    total_requests: m.http_reqs?.values?.count || 0,
  };

  console.log("\n=== PERFORMANCE TEST RESULTS ===");
  console.log(`HTTP Req P50:   ${summary.http_req_p50_ms.toFixed(2)}ms`);
  console.log(`HTTP Req P95:   ${summary.http_req_p95_ms.toFixed(2)}ms (target: <30000ms for streaming)`);
  console.log(`HTTP Req P99:   ${summary.http_req_p99_ms.toFixed(2)}ms`);
  console.log(``);
  console.log(`First Token P50: ${summary.first_token_p50_ms.toFixed(2)}ms`);
  console.log(`First Token P95: ${summary.first_token_p95_ms.toFixed(2)}ms (target: <1500ms)`);
  console.log(`First Token P99: ${summary.first_token_p99_ms.toFixed(2)}ms`);
  console.log(``);
  console.log(`TTFB P50:        ${summary.ttfb_p50_ms.toFixed(2)}ms`);
  console.log(`TTFB P95:        ${summary.ttfb_p95_ms.toFixed(2)}ms (target: <500ms)`);
  console.log(`TTFB P99:        ${summary.ttfb_p99_ms.toFixed(2)}ms`);
  console.log(``);
  console.log(`Error Rate:      ${(summary.error_rate * 100).toFixed(2)}% (target: <5%)`);
  console.log(`Total Requests:  ${summary.total_requests}`);
  console.log("=================================\n");

  return {
    "stdout": JSON.stringify(summary, null, 2),
  };
}
