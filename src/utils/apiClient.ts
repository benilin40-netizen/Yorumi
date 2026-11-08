export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  contentType: string;
  data: T | null;
  errorPreview?: string;
  rawText?: string;
}

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Safely fetches a resource and parses JSON, preventing uncaught SyntaxError
 * when servers return HTML error pages, plain text, or non-JSON payloads.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const { timeoutMs = 8000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const mergedSignal = fetchOptions.signal
    ? fetchOptions.signal
    : controller.signal;

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: mergedSignal,
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || 'unknown';
    const rawText = await res.text();

    if (!res.ok) {
      const sanitizedText = sanitizeTextPreview(rawText);
      return {
        ok: false,
        status: res.status,
        contentType,
        data: null,
        errorPreview: `HTTP ${res.status}: ${sanitizedText.slice(0, 150) || res.statusText}`,
        rawText,
      };
    }

    // Check if content-type contains json or try parsing JSON
    try {
      const parsed = JSON.parse(rawText) as T;
      return {
        ok: true,
        status: res.status,
        contentType,
        data: parsed,
        rawText,
      };
    } catch (parseErr: any) {
      const sanitizedText = sanitizeTextPreview(rawText);
      return {
        ok: false,
        status: res.status,
        contentType,
        data: null,
        errorPreview: `JSON Parse Error: Received ${contentType}. Preview: "${sanitizedText.slice(0, 150)}"`,
        rawText,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err.name === 'AbortError';
    const errorMessage = isAbort
      ? `Request timed out after ${timeoutMs}ms`
      : err.message || 'Network request failed';

    return {
      ok: false,
      status: 0,
      contentType: 'none',
      data: null,
      errorPreview: errorMessage,
    };
  }
}

/**
 * Helper to strip HTML tags and normalize whitespace for safe preview strings.
 */
function sanitizeTextPreview(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
