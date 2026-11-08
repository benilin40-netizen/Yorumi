import { safeFetchJson } from '../utils/apiClient';

interface JikanCacheItem<T> {
  data: T;
  timestamp: number;
}
const jikanCache = new Map<string, JikanCacheItem<any>>();
const JIKAN_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function fetchJikanNews(malId: number): Promise<any[]> {
  const cacheKey = `jikan_news_${malId}`;
  const cached = jikanCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < JIKAN_CACHE_TTL) {
    return cached.data;
  }

  // Try backend proxy endpoint first
  const proxyResult = await safeFetchJson<{ data?: any[] }>(`/api/jikan/news/${malId}`, { timeoutMs: 6000 });
  if (proxyResult.ok && Array.isArray(proxyResult.data?.data)) {
    const articles = proxyResult.data!.data!;
    jikanCache.set(cacheKey, { data: articles, timestamp: Date.now() });
    return articles;
  }

  // Fallback to direct Jikan API request
  const directResult = await safeFetchJson<{ data?: any[] }>(`https://api.jikan.moe/v4/anime/${malId}/news`, { timeoutMs: 6000 });
  if (directResult.ok && Array.isArray(directResult.data?.data)) {
    const articles = directResult.data!.data!;
    jikanCache.set(cacheKey, { data: articles, timestamp: Date.now() });
    return articles;
  }

  return [];
}

export async function testJikanConnectivity(): Promise<{
  ok: boolean;
  latencyMs: number;
  contentType?: string;
  errorPreview?: string;
}> {
  const start = Date.now();
  const res = await safeFetchJson<{ status?: string }>('/api/jikan/anime/1', { timeoutMs: 5000 });
  const latencyMs = Date.now() - start;

  if (res.ok) {
    return { ok: true, latencyMs, contentType: res.contentType };
  }

  // Fallback to direct ping
  const directStart = Date.now();
  const directRes = await safeFetchJson('https://api.jikan.moe/v4/anime/1', { timeoutMs: 5000 });
  return {
    ok: directRes.ok,
    latencyMs: Date.now() - directStart,
    contentType: directRes.contentType,
    errorPreview: directRes.errorPreview || res.errorPreview,
  };
}
