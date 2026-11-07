const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

interface JikanCacheItem<T> {
  data: T;
  timestamp: number;
}
const jikanCache = new Map<string, JikanCacheItem<any>>();
const JIKAN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchJikanNews(malId: number): Promise<any[]> {
  const cacheKey = `jikan_news_${malId}`;
  const cached = jikanCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < JIKAN_CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`${JIKAN_BASE_URL}/anime/${malId}/news`);
    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Jikan API rate limit hit.');
      }
      return [];
    }
    const json = await response.json();
    const articles = json.data || [];
    jikanCache.set(cacheKey, { data: articles, timestamp: Date.now() });
    return articles;
  } catch (err) {
    console.error(`Error fetching Jikan news for MAL ID ${malId}:`, err);
    return [];
  }
}

export async function testJikanConnectivity(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${JIKAN_BASE_URL}/anime/1`, { method: 'GET' });
    const latencyMs = Date.now() - start;
    return { ok: res.ok, latencyMs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
