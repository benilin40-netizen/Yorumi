import { Anime } from '../types/anime';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

const ANILIST_URL = 'https://graphql.anilist.co';
const MIN_INTERVAL = 2200; // 2.2 seconds
let lastRequestTime = 0;
let cooldownUntil = 0;

const cache = new Map<string, CacheEntry<any>>();

export class AniListManager {
  private static instance: AniListManager;
  private queue: { query: string; variables: any; resolve: (data: any) => void; reject: (err: any) => void }[] = [];
  private isProcessing = false;

  private constructor() {
    // Load from localStorage
    const saved = localStorage.getItem('anilist_cache');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([key, value]) => {
          cache.set(key, value as CacheEntry<any>);
        });
      } catch (e) {
        console.error('Failed to load AniList cache:', e);
      }
    }
  }

  private persistCache() {
    localStorage.setItem('anilist_cache', JSON.stringify(Object.fromEntries(cache)));
  }

  static getInstance(): AniListManager {
    if (!AniListManager.instance) {
      AniListManager.instance = new AniListManager();
    }
    return AniListManager.instance;
  }

  async request<T>(query: string, variables: any = {}, cacheDuration: number = 300000): Promise<T> {
    const cacheKey = JSON.stringify({ query, variables });
    
    // Check Cache
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
      
      // Check Cooldown
      if (now < cooldownUntil) {
        await new Promise(resolve => setTimeout(resolve, cooldownUntil - now));
      }

      // Check Interval
      const timeSinceLast = now - lastRequestTime;
      if (timeSinceLast < MIN_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - timeSinceLast));
      }

      const request = this.queue.shift()!;
      lastRequestTime = Date.now();

      try {
        const response = await fetch(ANILIST_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ query: request.query, variables: request.variables }),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const rateLimitReset = response.headers.get('X-RateLimit-Reset');
          
          let waitTime = 60000;
          if (retryAfter) {
            waitTime = parseInt(retryAfter) * 1000;
          } else if (rateLimitReset) {
            waitTime = Math.max(0, parseInt(rateLimitReset) * 1000 - Date.now());
          }
          
          cooldownUntil = Date.now() + waitTime;
          // Re-queue
          this.queue.unshift(request);
          continue;
        }

        if (!response.ok) throw new Error(`AniList returned status ${response.status}`);

        const json = await response.json();
        if (json.errors) throw new Error(json.errors[0].message);

        const data = json.data;
        const cacheKey = JSON.stringify({ query: request.query, variables: request.variables });
        cache.set(cacheKey, { data, timestamp: Date.now(), expiry: Date.now() + 300000 }); // Default 5m
        this.persistCache();

        request.resolve(data);
      } catch (err) {
        request.reject(err);
      }
    }
    this.isProcessing = false;
  }
}

export const aniListManager = AniListManager.getInstance();
