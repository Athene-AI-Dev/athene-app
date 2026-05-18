/**
 * Wrapper for the native fetch API that enforces a timeout using AbortController.
 * This prevents the UI from hanging indefinitely if an API route or external service is slow/unresponsive.
 */
export async function fetchWithTimeout(url: string | URL | Request, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}
