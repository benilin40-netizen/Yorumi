import { SERVER_CONFIG } from './config.js';
import { fetchProviderConfirmedEpisodes } from './providers.js';

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface TrailerOverride {
  anilistId: number;
  trailerId: string;
  site: string;
  updatedAt: number;
}

export interface ServerErrorLog {
  id: string;
  timestamp: number;
  service: string;
  message: string;
  statusCode?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();
const pending = new Map<string, Promise<any>>();
const trailerOverrides = new Map<number, TrailerOverride>();
const errorLogs: ServerErrorLog[] = [];

const metrics = {
  anilistRequests: 0,
  jikanRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  rateLimitBackoffs: 0,
  lastScheduleSyncAt: null as number | null,
  lastScheduleOk: true,
  lastScheduleError: null as string | null,
};

// Rate Limiters
// AniList: ~90 req/min -> safe budget 80 req/60s
const anilistTimestamps: number[] = [];
const ANILIST_WINDOW_MS = 60_000;
const ANILIST_MAX_PER_MIN = 80;

// Jikan: ~3 req/sec -> min 360ms spacing queue
let jikanNextAvailable = 0;

export function logServerError(service: string, message: string, statusCode?: number) {
  errorLogs.unshift({
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    service,
    message,
    statusCode,
  });
  if (errorLogs.length > 100) {
    errorLogs.length = 100;
  }
}

export function getApiUsageStats() {
  return {
    ...metrics,
    cachedKeys: cache.size,
    trailerOverridesCount: trailerOverrides.size,
    errorCount: errorLogs.length,
  };
}

export function getServerErrorLogs(): ServerErrorLog[] {
  return [...errorLogs];
}

export function clearServerErrorLogs(): void {
  errorLogs.length = 0;
}

export function clearExternalCache(): void {
  cache.clear();
}

export function getTrailerOverrides(): TrailerOverride[] {
  return Array.from(trailerOverrides.values());
}

export function setTrailerOverride(anilistId: number, trailerId: string, site = 'youtube'): TrailerOverride {
  const cleanId = extractYouTubeId(trailerId);
  const override: TrailerOverride = {
    anilistId,
    trailerId: cleanId,
    site,
    updatedAt: Date.now(),
  };
  trailerOverrides.set(anilistId, override);
  return override;
}

export function deleteTrailerOverride(anilistId: number): boolean {
  return trailerOverrides.delete(anilistId);
}

function extractYouTubeId(input: string): string {
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const u = new URL(trimmed);
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '').split('/')[0] || trimmed;
      }
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || trimmed;
    }
  } catch {
    // ignore URL parse error
  }
  return trimmed;
}

