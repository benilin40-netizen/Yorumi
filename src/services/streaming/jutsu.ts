import { StreamEmbedConfig, AudioOption } from '../../types/anime';

export interface JutsuOptions {
  anilistId: number;
  malId?: number | null;
  episode: number;
  audio?: AudioOption;
  mode?: 'embed' | 'm3u8';
  useMal?: boolean;
}

export function getJutsuUrl(options: JutsuOptions): StreamEmbedConfig {
  const { anilistId, malId, episode, audio = 'sub', mode = 'embed', useMal = false } = options;

  const idType = (useMal && malId) ? 'mal' : 'ani';
  const targetId = (useMal && malId) ? malId : anilistId;

  if (mode === 'm3u8') {
    return {
      providerId: 'jutsu',
      url: `https://jutsu.club/meu8/${idType}/${targetId}/${episode}/${audio}?server=flow`,
      isIframe: false,
      isHls: true,
    };
  }

  return {
    providerId: 'jutsu',
    url: `https://jutsu.club/embed/${idType}/${targetId}/${episode}/${audio}?server=flow`,
    isIframe: true,
  };
}
