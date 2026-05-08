import {
  trace,
  context,
  SpanStatusCode,
  type Span,
  type Tracer,
} from "@opentelemetry/api";

// Lazy tracer — avoids module-level side effects if no tracer is registered yet.
let _tracer: Tracer | null = null;

function getTracerInstance(): Tracer {
  if (!_tracer) {
    _tracer = trace.getTracer("athene-app", "1.0.0");
  }
  return _tracer;
}

export function getTracer(): Tracer {
  return getTracerInstance();
}

/** @internal */
export function _resetTracer(): void {
  _tracer = null;
}

export function startSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>
): Span {
  const tracer = getTracerInstance();
  const opts = attributes ? { attributes } : undefined;
  return tracer.startSpan(name, opts, context.active());
}

/**
 * Run `fn` under a new span, with proper OTel context propagation so that
 * any child spans created inside `fn` are correctly parented.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracerInstance();
  const opts = attributes ? { attributes } : undefined;
  const span = tracer.startSpan(name, opts, context.active());

  // Make span active in the current context so child spans are parented.
  const ctx = trace.setSpan(context.active(), span);

  try {
    const result = await context.with(ctx, () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof Error) {
      span.recordException(error);
    }
    throw error;
  } finally {
    span.end();
  }
}

// Vector search span helper — now accepts topK so the attribute is accurate.
export async function withVectorSearchSpan<T>(
  query: string,
  orgId: string,
  topK: number,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    "vector_search",
    fn,
    {
      "vector.query_length": query.length,
      "vector.org_id": orgId,
      "vector.top_k": topK,
    }
  );
}

// LLM call span helper
export async function withLLMSpan<T>(
  model: string,
  promptLength: number,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    "llm_call",
    (span) => fn(span),
    {
      "llm.model": model,
      "llm.prompt_length": promptLength,
    }
  );
}

// Tool call span helper
export async function withToolSpan<T>(
  toolName: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    "tool_call",
    (span) => fn(span),
    {
      "tool.name": toolName,
    }
  );
}

// SSE frame latency span helper
export async function withSSEFrameSpan<T>(
  frameType: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(
    "sse_frame",
    (span) => fn(span),
    {
      "sse.frame_type": frameType,
    }
  );
}