async function waitForAniListSlot(): Promise<void> {
  const now = Date.now();
  while (anilistTimestamps.length > 0 && now - anilistTimestamps[0] >= ANILIST_WINDOW_MS) {
    anilistTimestamps.shift();
  }
  if (anilistTimestamps.length >= ANILIST_MAX_PER_MIN) {
    const waitMs = Math.max(50, ANILIST_WINDOW_MS - (now - anilistTimestamps[0]) + 50);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  anilistTimestamps.push(Date.now());
}

async function waitForJikanSlot(): Promise<void> {
  const now = Date.now();
  if (now < jikanNextAvailable) {
    const delay = jikanNextAvailable - now;
    jikanNextAvailable = jikanNextAvailable + 360;
    await new Promise((r) => setTimeout(r, delay));
  } else {
    jikanNextAvailable = now + 360;
  }
}

const MEDIA_FIELDS = `
  id
  idMal
  title {
    english
    romaji
    native
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  description(asHtml: false)
  genres
  averageScore
  popularity
  season
  seasonYear
  startDate {
    year
    month
    day
  }
  episodes
  duration
  status
  format
  isAdult
  nextAiringEpisode {
    id
    episode
    airingAt
    timeUntilAiring
  }
  airingSchedule(notYetAired: false, perPage: 25) {
    nodes {
      id
      episode
      airingAt
    }
  }
  trailer {
    id
    site
    thumbnail
  }
  studios(isMain: true) {
    nodes {
      id
      name
      isAnimationStudio
    }
  }
`;

const MEDIA_FIELDS_FULL = `
  ${MEDIA_FIELDS}
  characters(sort: ROLE, perPage: 12) {
    edges {
      role
      node {
        id
        name {
          full
          native
        }
        image {
          large
        }
      }
    }
  }
  staff(perPage: 8) {
    edges {
      role
      node {
        id
        name {
          full
        }
      }
    }
  }
  relations {
    edges {
      relationType
      node {
        ${MEDIA_FIELDS}
      }
    }
  }
  recommendations(perPage: 10, sort: RATING_DESC) {
    nodes {
      mediaRecommendation {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

async function fetchAniListGraphQL<T>(
  query: string,
  variables: Record<string, any> = {},
  ttlMs = 5 * 60 * 1000
): Promise<T> {
  const cacheKey = `ali:${JSON.stringify({ query, variables })}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    metrics.cacheHits += 1;
    return cached.data as T;
  }
  metrics.cacheMisses += 1;

  if (pending.has(cacheKey)) {
    return pending.get(cacheKey) as Promise<T>;
  }

  const exec = (async () => {
    try {
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        await waitForAniListSlot();
        metrics.anilistRequests += 1;
        try {
          const res = await fetch(SERVER_CONFIG.anilistApiUrl, {
            method: 'POST',
            signal: AbortSignal.timeout(8000),
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ query, variables }),
          });

          if (res.status === 429 || res.status >= 500) {
            metrics.rateLimitBackoffs += 1;
            const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
            const backoffMs = retryAfter > 0 ? retryAfter * 1000 : 600 * Math.pow(2, attempt);
            lastErr = new Error(`AniList HTTP ${res.status}`);
            await new Promise((r) => setTimeout(r, Math.min(backoffMs, 4000)));
            continue;
          }

          if (!res.ok) {
            throw new Error(`AniList returned status ${res.status}`);
          }

          const json: any = await res.json();
          if (json.errors?.length) {
            throw new Error(json.errors[0].message || 'AniList GraphQL error');
          }

          cache.set(cacheKey, { data: json.data, expiresAt: Date.now() + ttlMs });
          return json.data as T;
        } catch (err: any) {
          lastErr = err instanceof Error ? err : new Error(String(err));
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
          }
        }
      }
      logServerError('AniList', lastErr?.message || 'AniList request failed');
      throw lastErr || new Error('AniList request failed');
    } finally {
      pending.delete(cacheKey);
    }
  })();

  pending.set(cacheKey, exec);
  return exec;
}

