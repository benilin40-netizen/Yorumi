import { Anime, ConfirmedEpisodesResponse } from '../types/anime';

export interface HomeFeedResponse {
  hero: Anime[];
  recentlyUpdated: Anime[];
  trendingAiring: Anime[];
  topRatedAiring: Anime[];
  upcoming: Anime[];
  movies: Anime[];
  schedule: any[];
}

export interface DiscoverFilters {
  search?: string;
  genre?: string;
  year?: number;
  season?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || !contentType.includes('application/json')) {
    let errText = `API request failed: ${res.status}`;
    try {
      const text = await res.text();
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text);
        if (json.error) errText = json.error;
      } else if (text.includes('<!doctype') || text.includes('<html')) {
        errText = `API endpoint returned HTML instead of JSON (HTTP ${res.status}). Check server routing.`;
      } else if (text.trim()) {
        errText = text.slice(0, 150);
      }
    } catch {
      // ignore parse fail
    }
    throw new Error(`API request to ${url} failed (HTTP ${res.status}): ${errText.slice(0, 100)}`);
  }
  return res.json();
}

export async function getHomeFeed(): Promise<HomeFeedResponse> {
  return getJson<HomeFeedResponse>('/api/home');
}

export async function getTrendingAnime(
  page = 1,
  perPage = 18
): Promise<{ media: Anime[]; pageInfo: any; isFallback?: boolean }> {
  return getJson(`/api/anime/trending?page=${page}&perPage=${perPage}`);
}

export async function getTrendingAiringAnime(
  page = 1,
  perPage = 14
): Promise<{ media: Anime[]; pageInfo: any; isFallback?: boolean }> {
  return getJson(`/api/anime/trending?page=${page}&perPage=${perPage}&airingOnly=true`);
}

export async function getTopRatedAiringAnime(
  page = 1,
  perPage = 14
): Promise<{ media: Anime[]; pageInfo: any; isFallback?: boolean }> {
  return getJson(`/api/anime/top-rated-airing?page=${page}&perPage=${perPage}`);
}

export const getTopRatedAnime = getTopRatedAiringAnime;

export async function getRecentlyUpdatedAiring(limit = 16): Promise<{ media: Anime[] }> {
  return getJson(`/api/anime/recently-updated?limit=${limit}`);
}

export async function getPopularAnime(
  page = 1,
  perPage = 18
): Promise<{ media: Anime[]; pageInfo: any; isFallback?: boolean }> {
  return getJson(`/api/anime/popular?page=${page}&perPage=${perPage}`);
}

export async function getSeasonalAnime(
  season?: string,
  year?: number,
  page = 1,
  perPage = 24
): Promise<{ media: Anime[]; pageInfo: any; isFallback?: boolean }> {
  const qs = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (season) qs.set('season', season);
  if (year) qs.set('year', String(year));
  return getJson(`/api/anime/seasonal?${qs.toString()}`);
}

export async function getUpcomingAnime(
  page = 1,
  perPage = 24
): Promise<{ media: Anime[]; pageInfo: any; isFallback?: boolean }> {
  return getJson(`/api/anime/upcoming?page=${page}&perPage=${perPage}`);
}

export async function getAnimeMovies(
  page = 1,
  perPage = 24,
  releasedOnly = false
): Promise<{ media: Anime[]; pageInfo: any; isFallback?: boolean }> {
  return getJson(`/api/anime/movies?page=${page}&perPage=${perPage}&releasedOnly=${releasedOnly}`);
}

export async function getAnimeById(id: number): Promise<Anime | null> {
  try {
    const res = await getJson<{ media: Anime }>(`/api/anime/${id}`);
    return res.media || null;
  } catch {
    return null;
  }
}

export async function getAnimeEpisodes(id: number): Promise<ConfirmedEpisodesResponse | null> {
  try {
    return await getJson<ConfirmedEpisodesResponse>(`/api/anime/${id}/episodes`);
  } catch {
    return null;
  }
}

export async function getAiringSchedule(
  airingAtGreater: number,
  airingAtLesser: number,
  page = 1,
  perPage = 50
): Promise<any[]> {
  try {
    const qs = new URLSearchParams({
      start: String(airingAtGreater),
      end: String(airingAtLesser),
      page: String(page),
      perPage: String(perPage),
    });
    const res = await getJson<{ schedules: any[] }>(`/api/anime/schedule?${qs.toString()}`);
    return res.schedules || [];
  } catch {
    return [];
  }
}

export async function searchAnime(
  filters: DiscoverFilters = {}
): Promise<{ media: Anime[]; pageInfo: any; isFallback?: boolean }> {
  const qs = new URLSearchParams();
  if (filters.search) qs.set('search', filters.search);
  if (filters.genre) qs.set('genre', filters.genre);
  if (filters.year) qs.set('year', String(filters.year));
  if (filters.season) qs.set('season', filters.season);
  if (filters.format) qs.set('format', filters.format);
  if (filters.status) qs.set('status', filters.status);
  if (filters.sort) qs.set('sort', filters.sort);
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.perPage) qs.set('perPage', String(filters.perPage));
  return getJson(`/api/anime/search?${qs.toString()}`);
}
