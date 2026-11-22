import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { SERVER_CONFIG } from './server/config.js';
import {
  isAdminAuthenticated,
  isSupabaseAdminRequest,
  isAdminPasswordConfigured,
  verifyAdminPassword,
  claimInitialAdminPassword,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  requireAdmin,
} from './server/adminAuth.js';
import {
  ProviderId,
  AudioLang,
  getProvidersOrdered,
  isKurokoEnvEnabled,
  updateProviderSettings,
  reorderProviders,
  probeAllProviders,
  resolveSourcesForEpisode,
  recordClientProviderFailure,
} from './server/providers.js';
import {
  getTrendingAnime,
  getTrendingAiringAnime,
  getTopRatedAiringAnime,
  getPopularAnime,
  getSeasonalAnime,
  getUpcomingAnime,
  getAiringSchedule,
  getAnimeById,
  getConfirmedEpisodesForAnime,
  searchAnime,
  getJikanNews,
  getApiUsageStats,
  getServerErrorLogs,
  clearServerErrorLogs,
  clearExternalCache,
  getTrailerOverrides,
  logServerError,
} from './server/externalData.js';
import {
  isSupabaseAdminConfigured,
  supabaseAdmin,
  createSupabaseUserClient,
  verifySupabaseAccessToken,
} from './server/supabaseAdmin.js';
import {
  startSupabaseCatalogSyncSchedule,
  runSupabaseCatalogSync,
  getHomePayloadWithSupabase,
  getRecentlyUpdatedWithSupabase,
  getMoviesWithSupabase,
  syncProviderConfigToSupabase,
  logProviderHealthToSupabase,
  setAnimeVisibilityInSupabase,
  setAnimeTrailerOverrideInSupabase,
  insertAnalyticsEvent,
  getSupabaseAdminDashboardData,
  isAnimeHiddenLocal,
} from './server/supabaseSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = SERVER_CONFIG.port;

app.set('trust proxy', 1);
app.use(express.json({ limit: '512kb' }));

// Simple per-IP rate limiter for analytics tracking (30 events/min/IP)
const analyticsBuckets = new Map<string, { count: number; resetAt: number }>();
function checkAnalyticsRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = analyticsBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    analyticsBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= 30) return false;
  bucket.count += 1;
  return true;
}

// ===================================================================
// 0. SUPABASE AUTH & USER DATA ENDPOINTS
// ===================================================================
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { user, profile, isAdmin } = await verifySupabaseAccessToken(authHeader);
    if (!user) {
      res.status(200).json({ user: null, profile: null, isAdmin: false });
      return;
    }
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile,
      isAdmin,
    });
  } catch {
    res.status(200).json({ user: null, profile: null, isAdmin: false });
  }
});

async function requireSupabaseUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const verified = await verifySupabaseAccessToken(token);
  if (!verified.user) return null;
  const db = createSupabaseUserClient(token) || supabaseAdmin;
  if (!db) return null;
  return { user: verified.user, profile: verified.profile, token, db };
}

app.get('/api/user/profile', async (req, res) => {
  const ctx = await requireSupabaseUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  res.json({ profile: ctx.profile });
});

app.put('/api/user/profile', async (req, res) => {
  const ctx = await requireSupabaseUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (
    req.body?.preferred_provider === 'yenime' ||
    req.body?.preferred_provider === 'aniembed' ||
    req.body?.preferred_provider === 'kuroko'
  ) {
    updates.preferred_provider = req.body.preferred_provider;
  }
  if (req.body?.preferred_lang === 'sub' || req.body?.preferred_lang === 'dub') {
    updates.preferred_lang = req.body.preferred_lang;
  }
  if (typeof req.body?.username === 'string' && req.body.username.trim().length >= 2) {
    updates.username = req.body.username.trim().slice(0, 48);
  }

  const { data, error } = await ctx.db
    .from('profiles')
    .update(updates as any)
    .eq('id', ctx.user.id)
    .select('id, username, preferred_provider, preferred_lang, is_admin')
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ profile: data });
});

app.get('/api/user/progress', async (req, res) => {
  const ctx = await requireSupabaseUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { data, error } = await ctx.db
    .from('watch_progress')
    .select('*')
    .eq('user_id', ctx.user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ items: data || [] });
});