async function fetchJikanJson<T>(endpoint: string, ttlMs = 10 * 60 * 1000): Promise<T | null> {
  const cacheKey = `jik:${endpoint}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    metrics.cacheHits += 1;
    return cached.data as T;
  }
  metrics.cacheMisses += 1;

  if (pending.has(cacheKey)) {
    return pending.get(cacheKey) as Promise<T | null>;
  }

  const exec = (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        await waitForJikanSlot();
        metrics.jikanRequests += 1;
        try {
          const res = await fetch(`${SERVER_CONFIG.jikanApiUrl}${endpoint}`, {
            signal: AbortSignal.timeout(8000),
            headers: { Accept: 'application/json' },
          });
          if (res.status === 429 || res.status >= 500) {
            metrics.rateLimitBackoffs += 1;
            await new Promise((r) => setTimeout(r, 700 * Math.pow(2, attempt)));
            continue;
          }
          if (!res.ok) return null;
          const json: any = await res.json();
          cache.set(cacheKey, { data: json, expiresAt: Date.now() + ttlMs });
          return json as T;
        } catch (err: any) {
          if (attempt === 1) {
            logServerError('Jikan', err?.message || `Failed ${endpoint}`);
          }
        }
      }
      return null;
    } finally {
      pending.delete(cacheKey);
    }
  })();

  pending.set(cacheKey, exec);
  return exec;
}

export function computeAiredInfo(
  media: any,
  providerConfirmedCount?: number | null
): {
  airedEpisodes: number;
  lastAiredAt: number | null;
} {
  const nowSec = Math.floor(Date.now() / 1000);

  if (!media || media.status === 'NOT_YET_RELEASED') {
    return { airedEpisodes: 0, lastAiredAt: null };
  }

  let maxScheduleEp = 0;
  let lastAiredAt: number | null = null;

  const scheduleNodes: Array<{ episode: number; airingAt: number }> =
    media.airingSchedule?.nodes || [];
  for (const node of scheduleNodes) {
    if (typeof node.airingAt === 'number' && node.airingAt <= nowSec) {
      if (node.episode > maxScheduleEp) {
        maxScheduleEp = node.episode;
      }
      if (!lastAiredAt || node.airingAt > lastAiredAt) {
        lastAiredAt = node.airingAt;
      }
    }
  }

  if (media.nextAiringEpisode && typeof media.nextAiringEpisode.episode === 'number') {
    const nextEp = media.nextAiringEpisode.episode;
    const nextAt = media.nextAiringEpisode.airingAt;
    if (typeof nextAt === 'number' && nextAt <= nowSec) {
      maxScheduleEp = Math.max(maxScheduleEp, nextEp);
      if (!lastAiredAt || nextAt > lastAiredAt) lastAiredAt = nextAt;
    } else if (nextEp > 1) {
      maxScheduleEp = Math.max(maxScheduleEp, nextEp - 1);
    }
  }

  if (media.status === 'FINISHED' && typeof media.episodes === 'number' && media.episodes > 0) {
    return {
      airedEpisodes: media.episodes,
      lastAiredAt,
    };
  }

  // Also allow movies that are released (status FINISHED or startDate <= today)
  if (media.format === 'MOVIE' && !isMovieUnreleased(media)) {
    return {
      airedEpisodes: typeof media.episodes === 'number' && media.episodes > 0 ? media.episodes : 1,
      lastAiredAt,
    };
  }

  if (maxScheduleEp > 0) {
    return { airedEpisodes: maxScheduleEp, lastAiredAt };
  }

  if (typeof providerConfirmedCount === 'number' && providerConfirmedCount > 0) {
    // Cap to known total if total exists
    const capped =
      typeof media.episodes === 'number' && media.episodes > 0
        ? Math.min(providerConfirmedCount, media.episodes)
        : providerConfirmedCount;
    return { airedEpisodes: capped, lastAiredAt };
  }

  return { airedEpisodes: 0, lastAiredAt };
}

export function fuzzyDateToNumber(date?: FuzzyDate | null): number | null {
  if (!date || !date.year) return null;
  const month = date.month || 1;
  const day = date.day || 1;
  return date.year * 10000 + month * 100 + day;
}

export function isMovieUnreleased(media: any): boolean {
  if (!media) return true;
  if (media.status === 'NOT_YET_RELEASED') return true;
  const dateNum = fuzzyDateToNumber(media.startDate);
  if (dateNum !== null) {
    const now = new Date();
    const todayNum =
      now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    if (dateNum > todayNum) return true;
  }
  return false;
}

function enrichMedia(media: any, providerConfirmedCount?: number | null): any {
  if (!media) return media;
  const override = trailerOverrides.get(media.id);
  const { airedEpisodes, lastAiredAt } = computeAiredInfo(media, providerConfirmedCount);
  const isUnreleased =
    media.status === 'NOT_YET_RELEASED' ||
    (media.format === 'MOVIE' && isMovieUnreleased(media));

  return {
    ...media,
    airedEpisodes,
    lastAiredAt,
    isUnreleased,
    trailer: override
      ? { id: override.trailerId, site: override.site, thumbnail: media.trailer?.thumbnail || null }
      : media.trailer || null,
  };
}

export async function getTrendingAnime(page = 1, perPage = 12) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchAniListGraphQL<any>(query, { page, perPage });
  return {
    media: (data.Page?.media || []).map((m: any) => enrichMedia(m)),
    pageInfo: data.Page?.pageInfo,
  };
}

export async function getTrendingAiringAnime(page = 1, perPage = 14) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(status: RELEASING, sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchAniListGraphQL<any>(query, { page, perPage }, 3 * 60 * 1000);
  return {
    media: (data.Page?.media || []).map((m: any) => enrichMedia(m)),
    pageInfo: data.Page?.pageInfo,
  };
}

export async function getTopRatedAiringAnime(page = 1, perPage = 14) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(status: RELEASING, sort: SCORE_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchAniListGraphQL<any>(query, { page, perPage }, 5 * 60 * 1000);
  return {
    media: (data.Page?.media || []).map((m: any) => enrichMedia(m)),
    pageInfo: data.Page?.pageInfo,
  };
}

export async function getPopularAnime(page = 1, perPage = 12) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchAniListGraphQL<any>(query, { page, perPage });
  return {
    media: (data.Page?.media || []).map((m: any) => enrichMedia(m)),
    pageInfo: data.Page?.pageInfo,
  };
}

export async function getSeasonalAnime(season?: string, year?: number, page = 1, perPage = 18) {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  let currentSeason = season;
  if (!currentSeason) {
    const month = now.getMonth() + 1;
    if (month >= 1 && month <= 3) currentSeason = 'WINTER';
    else if (month >= 4 && month <= 6) currentSeason = 'SPRING';
    else if (month >= 7 && month <= 9) currentSeason = 'SUMMER';
    else currentSeason = 'FALL';
  }
  const query = `
    query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchAniListGraphQL<any>(query, {
    season: currentSeason,
    seasonYear: currentYear,
    page,
    perPage,
  });
  return {
    media: (data.Page?.media || []).map((m: any) => enrichMedia(m)),
    pageInfo: data.Page?.pageInfo,
  };
}

