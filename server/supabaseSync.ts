import { isSupabaseAdminConfigured, supabaseAdmin } from './supabaseAdmin.js';
import {
  getHomePayload,
  getTrendingAiringAnime,
  getTopRatedAiringAnime,
  getUpcomingAnime,
  getAnimeMovies,
  getRecentlyUpdatedAiring,
  getAiringSchedule,
  getAnimeById,
  getConfirmedEpisodesForAnime,
  logServerError,
  setTrailerOverride,
  deleteTrailerOverride,
  clearExternalCache,
  fuzzyDateToNumber,
} from './externalData.js';
import type {
  AdminOverviewRpc,
  AnimeRow,
  SyncRunRow,
} from '../src/types/supabase.js';
import type { ProviderId } from './providers.js';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncRunning = false;
const localHiddenAnimeIds = new Set<number>();

export function isAnimeHiddenLocal(anilistId: number): boolean {
  return localHiddenAnimeIds.has(anilistId);
}

export function setAnimeHiddenLocal(anilistId: number, hidden: boolean): void {
  if (hidden) localHiddenAnimeIds.add(anilistId);
  else localHiddenAnimeIds.delete(anilistId);
}

// Convert a Supabase anime / view row into the frontend Anime object
export function mapSupabaseAnimeRowToFrontend(row: any): any {
  const anilistId = row.anilist_id ?? row.id;
  const trailerId = row.trailer_override_id || row.trailer_id || null;
  const startDate =
    row.start_date && typeof row.start_date === 'object'
      ? row.start_date
      : { year: row.season_year ?? null, month: null, day: null };

  return {
    id: anilistId,
    idMal: row.id_mal ?? null,
    title: {
      english: row.title_english ?? null,
      romaji: row.title_romaji ?? row.title_english ?? `Anime #${anilistId}`,
      native: row.title_native ?? null,
    },
    coverImage: {
      extraLarge: row.cover_image || '',
      large: row.cover_image || '',
      medium: row.cover_image || '',
      color: null,
    },
    bannerImage: row.banner_image || null,
    description: row.description || null,
    genres: Array.isArray(row.genres) ? row.genres : [],
    averageScore: row.average_score ?? null,
    popularity: row.popularity ?? null,
    season: row.season ?? null,
    seasonYear: row.season_year ?? null,
    startDate,
    episodes: row.episodes ?? null,
    airedEpisodes: row.aired_episodes ?? row.latest_aired_episode ?? 0,
    lastAiredAt: row.last_aired_at ?? null,
    latestAiredEpisode: row.latest_aired_episode ?? row.aired_episodes ?? undefined,
    isUnreleased: row.status === 'NOT_YET_RELEASED',
    duration: row.duration ?? null,
    status: row.status || 'RELEASING',
    format: row.format || 'TV',
    trailer: trailerId
      ? {
          id: trailerId,
          site: row.trailer_site || 'youtube',
          thumbnail: null,
        }
      : null,
    nextAiringEpisode:
      row.next_episode && row.next_airing_at
        ? {
            id: row.next_episode,
            episode: row.next_episode,
            airingAt: row.next_airing_at,
            timeUntilAiring: Math.max(0, row.next_airing_at - Math.floor(Date.now() / 1000)),
          }
        : null,
    hidden: Boolean(row.hidden),
  };
}