app.post('/api/user/progress', async (req, res) => {
  const ctx = await requireSupabaseUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const anilistId = parseInt(String(req.body?.anilist_id || '0'), 10);
  const episodeNumber = parseInt(String(req.body?.episode_number || '1'), 10);
  const positionSeconds = Math.max(0, Math.floor(Number(req.body?.position_seconds || 0)));
  const durationSeconds = Math.max(0, Math.floor(Number(req.body?.duration_seconds || 1440)));

  if (!Number.isFinite(anilistId) || anilistId <= 0 || !Number.isFinite(episodeNumber) || episodeNumber <= 0) {
    res.status(400).json({ error: 'Valid anilist_id and episode_number required' });
    return;
  }

  const payload = {
    user_id: ctx.user.id,
    anilist_id: anilistId,
    episode_number: episodeNumber,
    position_seconds: positionSeconds,
    duration_seconds: durationSeconds,
    anime_title: typeof req.body?.anime_title === 'string' ? req.body.anime_title.slice(0, 200) : null,
    cover_image: typeof req.body?.cover_image === 'string' ? req.body.cover_image.slice(0, 500) : null,
    banner_image: typeof req.body?.banner_image === 'string' ? req.body.banner_image.slice(0, 500) : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await ctx.db
    .from('watch_progress')
    .upsert(payload as any, { onConflict: 'user_id,anilist_id,episode_number' })
    .select()
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ item: data });
});

app.post('/api/user/progress/merge', async (req, res) => {
  const ctx = await requireSupabaseUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const rows = Array.isArray(req.body?.items) ? req.body.items.slice(0, 30) : [];
  const validRows = rows
    .filter(
      (r: any) =>
        Number.isFinite(Number(r?.anilist_id)) &&
        Number(r.anilist_id) > 0 &&
        Number.isFinite(Number(r?.episode_number)) &&
        Number(r.episode_number) > 0
    )
    .map((r: any) => ({
      user_id: ctx.user.id,
      anilist_id: Number(r.anilist_id),
      episode_number: Number(r.episode_number),
      position_seconds: Math.max(0, Math.floor(Number(r.position_seconds || 0))),
      duration_seconds: Math.max(0, Math.floor(Number(r.duration_seconds || 1440))),
      anime_title: typeof r.anime_title === 'string' ? r.anime_title.slice(0, 200) : null,
      cover_image: typeof r.cover_image === 'string' ? r.cover_image.slice(0, 500) : null,
      banner_image: typeof r.banner_image === 'string' ? r.banner_image.slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    }));

  if (validRows.length > 0) {
    await ctx.db
      .from('watch_progress')
      .upsert(validRows as any, { onConflict: 'user_id,anilist_id,episode_number' });
  }
  res.json({ ok: true, merged: validRows.length });
});

app.get('/api/user/watchlist', async (req, res) => {
  const ctx = await requireSupabaseUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { data, error } = await ctx.db
    .from('watchlist')
    .select('*')
    .eq('user_id', ctx.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ items: data || [] });
});

app.post('/api/user/watchlist', async (req, res) => {
  const ctx = await requireSupabaseUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const anilistId = parseInt(String(req.body?.anilist_id || '0'), 10);
  const status = String(req.body?.status || 'plan').toLowerCase();
  const allowed = new Set(['watching', 'plan', 'completed', 'favorite']);
  if (!Number.isFinite(anilistId) || anilistId <= 0 || !allowed.has(status)) {
    res.status(400).json({ error: 'Valid anilist_id and status required' });
    return;
  }

  const payload = {
    user_id: ctx.user.id,
    anilist_id: anilistId,
    status,
    is_favorite: Boolean(req.body?.is_favorite ?? status === 'favorite'),
    last_watched_episode: Math.max(1, parseInt(String(req.body?.last_watched_episode || '1'), 10) || 1),
    anime_title: typeof req.body?.anime_title === 'string' ? req.body.anime_title.slice(0, 200) : null,
    cover_image: typeof req.body?.cover_image === 'string' ? req.body.cover_image.slice(0, 500) : null,
    format: typeof req.body?.format === 'string' ? req.body.format.slice(0, 32) : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await ctx.db
    .from('watchlist')
    .upsert(payload as any, { onConflict: 'user_id,anilist_id' })
    .select()
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ item: data });
});