export async function getUpcomingAnime(page = 1, perPage = 18) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(status: NOT_YET_RELEASED, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchAniListGraphQL<any>(query, { page, perPage });
  return {
    media: (data.Page?.media || []).map((m: any) => enrichMedia(m)),
    pageInfo: data.Page?.pageInfo,
  };
}

export async function getAnimeMovies(page = 1, perPage = 24, releasedOnly = false) {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const fuzzyTomorrow =
    tomorrow.getFullYear() * 10000 + (tomorrow.getMonth() + 1) * 100 + tomorrow.getDate();

  const releasedQuery = `
    query ($page: Int, $perPage: Int, $dateLesser: FuzzyDateInt) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(
          format: MOVIE,
          status_in: [FINISHED, RELEASING],
          startDate_lesser: $dateLesser,
          sort: START_DATE_DESC,
          type: ANIME,
          isAdult: false
        ) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  const fetchCount = Math.min(50, Math.max(perPage * 2, 40));
  const data = await fetchAniListGraphQL<any>(releasedQuery, {
    page,
    perPage: fetchCount,
    dateLesser: fuzzyTomorrow,
  });

  let releasedList: any[] = (data.Page?.media || [])
    .map((m: any) => enrichMedia(m))
    .filter((m: any) => !m.isUnreleased);

  // Strictly newest first by release date (nulls last)
  releasedList.sort((a, b) => {
    const da = fuzzyDateToNumber(a.startDate);
    const db = fuzzyDateToNumber(b.startDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return db - da;
  });

  if (releasedOnly) {
    // Prefer movies with known release dates first, nulls strictly last
    return {
      media: releasedList.slice(0, perPage),
      pageInfo: data.Page?.pageInfo,
    };
  }

  // On the full Movies page (page 1), include a few upcoming movies marked Coming soon
  let combined = releasedList.slice(0, perPage);
  if (page === 1) {
    const upcomingMoviesQuery = `
      query {
        Page(page: 1, perPage: 6) {
          media(format: MOVIE, status: NOT_YET_RELEASED, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    try {
      const upData = await fetchAniListGraphQL<any>(upcomingMoviesQuery, {}, 10 * 60 * 1000);
      const upcomingList = (upData.Page?.media || []).map((m: any) => enrichMedia(m));
      const existingIds = new Set(combined.map((m: any) => m.id));
      const extra = upcomingList.filter((m: any) => !existingIds.has(m.id));
      combined = [...combined.slice(0, Math.max(0, perPage - extra.length)), ...extra];
    } catch {
      // ignore upcoming movie supplement failure
    }
  }

  return {
    media: combined,
    pageInfo: data.Page?.pageInfo,
  };
}

export async function getRecentlyUpdatedAiring(limit = 16) {
  const nowSec = Math.floor(Date.now() / 1000);
  const weekAgo = nowSec - 7 * 86400;
  const query = `
    query ($airingAtGreater: Int, $airingAtLesser: Int, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME_DESC) {
          id
          airingAt
          episode
          media {
            ${MEDIA_FIELDS}
          }
        }
      }
    }
  `;
  const data = await fetchAniListGraphQL<any>(
    query,
    { airingAtGreater: weekAgo, airingAtLesser: nowSec, perPage: 50 },
    2 * 60 * 1000
  );
  const schedules: any[] = data.Page?.airingSchedules || [];
  const seen = new Set<number>();
  const items: any[] = [];

  for (const s of schedules) {
    const m = s.media;
    if (!m || m.isAdult || m.status !== 'RELEASING') continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);

    const enriched = enrichMedia(m);
    enriched.airedEpisodes = Math.max(enriched.airedEpisodes || 0, s.episode || 0);
    enriched.lastAiredAt = s.airingAt;
    enriched.latestAiredEpisode = s.episode;
    items.push(enriched);
    if (items.length >= limit) break;
  }
  return items;
}

export async function getAiringSchedule(
  airingAtGreater: number,
  airingAtLesser: number,
  page = 1,
  perPage = 50
) {
  const query = `
    query ($airingAtGreater: Int, $airingAtLesser: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
          id
          airingAt
          timeUntilAiring
          episode
          media {
            ${MEDIA_FIELDS}
          }
        }
      }
    }
  `;
  try {
    const data = await fetchAniListGraphQL<any>(
      query,
      { airingAtGreater, airingAtLesser, page, perPage },
      2 * 60 * 1000
    );
    metrics.lastScheduleSyncAt = Date.now();
    metrics.lastScheduleOk = true;
    metrics.lastScheduleError = null;
    const rows = (data.Page?.airingSchedules || [])
      .filter((item: any) => item.media && !item.media.isAdult)
      .map((item: any) => ({
        ...item,
        media: enrichMedia(item.media),
      }));
    return rows;
  } catch (err: any) {
    metrics.lastScheduleSyncAt = Date.now();
    metrics.lastScheduleOk = false;
    metrics.lastScheduleError = err?.message || 'Schedule fetch failed';
    return [];
  }
}

export async function getAnimeById(id: number) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS_FULL}
      }
    }
  `;
  try {
    const data = await fetchAniListGraphQL<any>(query, { id }, 10 * 60 * 1000);
    let media = data.Media || null;
    if (!media) return null;

    // Jikan fallback for missing metadata fields when idMal exists
    const needsFallback =
      !media.description ||
      !media.trailer ||
      media.averageScore == null ||
      (media.status === 'FINISHED' && media.episodes == null);

    if (needsFallback && media.idMal) {
      const jik = await fetchJikanJson<any>(`/anime/${media.idMal}`);
      const jd = jik?.data;
      if (jd) {
        if (!media.description && jd.synopsis) {
          media.description = jd.synopsis;
        }
        if (media.averageScore == null && typeof jd.score === 'number') {
          media.averageScore = Math.round(jd.score * 10);
        }
        if (media.episodes == null && media.status === 'FINISHED' && typeof jd.episodes === 'number') {
          media.episodes = jd.episodes;
        }
        if (!media.trailer && jd.trailer?.youtube_id) {
          media.trailer = {
            id: jd.trailer.youtube_id,
            site: 'youtube',
            thumbnail: jd.trailer.images?.maximum_image_url || null,
          };
        }
      }
    }

    // Confirm aired episodes via providers if airing and schedule is sparse
    let providerConfirmed: number | null = null;
    const initialAired = computeAiredInfo(media);
    if (media.status === 'RELEASING' && initialAired.airedEpisodes === 0) {
      const prov = await fetchProviderConfirmedEpisodes(media.id, media.idMal);
      providerConfirmed = prov.confirmedCount;
    }

    return enrichMedia(media, providerConfirmed);
  } catch (err: any) {
    logServerError('AniList', `getAnimeById(${id}): ${err?.message || err}`);
    return null;
  }
}

export async function getConfirmedEpisodesForAnime(id: number): Promise<{
  anilistId: number;
  status: string;
  totalEpisodes: number | null;
  airedEpisodes: Array<{ episode: number; airingAt: number | null; confirmedBy: 'anilist' | 'provider' }>;
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null;
}> {
  const anime = await getAnimeById(id);
  if (!anime) {
    return {
      anilistId: id,
      status: 'UNKNOWN',
      totalEpisodes: null,
      airedEpisodes: [],
      nextAiringEpisode: null,
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (anime.status === 'NOT_YET_RELEASED' || anime.isUnreleased) {
    return {
      anilistId: id,
      status: anime.status,
      totalEpisodes: anime.episodes ?? null,
      airedEpisodes: [],
      nextAiringEpisode: anime.nextAiringEpisode || null,
    };
  }

  const scheduleMap = new Map<number, number>();
  for (const node of anime.airingSchedule?.nodes || []) {
    if (typeof node.airingAt === 'number' && node.airingAt <= nowSec) {
      scheduleMap.set(node.episode, node.airingAt);
    }
  }

  let maxConfirmed = 0;
  let confirmedBy: 'anilist' | 'provider' = 'anilist';

  if (anime.status === 'FINISHED' && typeof anime.episodes === 'number' && anime.episodes > 0) {
    maxConfirmed = anime.episodes;
  } else if (anime.format === 'MOVIE' && !anime.isUnreleased) {
    maxConfirmed = typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : 1;
  } else {
    if (anime.nextAiringEpisode) {
      if (anime.nextAiringEpisode.airingAt <= nowSec) {
        maxConfirmed = Math.max(maxConfirmed, anime.nextAiringEpisode.episode);
      } else if (anime.nextAiringEpisode.episode > 1) {
        maxConfirmed = Math.max(maxConfirmed, anime.nextAiringEpisode.episode - 1);
      }
    }
    for (const ep of scheduleMap.keys()) {
      if (ep > maxConfirmed) maxConfirmed = ep;
    }

    // Cross-check with provider lookup (fast 1.5s cap if AniList already confirmed >= 1 ep)
    const timeoutMs = maxConfirmed > 0 ? 1500 : 3500;
    const prov = await Promise.race([
      fetchProviderConfirmedEpisodes(anime.id, anime.idMal),
      new Promise<{ confirmedCount: number | null; sources: Record<string, never> }>((resolve) =>
        setTimeout(() => resolve({ confirmedCount: null, sources: {} }), timeoutMs)
      ),
    ]);
    if (prov.confirmedCount && prov.confirmedCount > maxConfirmed) {
      // Only take provider count if no nextAiringEpisode contradicts it
      if (!anime.nextAiringEpisode || prov.confirmedCount < anime.nextAiringEpisode.episode) {
        maxConfirmed =
          typeof anime.episodes === 'number' && anime.episodes > 0
            ? Math.min(prov.confirmedCount, anime.episodes)
            : prov.confirmedCount;
        confirmedBy = 'provider';
      }
    }
  }

  const airedEpisodes: Array<{ episode: number; airingAt: number | null; confirmedBy: 'anilist' | 'provider' }> = [];
  for (let ep = 1; ep <= maxConfirmed; ep++) {
    airedEpisodes.push({
      episode: ep,
      airingAt: scheduleMap.get(ep) ?? null,
      confirmedBy: scheduleMap.has(ep) ? 'anilist' : confirmedBy,
    });
  }

  return {
    anilistId: id,
    status: anime.status,
    totalEpisodes: anime.episodes ?? null,
    airedEpisodes,
    nextAiringEpisode:
      anime.nextAiringEpisode && anime.nextAiringEpisode.airingAt > nowSec
        ? anime.nextAiringEpisode
        : null,
  };
}

export async function searchAnime(filters: {
  search?: string;
  genre?: string;
  year?: number;
  season?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}) {
  const {
    search,
    genre,
    year,
    season,
    format,
    status,
    sort = 'POPULARITY_DESC',
    page = 1,
    perPage = 18,
  } = filters;

  const variables: Record<string, any> = {
    page,
    perPage,
    sort: [sort],
  };
  if (search && search.trim() !== '') variables.search = search.trim();
  if (genre) variables.genre = genre;
  if (year) variables.seasonYear = year;
  if (season) variables.season = season;
  if (format) variables.format = format;
  if (status) variables.status = status;

  const query = `
    query (
      $page: Int,
      $perPage: Int,
      $search: String,
      $genre: String,
      $seasonYear: Int,
      $season: MediaSeason,
      $format: MediaFormat,
      $status: MediaStatus,
      $sort: [MediaSort]
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(
          search: $search,
          genre: $genre,
          seasonYear: $seasonYear,
          season: $season,
          format: $format,
          status: $status,
          sort: $sort,
          type: ANIME,
          isAdult: false
        ) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await fetchAniListGraphQL<any>(query, variables, 3 * 60 * 1000);
  return {
    media: (data.Page?.media || []).map((m: any) => enrichMedia(m)),
    pageInfo: data.Page?.pageInfo,
  };
}