function mapFrontendAnimeToSupabaseRow(anime: any): AnimeRow {
  return {
    anilist_id: anime.id,
    id_mal: anime.idMal ?? null,
    title_english: anime.title?.english ?? null,
    title_romaji: anime.title?.romaji || anime.title?.english || `Anime #${anime.id}`,
    title_native: anime.title?.native ?? null,
    cover_image: anime.coverImage?.extraLarge || anime.coverImage?.large || null,
    banner_image: anime.bannerImage ?? null,
    description: anime.description ?? null,
    genres: Array.isArray(anime.genres) ? anime.genres : [],
    average_score: anime.averageScore ?? null,
    popularity: anime.popularity ?? null,
    season: anime.season ?? null,
    season_year: anime.seasonYear ?? null,
    start_date: anime.startDate ?? null,
    episodes: anime.episodes ?? null,
    aired_episodes: anime.airedEpisodes ?? 0,
    duration: anime.duration ?? null,
    status: anime.status || null,
    format: anime.format || null,
    trailer_id: anime.trailer?.id ?? null,
    trailer_site: anime.trailer?.site ?? null,
    next_episode: anime.nextAiringEpisode?.episode ?? null,
    next_airing_at: anime.nextAiringEpisode?.airingAt ?? null,
    last_aired_at: anime.lastAiredAt ?? null,
    latest_aired_episode: anime.latestAiredEpisode ?? anime.airedEpisodes ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function runSupabaseCatalogSync(): Promise<SyncRunRow> {
  const startedAt = new Date().toISOString();
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return {
      status: 'skipped',
      items_fetched: 0,
      items_playable: 0,
      items_skipped: 0,
      pages_fetched: 0,
      error: 'SUPABASE_SERVICE_ROLE_KEY not configured',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };
  }

  if (syncRunning) {
    return {
      status: 'running',
      items_fetched: 0,
      items_playable: 0,
      items_skipped: 0,
      pages_fetched: 0,
      error: 'Sync already in progress',
      started_at: startedAt,
    };
  }

  syncRunning = true;
  let itemsFetched = 0;
  let itemsPlayable = 0;
  let itemsSkipped = 0;
  let pagesFetched = 0;
  let errorMsg: string | null = null;

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const [
      trendingAiringRes,
      recentlyUpdatedList,
      topRatedAiringRes,
      upcomingRes,
      moviesRes,
      scheduleList,
    ] = await Promise.all([
      getTrendingAiringAnime(1, 20),
      getRecentlyUpdatedAiring(20),
      getTopRatedAiringAnime(1, 16),
      getUpcomingAnime(1, 16),
      getAnimeMovies(1, 20, false),
      getAiringSchedule(nowSec - 86400, nowSec + 7 * 86400, 1, 50),
    ]);
    pagesFetched = 6;

    const mergedMap = new Map<number, any>();
    for (const list of [
      trendingAiringRes.media,
      recentlyUpdatedList,
      topRatedAiringRes.media,
      upcomingRes.media,
      moviesRes.media,
    ]) {
      for (const item of list || []) {
        if (item?.id) mergedMap.set(item.id, item);
      }
    }

    const uniqueMedia = Array.from(mergedMap.values());
    itemsFetched = uniqueMedia.length;

    const animeRows: AnimeRow[] = [];
    for (const item of uniqueMedia) {
      if (!item.id || !item.title) {
        itemsSkipped += 1;
        continue;
      }
      animeRows.push(mapFrontendAnimeToSupabaseRow(item));
      if ((item.airedEpisodes ?? 0) > 0 && item.status !== 'NOT_YET_RELEASED') {
        itemsPlayable += 1;
      }
    }

    if (animeRows.length > 0) {
      const { error: upsertAnimeErr } = await supabaseAdmin
        .from('anime')
        .upsert(animeRows as any, { onConflict: 'anilist_id' });
      if (upsertAnimeErr) {
        throw new Error(`anime upsert failed: ${upsertAnimeErr.message}`);
      }
    }

    // Sync confirmed & aired episodes only (verified = true, never invent placeholder episodes)
    const playableSubset = uniqueMedia
      .filter((m) => m.status === 'RELEASING' && (m.airedEpisodes ?? 0) > 0)
      .slice(0, 12);

    const episodeRows: any[] = [];
    for (const show of playableSubset) {
      try {
        const confirmed = await getConfirmedEpisodesForAnime(show.id);
        for (const ep of confirmed.airedEpisodes) {
          episodeRows.push({
            anilist_id: show.id,
            episode_number: ep.episode,
            airing_at: ep.airingAt,
            verified: true,
            confirmed_by: ep.confirmedBy,
            updated_at: new Date().toISOString(),
          });
        }
      } catch {
        // skip individual show failure without halting sync
      }
    }

    if (episodeRows.length > 0) {
      const { error: epErr } = await supabaseAdmin
        .from('episodes')
        .upsert(episodeRows as any, { onConflict: 'anilist_id,episode_number' });
      if (epErr) {
        logServerError('SupabaseSync', `episodes upsert warning: ${epErr.message}`);
      }
    }

    // Sync airing_schedule
    const scheduleRows = (scheduleList || [])
      .filter((s: any) => s?.media?.id && s?.episode && s?.airingAt)
      .map((s: any) => ({
        anilist_id: s.media.id,
        episode_number: s.episode,
        airing_at: s.airingAt,
        time_until_airing: s.timeUntilAiring ?? null,
        updated_at: new Date().toISOString(),
      }));

    if (scheduleRows.length > 0) {
      const { error: schedErr } = await supabaseAdmin
        .from('airing_schedule')
        .upsert(scheduleRows as any, { onConflict: 'anilist_id,episode_number' });
      if (schedErr) {
        logServerError('SupabaseSync', `airing_schedule upsert warning: ${schedErr.message}`);
      }
    }

    const finishedAt = new Date().toISOString();
    const runRecord: SyncRunRow = {
      status: 'completed',
      items_fetched: itemsFetched,
      items_playable: itemsPlayable,
      items_skipped: itemsSkipped,
      pages_fetched: pagesFetched,
      error: null,
      started_at: startedAt,
      finished_at: finishedAt,
    };

    await supabaseAdmin.from('sync_runs').insert(runRecord as any);
    return runRecord;
  } catch (err: any) {
    const safeError = err?.message || 'Catalog sync failed';
    errorMsg = safeError;
    logServerError('SupabaseSync', safeError);
    const failedRecord: SyncRunRow = {
      status: 'failed',
      items_fetched: itemsFetched,
      items_playable: itemsPlayable,
      items_skipped: itemsSkipped,
      pages_fetched: pagesFetched,
      error: errorMsg,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };
    try {
      await supabaseAdmin?.from('sync_runs').insert(failedRecord as any);
    } catch {
      // ignore logging error
    }
    return failedRecord;
  } finally {
    syncRunning = false;
  }
}