app.delete('/api/user/watchlist/:anilistId', async (req, res) => {
  const ctx = await requireSupabaseUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const anilistId = parseInt(req.params.anilistId, 10);
  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    res.status(400).json({ error: 'Invalid anilistId' });
    return;
  }
  const { error } = await ctx.db
    .from('watchlist')
    .delete()
    .eq('user_id', ctx.user.id)
    .eq('anilist_id', anilistId);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

app.post('/api/analytics/track', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkAnalyticsRateLimit(ip)) {
    res.status(200).json({ ok: false, rateLimited: true });
    return;
  }

  try {
    const eventName =
      typeof req.body?.event_name === 'string' && req.body.event_name.trim()
        ? req.body.event_name.trim()
        : '';
    if (!eventName) {
      res.status(200).json({ ok: false });
      return;
    }

    let userId: string | null = null;
    if (req.headers.authorization) {
      const verified = await verifySupabaseAccessToken(req.headers.authorization);
      userId = verified.user?.id || null;
    }

    await insertAnalyticsEvent({
      eventName,
      userId,
      anilistId: Number.isFinite(Number(req.body?.anilist_id)) ? Number(req.body.anilist_id) : null,
      episodeNumber: Number.isFinite(Number(req.body?.episode_number))
        ? Number(req.body.episode_number)
        : null,
      providerId: typeof req.body?.provider_id === 'string' ? req.body.provider_id.slice(0, 32) : null,
      metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : null,
    });
  } catch {
    // Analytics must never break the page
  }

  res.status(200).json({ ok: true });
});

// ===================================================================
// 1. STREAMING PROVIDERS & SOURCE RESOLUTION (Backend Only)
// ===================================================================
app.get('/api/providers', (_req, res) => {
  res.json({
    kurokoEnabled: isKurokoEnvEnabled(),
    providers: getProvidersOrdered(false).map((p) => ({
      id: p.id,
      name: p.name,
      priority: p.priority,
      enabled: p.enabled,
      supportsDub: p.supportsDub,
      status: p.status,
      latencyMs: p.latencyMs,
    })),
  });
});

app.get('/api/sources/:anilistId/:episode', async (req, res) => {
  const anilistId = parseInt(req.params.anilistId, 10);
  const episode = parseInt(req.params.episode, 10);

  if (!Number.isFinite(anilistId) || anilistId <= 0 || !Number.isFinite(episode) || episode <= 0) {
    res.status(400).json({ error: 'Invalid anilistId or episode number' });
    return;
  }

  const rawLang = String(req.query.lang || 'sub').toLowerCase();
  const lang: AudioLang = rawLang === 'dub' ? 'dub' : 'sub';
  const autoplay: 0 | 1 = String(req.query.autoplay || '0') === '1' ? 1 : 0;
  const start = Math.max(0, parseInt(String(req.query.t || '0'), 10) || 0);
  const rawMode = String(req.query.mode || 'auto').toLowerCase();
  const validModes = ['auto', 'yenime', 'aniembed', 'kuroko'];
  const mode = (validModes.includes(rawMode) ? rawMode : 'auto') as 'auto' | ProviderId;

  try {
    const result = await resolveSourcesForEpisode({
      anilistId,
      episode,
      lang,
      autoplay,
      start,
      mode,
    });
    if (result.selected) {
      logProviderHealthToSupabase(
        result.selected.id,
        result.selected.healthy ? 'healthy' : 'degraded',
        result.selected.latencyMs,
        result.selected.error || null
      ).catch(() => {});
    }
    if (result.failedChecks.length > 0) {
      for (const f of result.failedChecks) {
        logServerError(`Provider:${f.name}`, `Health check failed for AniList ${anilistId} Ep ${episode}: ${f.reason}`);
        logProviderHealthToSupabase(f.id, 'offline', null, f.reason).catch(() => {});
      }
    }
    res.json(result);
  } catch (err: any) {
    logServerError('SourceResolver', err?.message || 'Source resolution error');
    res.status(500).json({ error: 'Failed to resolve stream sources' });
  }
});

