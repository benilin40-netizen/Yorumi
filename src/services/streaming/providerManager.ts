import { AudioOption, ProviderHealth, StreamEmbedConfig } from '../../types/anime';
import { getJutsuUrl } from './jutsu';

export type ProviderId = 'jutsu';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  badge: string;
  description: string;
  supportsDub: boolean;
  mirrors: string[];
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'jutsu',
    name: 'Jutsu / AniFlow',
    badge: 'Sub & Dub',
    description: 'High-performance dedicated streaming engine with direct M3U8 HLS manifest routing and server flows.',
    supportsDub: true,
    mirrors: ['Embed Server Flow', 'M3U8 Direct HLS', 'MAL Embed Route'],
  },
];

const PREFERRED_PROVIDER_KEY = 'yorumi_preferred_provider';
const PROVIDER_STATUS_KEY = 'yorumi_provider_status_overrides';

export function getPreferredProvider(): ProviderId {
  return 'jutsu';
}

export function setPreferredProvider(providerId: ProviderId) {
  localStorage.setItem(PREFERRED_PROVIDER_KEY, providerId);
}

export function getProviderConfig(
  providerId: ProviderId,
  params: {
    anilistId: number;
    malId?: number | null;
    episode: number;
    audio?: AudioOption;
    mirrorIndex?: number;
  }
): StreamEmbedConfig {
  const { anilistId, malId, episode, audio = 'sub', mirrorIndex = 0 } = params;
  const mode = mirrorIndex === 1 ? 'm3u8' : 'embed';
  const useMal = mirrorIndex === 2;

  return getJutsuUrl({
    anilistId,
    malId,
    episode,
    audio,
    mode,
    useMal,
  });
}

export function getProviderHealthList(): ProviderHealth[] {
  const storedOverrides = localStorage.getItem(PROVIDER_STATUS_KEY);
  const overrides = storedOverrides ? JSON.parse(storedOverrides) : {};

  return PROVIDERS.map((p) => {
    const isOverridden = overrides[p.id] !== undefined;
    return {
      id: p.id,
      name: p.name,
      status: isOverridden ? (overrides[p.id] ? 'healthy' : 'offline') : 'healthy',
      latencyMs: Math.floor(Math.random() * 20) + 45,
      lastChecked: Date.now(),
      enabled: isOverridden ? overrides[p.id] : true,
      notes: p.description,
    };
  });
}

export function toggleProviderEnabled(providerId: ProviderId, enabled: boolean) {
  const storedOverrides = localStorage.getItem(PROVIDER_STATUS_KEY);
  const overrides = storedOverrides ? JSON.parse(storedOverrides) : {};
  overrides[providerId] = enabled;
  localStorage.setItem(PROVIDER_STATUS_KEY, JSON.stringify(overrides));
}