export function startSupabaseCatalogSyncSchedule(): void {
  if (syncTimer) return;
  if (!isSupabaseAdminConfigured()) return;

  // Defer initial sync by 3s so server binds port cleanly
  setTimeout(() => {
    runSupabaseCatalogSync().catch(() => {});
  }, 3000);

  syncTimer = setInterval(() => {
    runSupabaseCatalogSync().catch(() => {});
  }, SYNC_INTERVAL_MS);
}

// ---------------------------------------------------------------
// Catalog Readers: Supabase First -> Transparent Live AniList Fallback
// ---------------------------------------------------------------
export async function getHomePayloadWithSupabase() {
  if (isSupabaseAdminConfigured() && supabaseAdmin) {
    try {
      const [recentlyRes, moviesRes, airingRes, upcomingRes, scheduleRes] = await Promise.all([
        supabaseAdmin.from('recently_updated').select('*').limit(16),
        supabaseAdmin.from('movies_latest').select('*').limit(14),
        supabaseAdmin
          .from('anime')
          .select('*')
          .eq('status', 'RELEASING')
          .order('popularity', { ascending: false })
          .limit(24),
        supabaseAdmin
          .from('anime')
          .select('*')
          .eq('status', 'NOT_YET_RELEASED')
          .order('popularity', { ascending: false })
          .limit(14),
        supabaseAdmin
          .from('airing_schedule')
          .select('*')
          .gte('airing_at', Math.floor(Date.now() / 1000) - 86400)
          .order('airing_at', { ascending: true })
          .limit(50),
      ]);

      const recentlyRows = (recentlyRes.data || [])
        .filter((r: any) => !r.hidden && !localHiddenAnimeIds.has(r.anilist_id ?? r.id) && r.status === 'RELEASING')
        .map(mapSupabaseAnimeRowToFrontend);

      const movieRows = (moviesRes.data || [])
        .filter((r: any) => !r.hidden && !localHiddenAnimeIds.has(r.anilist_id ?? r.id) && r.status !== 'NOT_YET_RELEASED')
        .map(mapSupabaseAnimeRowToFrontend)
        .sort((a: any, b: any) => {
          const da = fuzzyDateToNumber(a.startDate);
          const db = fuzzyDateToNumber(b.startDate);
          if (da === null && db === null) return 0;
          if (da === null) return 1;
          if (db === null) return -1;
          return db - da;
        });

      const airingMapped = (airingRes.data || [])
        .filter((r: any) => !r.hidden && !localHiddenAnimeIds.has(r.anilist_id ?? r.id))
        .map(mapSupabaseAnimeRowToFrontend);

      const upcomingMapped = (upcomingRes.data || [])
        .filter((r: any) => !r.hidden && !localHiddenAnimeIds.has(r.anilist_id ?? r.id))
        .map(mapSupabaseAnimeRowToFrontend);

      // Build Hero strictly from RELEASING anime with >= 1 aired episode
      const heroPool = [...airingMapped, ...recentlyRows];
      const seenHero = new Set<number>();
      const hero = heroPool
        .filter((m) => {
          if (m.status !== 'RELEASING' || (m.airedEpisodes || 0) < 1) return false;
          if (seenHero.has(m.id)) return false;
          seenHero.add(m.id);
          return true;
        })
        .slice(0, 6);

      // Only serve Supabase payload if primary sections are populated; otherwise fall back to AniList
      if (hero.length > 0 && recentlyRows.length > 0 && movieRows.length > 0) {
        const animeById = new Map<number, any>();
        for (const m of [...airingMapped, ...recentlyRows]) animeById.set(m.id, m);

        const schedule = (scheduleRes.data || [])
          .filter((s: any) => animeById.has(s.anilist_id))
          .map((s: any) => ({
            id: s.id ?? `${s.anilist_id}_${s.episode_number}`,
            airingAt: s.airing_at,
            timeUntilAiring: s.time_until_airing ?? Math.max(0, s.airing_at - Math.floor(Date.now() / 1000)),
            episode: s.episode_number,
            media: animeById.get(s.anilist_id),
          }));

        const topRatedAiring = [...airingMapped]
          .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
          .slice(0, 14);

        return {
          source: 'supabase',
          hero,
          recentlyUpdated: recentlyRows,
          trendingAiring: airingMapped.slice(0, 14),
          topRatedAiring,
          upcoming: upcomingMapped,
          movies: movieRows,
          schedule,
        };
      }
    } catch (err: any) {
      logServerError('SupabaseCatalog', `Home read fallback to AniList: ${err?.message || err}`);
    }
  }

  // Fallback to live AniList data so Home never goes blank
  const fallback = await getHomePayload();
  const filterHidden = (list: any[]) =>
    (list || []).filter((item) => !localHiddenAnimeIds.has(item.id));

  return {
    source: 'anilist_fallback',
    hero: filterHidden(fallback.hero),
    recentlyUpdated: filterHidden(fallback.recentlyUpdated),
    trendingAiring: filterHidden(fallback.trendingAiring),
    topRatedAiring: filterHidden(fallback.topRatedAiring),
    upcoming: filterHidden(fallback.upcoming),
    movies: filterHidden(fallback.movies),
    schedule: (fallback.schedule || []).filter((s: any) => !localHiddenAnimeIds.has(s.media?.id)),
  };
}