app.post('/api/sources/report-failure', (req, res) => {
  const { providerId, reason } = req.body || {};
  if (providerId === 'yenime' || providerId === 'aniembed' || providerId === 'kuroko') {
    const safeReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Iframe load timeout (8s)';
    recordClientProviderFailure(providerId, safeReason);
    logServerError(`Provider:${providerId}`, safeReason);
    logProviderHealthToSupabase(providerId, 'degraded', null, safeReason).catch(() => {});
  }
  res.json({ ok: true });
});

// ===================================================================
// 2. EXTERNAL METADATA & SCHEDULES (Supabase First + AniList Fallback)
// ===================================================================
app.get('/api/home', async (_req, res) => {
  res.type('application/json');
  try {
    const payload = await getHomePayloadWithSupabase();
    res.json({
      ...payload,
      airingThisWeek: payload.schedule || [],
      trending: payload.trendingAiring || [],
      warnings: [],
    });
  } catch (err: any) {
    logServerError('ApiHome', err?.message || 'Failed loading home feed');
    res.status(200).json({
      source: 'error_fallback',
      hero: [],
      recentlyUpdated: [],
      airingThisWeek: [],
      topRatedAiring: [],
      upcoming: [],
      trending: [],
      movies: [],
      schedule: [],
      warnings: [err?.message || 'Failed to fetch home catalog'],
    });
  }
});

app.get('/api/anime/home', async (_req, res) => {
  res.type('application/json');
  try {
    const payload = await getHomePayloadWithSupabase();
    res.json({
      ...payload,
      airingThisWeek: payload.schedule || [],
      trending: payload.trendingAiring || [],
      warnings: [],
    });
  } catch (err: any) {
    logServerError('AnimeHome', err?.message || 'Failed loading home feed');
    res.status(200).json({
      source: 'error_fallback',
      hero: [],
      recentlyUpdated: [],
      airingThisWeek: [],
      topRatedAiring: [],
      upcoming: [],
      trending: [],
      movies: [],
      schedule: [],
      warnings: [err?.message || 'Failed to fetch home catalog'],
    });
  }
});

app.get('/api/anime/trending', async (req, res) => {
  res.type('application/json');
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.perPage || '18'), 10) || 18));
  const airingOnly = String(req.query.airingOnly || 'false') === 'true';
  try {
    const data = airingOnly
      ? await getTrendingAiringAnime(page, perPage)
      : await getTrendingAnime(page, perPage);
    res.json({
      ...data,
      media: (data.media || []).filter((m: any) => !isAnimeHiddenLocal(m.id)),
    });
  } catch {
    res.status(200).json({ media: [], pageInfo: {}, warnings: ['Failed to fetch trending anime'] });
  }
});

app.get('/api/anime/top-rated-airing', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.perPage || '14'), 10) || 14));
  try {
    const data = await getTopRatedAiringAnime(page, perPage);
    res.json({
      ...data,
      media: (data.media || []).filter((m: any) => !isAnimeHiddenLocal(m.id)),
    });
  } catch {
    res.status(502).json({ error: 'Failed to fetch top rated airing anime' });
  }
});

app.get('/api/anime/popular', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.perPage || '18'), 10) || 18));
  try {
    const data = await getPopularAnime(page, perPage);
    res.json({
      ...data,
      media: (data.media || []).filter((m: any) => !isAnimeHiddenLocal(m.id)),
    });
  } catch {
    res.status(502).json({ error: 'Failed to fetch popular anime' });
  }
});

app.get('/api/anime/seasonal', async (req, res) => {
  const season = typeof req.query.season === 'string' && req.query.season ? req.query.season : undefined;
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.perPage || '24'), 10) || 24));
  try {
    const data = await getSeasonalAnime(season, year, page, perPage);
    res.json({
      ...data,
      media: (data.media || []).filter((m: any) => !isAnimeHiddenLocal(m.id)),
    });
  } catch {
    res.status(502).json({ error: 'Failed to fetch seasonal anime' });
  }
});