export async function getJikanNews(malId: number): Promise<any[]> {
  const json = await fetchJikanJson<any>(`/anime/${malId}/news`, 10 * 60 * 1000);
  return json?.data || [];
}

export async function getHomePayload() {
  const nowSec = Math.floor(Date.now() / 1000);
  const [
    trendingAiringRes,
    recentlyUpdatedRes,
    topRatedAiringRes,
    upcomingRes,
    moviesRes,
    schedulePage1,
  ] = await Promise.all([
    getTrendingAiringAnime(1, 16),
    getRecentlyUpdatedAiring(16),
    getTopRatedAiringAnime(1, 14),
    getUpcomingAnime(1, 14),
    getAnimeMovies(1, 14, true),
    getAiringSchedule(nowSec - 86400, nowSec + 7 * 86400, 1, 50),
  ]);

  // Hero: ONLY currently airing anime (RELEASING) with at least one aired episode
  const heroPool = [...trendingAiringRes.media];
  for (const item of recentlyUpdatedRes) {
    if (!heroPool.some((h) => h.id === item.id)) {
      heroPool.push(item);
    }
  }
  const hero = heroPool
    .filter((m) => m.status === 'RELEASING' && (m.airedEpisodes || 0) >= 1)
    .slice(0, 6);

  return {
    hero,
    recentlyUpdated: recentlyUpdatedRes,
    trendingAiring: trendingAiringRes.media,
    topRatedAiring: topRatedAiringRes.media,
    upcoming: upcomingRes.media,
    movies: moviesRes.media,
    schedule: schedulePage1,
  };
}