export async function getRecentlyUpdatedWithSupabase(limit = 16) {
  if (isSupabaseAdminConfigured() && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('recently_updated')
        .select('*')
        .limit(limit);
      if (!error && data && data.length > 0) {
        return data
          .filter((r: any) => !r.hidden && !localHiddenAnimeIds.has(r.anilist_id ?? r.id) && r.status === 'RELEASING')
          .map(mapSupabaseAnimeRowToFrontend);
      }
    } catch {
      // fall through
    }
  }
  const items = await getRecentlyUpdatedAiring(limit);
  return items.filter((m: any) => !localHiddenAnimeIds.has(m.id));
}

export async function getMoviesWithSupabase(page = 1, perPage = 24, releasedOnly = false) {
  if (releasedOnly && page === 1 && isSupabaseAdminConfigured() && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('movies_latest')
        .select('*')
        .limit(perPage);
      if (!error && data && data.length > 0) {
        const list = data
          .filter((r: any) => !r.hidden && !localHiddenAnimeIds.has(r.anilist_id ?? r.id) && r.status !== 'NOT_YET_RELEASED')
          .map(mapSupabaseAnimeRowToFrontend);
        if (list.length > 0) {
          return { media: list, pageInfo: { currentPage: 1, hasNextPage: true } };
        }
      }
    } catch {
      // fall through
    }
  }
  const res = await getAnimeMovies(page, perPage, releasedOnly);
  return {
    ...res,
    media: (res.media || []).filter((m: any) => !localHiddenAnimeIds.has(m.id)),
  };
}

export async function syncProviderConfigToSupabase(
  id: ProviderId,
  enabled: boolean,
  priority: number
): Promise<void> {
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) return;
  try {
    await supabaseAdmin.from('providers').upsert(
      {
        id,
        name: id === 'yenime' ? 'Yenime' : id === 'aniembed' ? 'AniEmbed' : 'Kuroko',
        enabled,
        priority,
        supports_dub: id !== 'yenime',
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'id' }
    );
  } catch (err: any) {
    logServerError('SupabaseProviders', `Provider sync warning: ${err?.message || err}`);
  }
}

export async function logProviderHealthToSupabase(
  providerId: string,
  status: string,
  latencyMs: number | null,
  lastError?: string | null
): Promise<void> {
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) return;
  try {
    await supabaseAdmin.from('provider_health').insert({
      provider_id: providerId,
      status,
      latency_ms: latencyMs,
      last_error: lastError ?? null,
      checked_at: new Date().toISOString(),
    } as any);
  } catch {
    // non-fatal telemetry
  }
}

