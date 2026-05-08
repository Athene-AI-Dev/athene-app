import { useEffect, useRef, useState, useCallback } from "react";

interface UseEventSourceOptions {
  url: string;
  body?: Record<string, unknown>;
  enabled?: boolean;
  onMessage?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseEventSourceReturn {
  isConnected: boolean;
  error: Error | null;
  start: () => void;
  stop: () => void;
}

export function useEventSource({
  url,
  body,
  enabled = true,
  onMessage,
  onError,
}: UseEventSourceOptions): UseEventSourceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const bodyRef = useRef(body);
  const isStartingRef = useRef(false);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  const stop = useCallback(() => {
    abortRef.current = true;
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const start = useCallback(async () => {
    if (isStartingRef.current) {
      // Queue start after current one completes
      await new Promise(resolve => setTimeout(resolve, 0));
      return start();
    }
    isStartingRef.current = true;
    stop();
    abortRef.current = false;
    setError(null);

    try {
      const currentBody = bodyRef.current;
      const isPost = !!currentBody;
      let response: Response;

      if (isPost) {
        const controller = new AbortController();
        controllerRef.current = controller;
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentBody),
          signal: controller.signal,
        });
      } else {
        const controller = new AbortController();
        controllerRef.current = controller;
        response = await fetch(url, { signal: controller.signal });
      }

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      // Only set connected after successful response
      setIsConnected(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!abortRef.current) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            onMessage?.(data);
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      if (!abortRef.current) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        onError?.(errorObj);
      }
    } finally {
      if (!abortRef.current) {
        setIsConnected(false);
      }
      isStartingRef.current = false;
    }
  }, [url, stop, onMessage, onError]);

  useEffect(() => {
    if (enabled) {
      start();
    }
    return stop;
  }, [enabled, start, stop]);

  return { isConnected, error, start, stop };
}