app.get('/api/anime/upcoming', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.perPage || '24'), 10) || 24));
  try {
    const data = await getUpcomingAnime(page, perPage);
    res.json({
      ...data,
      media: (data.media || []).filter((m: any) => !isAnimeHiddenLocal(m.id)),
    });
  } catch {
    res.status(502).json({ error: 'Failed to fetch upcoming anime' });
  }
});

app.get('/api/anime/movies', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.perPage || '24'), 10) || 24));
  const releasedOnly = String(req.query.releasedOnly || 'false') === 'true';
  try {
    res.json(await getMoviesWithSupabase(page, perPage, releasedOnly));
  } catch {
    res.status(502).json({ error: 'Failed to fetch anime movies' });
  }
});

app.get('/api/anime/recently-updated', async (req, res) => {
  const limit = Math.min(30, Math.max(1, parseInt(String(req.query.limit || '16'), 10) || 16));
  try {
    const media = await getRecentlyUpdatedWithSupabase(limit);
    res.json({ media });
  } catch {
    res.status(502).json({ error: 'Failed to fetch recently updated airing anime' });
  }
});

app.get('/api/anime/schedule', async (req, res) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const airingAtGreater = parseInt(String(req.query.start || nowSec - 86400), 10) || nowSec - 86400;
  const airingAtLesser = parseInt(String(req.query.end || nowSec + 7 * 86400), 10) || nowSec + 7 * 86400;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.perPage || '50'), 10) || 50));
  try {
    const items = await getAiringSchedule(airingAtGreater, airingAtLesser, page, perPage);
    res.json({ schedules: items });
  } catch {
    res.status(502).json({ error: 'Failed to fetch airing schedule' });
  }
});

app.get('/api/anime/search', async (req, res) => {
  try {
    const data = await searchAnime({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      genre: typeof req.query.genre === 'string' ? req.query.genre : undefined,
      year: req.query.year ? parseInt(String(req.query.year), 10) : undefined,
      season: typeof req.query.season === 'string' ? req.query.season : undefined,
      format: typeof req.query.format === 'string' ? req.query.format : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : 1,
      perPage: req.query.perPage ? Math.min(50, parseInt(String(req.query.perPage), 10)) : 18,
    });
    res.json({
      ...data,
      media: (data.media || []).filter((m: any) => !isAnimeHiddenLocal(m.id)),
    });
  } catch {
    res.status(502).json({ error: 'Failed to search anime catalog' });
  }
});

app.get('/api/anime/:id/episodes', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid anime ID' });
    return;
  }
  try {
    const info = await getConfirmedEpisodesForAnime(id);
    res.json(info);
  } catch {
    res.status(502).json({ error: 'Failed to load episode list' });
  }
});

app.get('/api/anime/:id/news', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }
  try {
    const anime = await getAnimeById(id);
    const malId = anime?.idMal || (req.query.malId ? parseInt(String(req.query.malId), 10) : null);
    if (!malId) {
      res.json({ articles: [] });
      return;
    }
    const articles = await getJikanNews(malId);
    res.json({ articles });
  } catch {
    res.json({ articles: [] });
  }
});

app.get('/api/anime/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid anime ID' });
    return;
  }
  try {
    const media = await getAnimeById(id);
    if (!media) {
      res.status(404).json({ error: 'Anime not found' });
      return;
    }
    res.json({ media });
  } catch {
    res.status(502).json({ error: 'Failed to fetch anime details' });
  }
});

// ===================================================================
// 3. ADMIN AUTHENTICATION & MANAGEMENT ROUTES
// ===================================================================
app.get('/api/admin/session', async (req, res) => {
  const cookieAuthed = isAdminAuthenticated(req);
  const supabaseAdminAuthed = cookieAuthed ? true : await isSupabaseAdminRequest(req);
  res.json({
    authenticated: cookieAuthed || supabaseAdminAuthed,
    viaCookie: cookieAuthed,
    viaSupabase: supabaseAdminAuthed && !cookieAuthed,
    configured: isAdminPasswordConfigured(),
    supabaseAdminConfigured: isSupabaseAdminConfigured(),
  });
});