export async function setAnimeVisibilityInSupabase(
  anilistId: number,
  hidden: boolean
): Promise<{ ok: boolean; hidden: boolean }> {
  setAnimeHiddenLocal(anilistId, hidden);
  clearExternalCache();

  if (isSupabaseAdminConfigured() && supabaseAdmin) {
    const existingAnime = await getAnimeById(anilistId);
    const payload = existingAnime
      ? { ...mapFrontendAnimeToSupabaseRow(existingAnime), hidden }
      : { anilist_id: anilistId, title_romaji: `Anime #${anilistId}`, hidden, updated_at: new Date().toISOString() };
    await supabaseAdmin.from('anime').upsert(payload as any, { onConflict: 'anilist_id' });
  }
  return { ok: true, hidden };
}

export async function setAnimeTrailerOverrideInSupabase(
  anilistId: number,
  trailerId: string | null
): Promise<void> {
  if (trailerId) {
    setTrailerOverride(anilistId, trailerId, 'youtube');
  } else {
    deleteTrailerOverride(anilistId);
  }
  clearExternalCache();

  if (isSupabaseAdminConfigured() && supabaseAdmin) {
    try {
      await supabaseAdmin
        .from('anime')
        .update({ trailer_override_id: trailerId, updated_at: new Date().toISOString() } as any)
        .eq('anilist_id', anilistId);
    } catch {
      // non-fatal if row not synced yet
    }
  }
}

export async function insertAnalyticsEvent(event: {
  eventName: string;
  userId?: string | null;
  anilistId?: number | null;
  episodeNumber?: number | null;
  providerId?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<boolean> {
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin.from('analytics_events').insert({
      event_name: event.eventName.slice(0, 64),
      user_id: event.userId || null,
      anilist_id: event.anilistId ?? null,
      episode_number: event.episodeNumber ?? null,
      provider_id: event.providerId ?? null,
      metadata: event.metadata ?? null,
    } as any);
    return !error;
  } catch {
    return false;
  }
}

export async function getSupabaseAdminDashboardData(): Promise<{
  supabaseConfigured: boolean;
  overviewStats: AdminOverviewRpc | null;
  syncRuns: any[];
  providerHealthHistory: any[];
  analyticsSummary: { totalEvents: number; byEvent: Record<string, number> };
  catalogTitles: any[];
}> {
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return {
      supabaseConfigured: false,
      overviewStats: null,
      syncRuns: [],
      providerHealthHistory: [],
      analyticsSummary: { totalEvents: 0, byEvent: {} },
      catalogTitles: [],
    };
  }

  try {
    const [rpcRes, syncRes, healthRes, analyticsRes, catalogRes] = await Promise.all([
      supabaseAdmin.rpc('get_admin_overview'),
      supabaseAdmin
        .from('sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('provider_health')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(15),
      supabaseAdmin
        .from('analytics_events')
        .select('event_name')
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('anime')
        .select('anilist_id, title_english, title_romaji, format, status, aired_episodes, episodes, hidden, trailer_override_id, trailer_id')
        .order('popularity', { ascending: false })
        .limit(40),
    ]);

    const byEvent: Record<string, number> = {};
    for (const row of analyticsRes.data || []) {
      const k = (row as any).event_name || 'unknown';
      byEvent[k] = (byEvent[k] || 0) + 1;
    }

    return {
      supabaseConfigured: true,
      overviewStats: (rpcRes.data as unknown as AdminOverviewRpc) || null,
      syncRuns: syncRes.data || [],
      providerHealthHistory: healthRes.data || [],
      analyticsSummary: {
        totalEvents: (analyticsRes.data || []).length,
        byEvent,
      },
      catalogTitles: (catalogRes.data || []).map((r: any) => ({
        id: r.anilist_id ?? r.id,
        title: r.title_english || r.title_romaji,
        format: r.format,
        status: r.status,
        airedEpisodes: r.aired_episodes ?? 0,
        totalEpisodes: r.episodes ?? null,
        hidden: Boolean(r.hidden || localHiddenAnimeIds.has(r.anilist_id ?? r.id)),
        trailerOverrideId: r.trailer_override_id || null,
        trailerId: r.trailer_id || null,
      })),
    };
  } catch (err: any) {
    logServerError('SupabaseAdminOverview', err?.message || 'Failed loading Supabase admin overview');
    return {
      supabaseConfigured: true,
      overviewStats: null,
      syncRuns: [],
      providerHealthHistory: [],
      analyticsSummary: { totalEvents: 0, byEvent: {} },
      catalogTitles: [],
    };
  }
}
