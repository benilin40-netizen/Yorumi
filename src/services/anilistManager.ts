interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface QueuedRequest {
  cacheKey: string;
  query: string;
  variables: any;
  cacheDuration: number;
  signal?: AbortSignal;
  retriesLeft: number;
  resolve: (data: any) => void;
  reject: (err: any) => void;
}

const ANILIST_URL = 'https://graphql.anilist.co';
const ANILIST_CACHE_KEY = 'anilist_cache_v3';
const MIN_INTERVAL = 1100; // 1.1s spacing to stay comfortably within AniList limits
let lastRequestTime = 0;
let cooldownUntil = 0;

const cache = new Map<string, CacheEntry<any>>();

export class AniListManager {
  private static instance: AniListManager;
  private queue: QueuedRequest[] = [];
  private inFlight = new Map<string, Promise<any>>();
  private isProcessing = false;

  private constructor() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(ANILIST_CACHE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          Object.entries(parsed).forEach(([key, value]) => {
            cache.set(key, value as CacheEntry<any>);
          });
        }
        localStorage.removeItem('anilist_cache_v2');
      }
    } catch (e) {
      console.warn('Failed to load AniList cache:', e);
    }
  }

  private persistCache() {
    try {
      if (typeof localStorage === 'undefined') return;
      // Keep cache bounded to most recent 80 entries to avoid storage quota issues
      if (cache.size > 80) {
        const entries = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
        const removeCount = cache.size - 80;
        for (let i = 0; i < removeCount; i++) {
          cache.delete(entries[i][0]);
        }
      }
      localStorage.setItem(ANILIST_CACHE_KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch {
      // ignore storage quota overflow
    }
  }

  static getInstance(): AniListManager {
    if (!AniListManager.instance) {
      AniListManager.instance = new AniListManager();
    }
    return AniListManager.instance;
  }

  clearCache(): void {
    cache.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ANILIST_CACHE_KEY);
        localStorage.removeItem('anilist_cache_v2');
      }
    } catch {
      // ignore
    }
  }

  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    cache.forEach((v) => {
      if (now < v.expiry) validEntries += 1;
    });
    return {
      totalEntries: cache.size,
      validEntries,
      queueDepth: this.queue.length,
      inFlightCount: this.inFlight.size,
      cooldownRemainingMs: Math.max(0, cooldownUntil - now),
    };
  }

  async request<T>(
    query: string,
    variables: any = {},
    cacheDuration: number = 600000,
    signal?: AbortSignal
  ): Promise<T> {
    if (signal?.aborted) {
      throw new DOMException('AniList request was aborted', 'AbortError');
    }

    const cacheKey = JSON.stringify({ query, variables });

    // Return fresh cache hit immediately
    const cached = cache.get(cacheKey);
    if (cached && cacheDuration > 0 && Date.now() < cached.expiry) {
      return cached.data as T;
    }

    // Deduplicate concurrent identical requests
    const existingFlight = this.inFlight.get(cacheKey);
    if (existingFlight) {
      return existingFlight as Promise<T>;
    }

    const promise = new Promise<T>((resolve, reject) => {
      if (signal) {
        const onAbort = () => {
          reject(new DOMException('AniList request was aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.queue.push({
        cacheKey,
        query,
        variables,
        cacheDuration: Math.max(0, cacheDuration),
        signal,
        retriesLeft: 2,
        resolve,
        reject,
      });
      this.processQueue();
    }).finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const request = this.queue.shift()!;
        if (request.signal?.aborted) {
          request.reject(new DOMException('AniList request was aborted', 'AbortError'));
          continue;
        }

        const now = Date.now();
        if (now < cooldownUntil) {
          const waitMs = Math.min(cooldownUntil - now, 12000);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        const timeSinceLast = Date.now() - lastRequestTime;
        if (timeSinceLast < MIN_INTERVAL) {
          await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL - timeSinceLast));
        }

        lastRequestTime = Date.now();

        let attempts = 0;
        let success = false;
        let lastError: any = null;

        while (attempts < 2 && !success) {
          attempts++;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const onExternalAbort = () => controller.abort();
          request.signal?.addEventListener('abort', onExternalAbort, { once: true });

          try {
            const response = await fetch(ANILIST_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ query: request.query, variables: request.variables }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            request.signal?.removeEventListener('abort', onExternalAbort);

            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After');
              const rateLimitReset = response.headers.get('X-RateLimit-Reset');

              let waitTime = 5000;
              if (retryAfter && !Number.isNaN(Number(retryAfter))) {
                waitTime = Math.min(Math.max(1000, parseInt(retryAfter, 10) * 1000), 15000);
              } else if (rateLimitReset && !Number.isNaN(Number(rateLimitReset))) {
                waitTime = Math.min(Math.max(1000, parseInt(rateLimitReset, 10) * 1000 - Date.now()), 15000);
              }

              cooldownUntil = Date.now() + waitTime;
              lastError = new Error('AniList API rate limit (HTTP 429)');

              if (request.retriesLeft > 0) {
                request.retriesLeft -= 1;
                await new Promise((r) => setTimeout(r, waitTime));
                continue;
              }
              throw lastError;
            }

            if (!response.ok) {
              throw new Error(`AniList GraphQL Gateway returned HTTP ${response.status}`);
            }

            const json = await response.json();
            if (json.errors && json.errors.length > 0) {
              throw new Error(json.errors[0].message || 'GraphQL Query Error');
            }

            if (!json.data) {
              throw new Error('Empty GraphQL data payload');
            }

            const data = json.data;
            if (request.cacheDuration > 0) {
              cache.set(request.cacheKey, {
                data,
                timestamp: Date.now(),
                expiry: Date.now() + request.cacheDuration,
              });
              this.persistCache();
            }

            request.resolve(data);
            success = true;
          } catch (err: any) {
            clearTimeout(timeoutId);
            request.signal?.removeEventListener('abort', onExternalAbort);
            lastError = err;

            if (err?.name === 'AbortError' && request.signal?.aborted) {
              break;
            }

            if (attempts < 2) {
              await new Promise((r) => setTimeout(r, 900 * attempts));
            }
          }
        }

        if (!success) {
          const fallbackCached = cache.get(request.cacheKey);
          if (fallbackCached && !request.signal?.aborted) {
            console.warn(`Serving stale cached AniList response due to error: ${lastError?.message}`);
            request.resolve(fallbackCached.data);
          } else {
            request.reject(lastError || new Error('AniList request failed'));
          }
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }
}

export const aniListManager = AniListManager.getInstance();