app.post('/api/admin/login', (req, res) => {
  const rate = checkLoginRateLimit(req);
  if (!rate.allowed) {
    logServerError('AdminAuth', `Rate limit exceeded from IP ${req.ip}`, 429);
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    res.status(429).json({
      error: `Too many failed login attempts. Try again in ${Math.ceil(rate.retryAfterSeconds / 60)} minutes.`,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
    return;
  }

  if (!isAdminPasswordConfigured()) {
    res.status(503).json({
      error: 'ADMIN_PASSWORD is not configured on the server.',
      configured: false,
    });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!verifyAdminPassword(password)) {
    const status = recordFailedLoginAttempt(req);
    logServerError('AdminAuth', `Failed login attempt from IP ${req.ip} (${status.remaining} attempts left)`, 401);
    res.status(401).json({
      error: 'Invalid administrator password.',
      remainingAttempts: status.remaining,
    });
    return;
  }

  resetLoginAttempts(req);
  setAdminSessionCookie(req, res);
  res.json({ authenticated: true });
});

app.post('/api/admin/bootstrap', (req, res) => {
  if (isAdminPasswordConfigured()) {
    res.status(403).json({ error: 'Admin password is already configured.' });
    return;
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }
  const ok = claimInitialAdminPassword(password);
  if (!ok) {
    res.status(403).json({ error: 'Bootstrap unavailable.' });
    return;
  }
  setAdminSessionCookie(req, res);
  res.json({ authenticated: true });
});

app.post('/api/admin/logout', (req, res) => {
  clearAdminSessionCookie(req, res);
  res.json({ authenticated: false });
});

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  try {
    const [airingRes, supabaseDashboard] = await Promise.all([
      getTrendingAiringAnime(1, 20),
      getSupabaseAdminDashboardData(),
    ]);
    const memory = process.memoryUsage();
    res.json({
      providers: getProvidersOrdered(true),
      kurokoEnabled: isKurokoEnvEnabled(),
      apiUsage: getApiUsageStats(),
      errorLogs: getServerErrorLogs(),
      airingTitles: airingRes.media.map((m: any) => ({
        id: m.id,
        idMal: m.idMal,
        title: m.title.english || m.title.romaji,
        airedEpisodes: m.airedEpisodes ?? 0,
        totalEpisodes: m.episodes ?? null,
        nextEpisode: m.nextAiringEpisode?.episode ?? null,
        nextAiringAt: m.nextAiringEpisode?.airingAt ?? null,
        trailer: m.trailer || null,
        hidden: isAnimeHiddenLocal(m.id),
      })),
      trailerOverrides: getTrailerOverrides(),
      supabase: supabaseDashboard,
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
        heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load admin overview' });
  }
});

app.post('/api/admin/sync', requireAdmin, async (_req, res) => {
  const result = await runSupabaseCatalogSync();
  res.json({ syncRun: result });
});

app.post('/api/admin/anime/visibility', requireAdmin, async (req, res) => {
  const anilistId = parseInt(String(req.body?.anilistId || '0'), 10);
  const hidden = Boolean(req.body?.hidden);
  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    res.status(400).json({ error: 'Valid anilistId is required' });
    return;
  }
  const result = await setAnimeVisibilityInSupabase(anilistId, hidden);
  res.json(result);
});

app.post('/api/admin/providers/probe', requireAdmin, async (req, res) => {
  const anilistId = parseInt(String(req.body?.anilistId || '21'), 10) || 21;
  const episode = parseInt(String(req.body?.episode || '1'), 10) || 1;
  const lang: AudioLang = req.body?.lang === 'dub' ? 'dub' : 'sub';
  const providers = await probeAllProviders(anilistId, episode, lang);
  await Promise.allSettled(
    providers.map((p) =>
      logProviderHealthToSupabase(p.id, p.status, p.latencyMs, p.lastFailureReason)
    )
  );
  res.json({ providers });
});

app.post('/api/admin/providers/update', requireAdmin, async (req, res) => {
  const { id, enabled, priority } = req.body || {};
  if (id !== 'yenime' && id !== 'aniembed' && id !== 'kuroko') {
    res.status(400).json({ error: 'Invalid provider id' });
    return;
  }
  const updated = updateProviderSettings(id, { enabled, priority });
  if (updated) {
    await syncProviderConfigToSupabase(updated.id, updated.enabled, updated.priority);
  }
  res.json({ provider: updated, providers: getProvidersOrdered(true) });
});

app.post('/api/admin/providers/reorder', requireAdmin, async (req, res) => {
  const order = req.body?.order;
  if (!Array.isArray(order)) {
    res.status(400).json({ error: 'order must be an array of provider IDs' });
    return;
  }
  const filtered = order.filter(
    (id): id is ProviderId => id === 'yenime' || id === 'aniembed' || id === 'kuroko'
  );
  const providers = reorderProviders(filtered);
  await Promise.allSettled(
    providers.map((p) => syncProviderConfigToSupabase(p.id, p.enabled, p.priority))
  );
  res.json({ providers });
});

app.post('/api/admin/cache/clear', requireAdmin, (_req, res) => {
  clearExternalCache();
  res.json({ ok: true, apiUsage: getApiUsageStats() });
});

app.post('/api/admin/logs/clear', requireAdmin, (_req, res) => {
  clearServerErrorLogs();
  res.json({ ok: true });
});

app.post('/api/admin/trailers', requireAdmin, async (req, res) => {
  const anilistId = parseInt(String(req.body?.anilistId || '0'), 10);
  const trailerId = typeof req.body?.trailerId === 'string' ? req.body.trailerId.trim() : '';
  if (!Number.isFinite(anilistId) || anilistId <= 0 || !trailerId) {
    res.status(400).json({ error: 'Valid anilistId and trailerId are required' });
    return;
  }
  await setAnimeTrailerOverrideInSupabase(anilistId, trailerId);
  res.json({ trailerOverrides: getTrailerOverrides() });
});

app.delete('/api/admin/trailers/:anilistId', requireAdmin, async (req, res) => {
  const anilistId = parseInt(req.params.anilistId, 10);
  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    res.status(400).json({ error: 'Invalid anilistId' });
    return;
  }
  await setAnimeTrailerOverrideInSupabase(anilistId, null);
  res.json({ ok: true, trailerOverrides: getTrailerOverrides() });
});

