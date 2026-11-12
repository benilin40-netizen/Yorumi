interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

const ANILIST_URL = 'https://graphql.anilist.co';
const MIN_INTERVAL = 1500; // 1.5 seconds minimum between AniList calls
let lastRequestTime = 0;
let cooldownUntil = 0;

const cache = new Map<string, CacheEntry<any>>();

export class AniListManager {
  private static instance: AniListManager;
  private queue: { query: string; variables: any; resolve: (data: any) => void; reject: (err: any) => void }[] = [];
  private isProcessing = false;

  private constructor() {
    try {
      const saved = localStorage.getItem('anilist_cache_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([key, value]) => {
          cache.set(key, value as CacheEntry<any>);
        });
      }
    } catch (e) {
      console.warn('Failed to load AniList cache:', e);
    }
  }

  private persistCache() {
    try {
      localStorage.setItem('anilist_cache_v2', JSON.stringify(Object.fromEntries(cache)));
    } catch (e) {
      // Storage limit warning catch
    }
  }

  static getInstance(): AniListManager {
    if (!AniListManager.instance) {
      AniListManager.instance = new AniListManager();
    }
    return AniListManager.instance;
  }

  async request<T>(query: string, variables: any = {}, cacheDuration: number = 600000): Promise<T> {
    const cacheKey = JSON.stringify({ query, variables });

    // Check Cache first (even expired cache if needed later)
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ query, variables, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();

      if (now < cooldownUntil) {
        await new Promise((resolve) => setTimeout(resolve, cooldownUntil - now));
      }

      const timeSinceLast = now - lastRequestTime;
      if (timeSinceLast < MIN_INTERVAL) {
        await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL - timeSinceLast));
      }

      const request = this.queue.shift()!;
      lastRequestTime = Date.now();
      const cacheKey = JSON.stringify({ query: request.query, variables: request.variables });

      let attempts = 0;
      let success = false;
      let lastError: any = null;

      while (attempts < 2 && !success) {
        attempts++;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

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

          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const rateLimitReset = response.headers.get('X-RateLimit-Reset');

            let waitTime = 60000;
            if (retryAfter) {
              waitTime = parseInt(retryAfter, 10) * 1000;
            } else if (rateLimitReset) {
              waitTime = Math.max(0, parseInt(rateLimitReset, 10) * 1000 - Date.now());
            }

            cooldownUntil = Date.now() + waitTime;
            this.queue.unshift(request);
            break;
          }

          if (!response.ok) {
            throw new Error(`AniList GraphQL Gateway returned status HTTP ${response.status}`);
          }

          const json = await response.json();
          if (json.errors && json.errors.length > 0) {
            throw new Error(json.errors[0].message || 'GraphQL Query Error');
          }

          if (!json.data) {
            throw new Error('Empty GraphQL data payload');
          }

          const data = json.data;
          cache.set(cacheKey, { data, timestamp: Date.now(), expiry: Date.now() + 600000 });
          this.persistCache();

          request.resolve(data);
          success = true;
        } catch (err: any) {
          clearTimeout(timeoutId);
          lastError = err;

          if (attempts < 2) {
            await new Promise((r) => setTimeout(r, 1000 * attempts));
          }
        }
      }

      if (!success) {
        // If query failed after retries, check if we have any cached data (even expired)
        const fallbackCached = cache.get(cacheKey);
        if (fallbackCached) {
          console.warn(`Serving expired cached data for AniList query due to upstream error: ${lastError?.message}`);
          request.resolve(fallbackCached.data);
        } else {
          console.error(`AniList request failed: ${lastError?.message}`);
          request.reject(lastError);
        }
      }
    }

    this.isProcessing = false;
  }
}

export const aniListManager = AniListManager.getInstance();
