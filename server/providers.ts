import { SERVER_CONFIG } from './config.js';

export type ProviderId = 'yenime' | 'aniembed' | 'kuroko';
export type AudioLang = 'sub' | 'dub';

export interface ProviderRecord {
  id: ProviderId;
  name: string;
  priority: number;
  enabled: boolean;
  supportsDub: boolean;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  latencyMs: number | null;
  lastChecked: number | null;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  successCount: number;
  failureCount: number;
}

export interface BuiltProviderSource {
  id: ProviderId;
  name: string;
  priority: number;
  url: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

// One URL-builder per provider respecting exact placeholder casing
export function buildYenimeUrl(params: {
  anilistId: number;
  episode: number;
}): string {
  const { anilistId, episode } = params;
  return SERVER_CONFIG.yenime.embedTemplate
    .replace(/\{ANILIST_ID\}/g, String(anilistId))
    .replace(/\{EPISODE\}/g, String(episode));
}

export function buildAniembedUrl(params: {
  anilistId: number;
  episode: number;
  lang?: AudioLang;
  autoplay?: 0 | 1;
  start?: number;
}): string {
  const { anilistId, episode, lang = 'sub', autoplay = 0, start = 0 } = params;
  const safeStart = Number.isFinite(start) && start > 0 ? Math.floor(start) : 0;
  return SERVER_CONFIG.aniembed.embedTemplate
    .replace(/\{ANILIST_ID\}/g, String(anilistId))
    .replace(/\{EPISODE\}/g, String(episode))
    .replace(/\{LANG\}/g, lang)
    .replace(/\{AUTOPLAY\}/g, String(autoplay))
    .replace(/\{START\}/g, String(safeStart));
}

export function buildKurokoUrl(params: {
  anilistId: number;
  episode: number;
  language?: AudioLang;
}): string {
  const { anilistId, episode, language = 'sub' } = params;
  return SERVER_CONFIG.kuroko.embedTemplate
    .replace(/\{anilist_id\}/g, String(anilistId))
    .replace(/\{episode\}/g, String(episode))
    .replace(/\{language\}/g, language);
}

export function buildProviderUrl(
  providerId: ProviderId,
  params: {
    anilistId: number;
    episode: number;
    lang?: AudioLang;
    autoplay?: 0 | 1;
    start?: number;
  }
): string {
  switch (providerId) {
    case 'yenime':
      return buildYenimeUrl({ anilistId: params.anilistId, episode: params.episode });
    case 'aniembed':
      return buildAniembedUrl({
        anilistId: params.anilistId,
        episode: params.episode,
        lang: params.lang || 'sub',
        autoplay: params.autoplay ?? 0,
        start: params.start ?? 0,
      });
    case 'kuroko':
      return buildKurokoUrl({
        anilistId: params.anilistId,
        episode: params.episode,
        language: params.lang || 'sub',
      });
  }
}

// Runtime provider table: strictly yenime (10), aniembed (20), kuroko (30)
const providerTable: ProviderRecord[] = [
  {
    id: 'yenime',
    name: 'Yenime',
    priority: 10,
    enabled: true,
    supportsDub: false,
    status: 'unknown',
    latencyMs: null,
    lastChecked: null,
    lastFailureAt: null,
    lastFailureReason: null,
    successCount: 0,
    failureCount: 0,
  },
  {
    id: 'aniembed',
    name: 'AniEmbed',
    priority: 20,
    enabled: true,
    supportsDub: true,
    status: 'unknown',
    latencyMs: null,
    lastChecked: null,
    lastFailureAt: null,
    lastFailureReason: null,
    successCount: 0,
    failureCount: 0,
  },
  {
    id: 'kuroko',
    name: 'Kuroko',
    priority: 30,
    enabled: SERVER_CONFIG.kuroko.enabled,
    supportsDub: true,
    status: 'unknown',
    latencyMs: null,
    lastChecked: null,
    lastFailureAt: null,
    lastFailureReason: null,
    successCount: 0,
    failureCount: 0,
  },
];

export function isKurokoEnvEnabled(): boolean {
  return SERVER_CONFIG.kuroko.enabled;
}

export function getProvidersOrdered(includeDisabled = false): ProviderRecord[] {
  return providerTable
    .filter((p) => {
      if (p.id === 'kuroko' && !SERVER_CONFIG.kuroko.enabled) return false;
      return includeDisabled ? true : p.enabled;
    })
    .sort((a, b) => a.priority - b.priority)
    .map((p) => ({ ...p }));
}

export function updateProviderSettings(
  id: ProviderId,
  updates: { enabled?: boolean; priority?: number }
): ProviderRecord | null {
  const record = providerTable.find((p) => p.id === id);
  if (!record) return null;
  if (typeof updates.enabled === 'boolean') {
    if (id === 'kuroko' && !SERVER_CONFIG.kuroko.enabled) {
      record.enabled = false;
    } else {
      record.enabled = updates.enabled;
    }
  }
  if (typeof updates.priority === 'number' && Number.isFinite(updates.priority)) {
    record.priority = Math.max(1, Math.floor(updates.priority));
  }
  return { ...record };
}

export function reorderProviders(orderedIds: ProviderId[]): ProviderRecord[] {
  orderedIds.forEach((id, idx) => {
    const rec = providerTable.find((p) => p.id === id);
    if (rec) {
      rec.priority = (idx + 1) * 10;
    }
  });
  return getProvidersOrdered(true);
}

export function recordClientProviderFailure(providerId: ProviderId, reason: string): void {
  const rec = providerTable.find((p) => p.id === providerId);
  if (!rec) return;
  rec.failureCount += 1;
  rec.lastFailureAt = Date.now();
  rec.lastFailureReason = reason.slice(0, 240);
  rec.status = 'degraded';
}

// 4-second server-side health check per provider
export async function probeSingleProvider(
  providerId: ProviderId,
  anilistId: number,
  episode: number,
  lang: AudioLang = 'sub',
  autoplay: 0 | 1 = 0,
  start = 0
): Promise<{
  healthy: boolean;
  latencyMs: number;
  statusCode: number;
  url: string;
  error?: string;
}> {
  const rec = providerTable.find((p) => p.id === providerId);
  const embedUrl = buildProviderUrl(providerId, {
    anilistId,
    episode,
    lang,
    autoplay,
    start,
  });

  const startedAt = Date.now();
  try {
    const res = await fetch(embedUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
      headers: {
        'User-Agent': 'YORUMI-HealthCheck/1.0',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    });
    const latencyMs = Date.now() - startedAt;
    const ok = res.status >= 200 && res.status < 400;

    if (rec) {
      rec.lastChecked = Date.now();
      rec.latencyMs = latencyMs;
      if (ok) {
        rec.status = latencyMs > 3000 ? 'degraded' : 'healthy';
        rec.successCount += 1;
      } else {
        rec.status = 'offline';
        rec.failureCount += 1;
        rec.lastFailureAt = Date.now();
        rec.lastFailureReason = `HTTP ${res.status}`;
      }
    }

    return {
      healthy: ok,
      latencyMs,
      statusCode: res.status,
      url: embedUrl,
      error: ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const reason = err?.name === 'TimeoutError' ? '4s health check timed out' : err?.message || 'Network error';
    if (rec) {
      rec.lastChecked = Date.now();
      rec.latencyMs = latencyMs;
      rec.status = 'offline';
      rec.failureCount += 1;
      rec.lastFailureAt = Date.now();
      rec.lastFailureReason = reason;
    }
    return {
      healthy: false,
      latencyMs,
      statusCode: 0,
      url: embedUrl,
      error: reason,
    };
  }
}

export async function probeAllProviders(
  anilistId = 21,
  episode = 1,
  lang: AudioLang = 'sub'
): Promise<ProviderRecord[]> {
  const list = getProvidersOrdered(true);
  await Promise.allSettled(
    list.map((p) => {
      if (p.id === 'kuroko' && !SERVER_CONFIG.kuroko.enabled) {
        return Promise.resolve();
      }
      return probeSingleProvider(p.id, anilistId, episode, lang, 0, 0);
    })
  );
  return getProvidersOrdered(true);
}

export async function resolveSourcesForEpisode(params: {
  anilistId: number;
  episode: number;
  lang: AudioLang;
  autoplay: 0 | 1;
  start: number;
  mode?: 'auto' | ProviderId;
}): Promise<{
  mode: 'auto' | ProviderId;
  kurokoEnabled: boolean;
  selected: BuiltProviderSource | null;
  fallbacks: BuiltProviderSource[];
  allEnabled: BuiltProviderSource[];
  failedChecks: { id: ProviderId; name: string; reason: string }[];
}> {
  const { anilistId, episode, lang, autoplay, start, mode = 'auto' } = params;
  const enabledProviders = getProvidersOrdered(false);

  if (enabledProviders.length === 0) {
    return {
      mode,
      kurokoEnabled: SERVER_CONFIG.kuroko.enabled,
      selected: null,
      fallbacks: [],
      allEnabled: [],
      failedChecks: [],
    };
  }

  // Build URLs for all enabled providers in priority order
  const builtAll: BuiltProviderSource[] = enabledProviders.map((p) => ({
    id: p.id,
    name: p.name,
    priority: p.priority,
    url: buildProviderUrl(p.id, { anilistId, episode, lang, autoplay, start }),
    healthy: p.status !== 'offline',
    latencyMs: p.latencyMs ?? 0,
  }));

  if (mode !== 'auto') {
    const manualTarget = builtAll.find((p) => p.id === mode);
    if (manualTarget) {
      const probe = await probeSingleProvider(manualTarget.id, anilistId, episode, lang, autoplay, start);
      manualTarget.healthy = probe.healthy;
      manualTarget.latencyMs = probe.latencyMs;
      if (probe.error) manualTarget.error = probe.error;
      const fallbacks = builtAll.filter((p) => p.id !== manualTarget.id);
      return {
        mode,
        kurokoEnabled: SERVER_CONFIG.kuroko.enabled,
        selected: manualTarget,
        fallbacks,
        allEnabled: builtAll,
        failedChecks: probe.healthy
          ? []
          : [{ id: manualTarget.id, name: manualTarget.name, reason: probe.error || 'Health check failed' }],
      };
    }
  }

  // Auto mode: run 4s server-side health checks in priority order until first healthy provider
  let selected: BuiltProviderSource | null = null;
  const failedChecks: { id: ProviderId; name: string; reason: string }[] = [];
  const checkedIds = new Set<ProviderId>();

  for (const candidate of builtAll) {
    checkedIds.add(candidate.id);
    const probe = await probeSingleProvider(candidate.id, anilistId, episode, lang, autoplay, start);
    candidate.healthy = probe.healthy;
    candidate.latencyMs = probe.latencyMs;
    if (probe.error) candidate.error = probe.error;

    if (probe.healthy) {
      selected = candidate;
      break;
    } else {
      failedChecks.push({
        id: candidate.id,
        name: candidate.name,
        reason: probe.error || 'Health check failed',
      });
    }
  }

  // If all failed health checks, still return top priority as initial attempt with fallbacks
  if (!selected) {
    selected = builtAll[0];
  }

  const fallbacks = builtAll.filter((p) => p.id !== selected!.id);

  return {
    mode: 'auto',
    kurokoEnabled: SERVER_CONFIG.kuroko.enabled,
    selected,
    fallbacks,
    allEnabled: builtAll,
    failedChecks,
  };
}

// Query Kuroko or Yenime backend-only to confirm available episode counts for an AniList/MAL ID
export async function fetchProviderConfirmedEpisodes(
  anilistId: number,
  malId?: number | null
): Promise<{
  confirmedCount: number | null;
  sources: { kurokoSub?: number; kurokoDub?: number; yenimeEpisodes?: number };
}> {
  const result: { kurokoSub?: number; kurokoDub?: number; yenimeEpisodes?: number } = {};
  let maxConfirmed: number | null = null;

  const tasks: Promise<void>[] = [];

  if (SERVER_CONFIG.kuroko.enabled) {
    tasks.push(
      (async () => {
        try {
          const res = await fetch(
            `${SERVER_CONFIG.kuroko.apiBaseUrl}/lookup?anilist=${anilistId}`,
            { signal: AbortSignal.timeout(3500) }
          );
          if (res.ok) {
            const json: any = await res.json();
            const subCount = typeof json?.anilist?.sub === 'number' ? json.anilist.sub : null;
            const dubCount = typeof json?.anilist?.dub === 'number' ? json.anilist.dub : null;
            if (subCount !== null) {
              result.kurokoSub = subCount;
              maxConfirmed = Math.max(maxConfirmed ?? 0, subCount);
            }
            if (dubCount !== null) {
              result.kurokoDub = dubCount;
              maxConfirmed = Math.max(maxConfirmed ?? 0, dubCount);
            }
          }
        } catch {
          // ignore provider lookup failure
        }
      })()
    );
  }

  if (malId) {
    tasks.push(
      (async () => {
        try {
          const res = await fetch(
            `${SERVER_CONFIG.yenime.apiBaseUrl}/anime?mal=${malId}&ep=1`,
            { signal: AbortSignal.timeout(3500) }
          );
          if (res.ok) {
            const json: any = await res.json();
            const epList = Array.isArray(json?.episodes) ? json.episodes : null;
            if (epList && epList.length > 0) {
              result.yenimeEpisodes = epList.length;
              maxConfirmed = Math.max(maxConfirmed ?? 0, epList.length);
            }
          }
        } catch {
          // ignore
        }
      })()
    );
  }

  await Promise.allSettled(tasks);
  return { confirmedCount: maxConfirmed, sources: result };
}