// ===================================================================
// 4. API HEALTH ENDPOINT
// ===================================================================
app.get('/api/health', async (_req, res) => {
  const results: Record<string, any> = {};

  const annStart = Date.now();
  try {
    const aliRes = await fetch(SERVER_CONFIG.anilistApiUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(4000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ Page(perPage:1) { media(type:ANIME) { id } } }' }),
    });
    results.anilist = { ok: aliRes.ok, status: aliRes.status, latencyMs: Date.now() - annStart };
  } catch {
    results.anilist = { ok: false, status: 0, latencyMs: Date.now() - annStart };
  }

  const jikanStart = Date.now();
  try {
    const jikRes = await fetch(`${SERVER_CONFIG.jikanApiUrl}/anime/1`, {
      signal: AbortSignal.timeout(4000),
    });
    results.jikan = { ok: jikRes.ok, status: jikRes.status, latencyMs: Date.now() - jikanStart };
  } catch {
    results.jikan = { ok: false, status: 0, latencyMs: Date.now() - jikanStart };
  }

  results.supabase = {
    configured: isSupabaseAdminConfigured(),
  };

  const memory = process.memoryUsage();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
    },
    services: results,
    providers: getProvidersOrdered(true),
  });
});

// Return JSON 404 for unknown /api/* routes instead of SPA HTML
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get(/^(?!\/api).*/, async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = `<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;
        const indexFsPath = path.resolve(__dirname, 'index.html');
        const fs = await import('fs/promises');
        try {
          const fileContent = await fs.readFile(indexFsPath, 'utf-8');
          template = await vite.transformIndexHtml(url, fileContent);
        } catch {
          template = await vite.transformIndexHtml(url, template);
        }
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YORUMI Full-Stack Server running on http://0.0.0.0:${PORT}`);
    const routes: string[] = [];
    app._router.stack.forEach((layer: any) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        routes.push(`${methods} ${layer.route.path}`);
      }
    });
    console.log('Registered API Routes count:', routes.length);
    startSupabaseCatalogSyncSchedule();
  });
}

if (process.env.YORUMI_NO_AUTOSTART !== '1') {
  startServer();
}
