import {
  AudioOption,
  ProviderHealth,
  ProviderId,
  ProviderMode,
  SourcesResolutionResponse,
} from '../../types/anime';

export const PROVIDERS_META: { id: ProviderId; name: string; supportsDub: boolean }[] = [
  { id: 'yenime', name: 'Yenime', supportsDub: false },
  { id: 'aniembed', name: 'AniEmbed', supportsDub: true },
  { id: 'kuroko', name: 'Kuroko', supportsDub: true },
];

const PREFERRED_PROVIDER_KEY = 'yorumi_preferred_provider';
const PROVIDER_MODE_KEY = 'yorumi_provider_mode';

export function isValidProviderId(val: unknown): val is ProviderId {
  return val === 'yenime' || val === 'aniembed' || val === 'kuroko';
}

export function getStoredProviderMode(): ProviderMode {
  try {
    const raw = localStorage.getItem(PROVIDER_MODE_KEY);
    return raw === 'manual' ? 'manual' : 'auto';
  } catch {
    return 'auto';
  }
}

export function getStoredPreferredProvider(): ProviderId {
  try {
    const raw = localStorage.getItem(PREFERRED_PROVIDER_KEY);
    return isValidProviderId(raw) ? raw : 'yenime';
  } catch {
    return 'yenime';
  }
}

export function saveProviderPreference(mode: ProviderMode, providerId: ProviderId) {
  try {
    localStorage.setItem(PROVIDER_MODE_KEY, mode);
    localStorage.setItem(PREFERRED_PROVIDER_KEY, providerId);
  } catch {
    // ignore storage errors
  }
}

export async function fetchAvailableProviders(): Promise<{
  kurokoEnabled: boolean;
  providers: ProviderHealth[];
}> {
  const res = await fetch('/api/providers');
  if (!res.ok) {
    throw new Error('Failed to load streaming providers');
  }
  return res.json();
}

export async function resolveEpisodeSources(params: {
  anilistId: number;
  episode: number;
  lang: AudioOption;
  autoplay?: 0 | 1;
  startSeconds?: number;
  mode: 'auto' | ProviderId;
}): Promise<SourcesResolutionResponse> {
  const { anilistId, episode, lang, autoplay = 0, startSeconds = 0, mode } = params;
  const qs = new URLSearchParams({
    lang,
    autoplay: String(autoplay),
    t: String(Math.max(0, Math.floor(startSeconds))),
    mode,
  });
  const res = await fetch(`/api/sources/${anilistId}/${episode}?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Source resolution failed (${res.status})`);
  }
  return res.json();
}

export async function reportProviderFailure(providerId: ProviderId, reason: string): Promise<void> {
  try {
    await fetch('/api/sources/report-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, reason }),
    });
  } catch {
    // ignore telemetry failure
  }
}
