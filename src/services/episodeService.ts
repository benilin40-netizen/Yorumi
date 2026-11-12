import { Anime, EpisodeStatus } from '../types/anime';
import { getNotifications, addNotification, getSubscribedAnimeIds, isFavoriteAlertEnabled } from './notificationService';

export interface EpisodeInfo {
  episodeNumber: number;
  title: string;
  officialTitle?: string;
  status: EpisodeStatus;
  airingAtTimestamp?: number; // Unix UTC timestamp in seconds
  hasStreamSource: boolean;
  statusLabel: string;
  releaseDateFormatted?: string;
  synopsis?: string;
  thumbnail?: string;
}

export interface AnimeEpisodeSchedule {
  animeId: number;
  totalEpisodes: number | null;
  status: string; // RELEASING, FINISHED, NOT_YET_RELEASED, etc.
  latestReleasedEpisode: number;
  episodes: EpisodeInfo[];
  nextAiringEpisode?: {
    episode: number;
    airingAt: number;
    timeUntilAiring: number;
  } | null;
  lastSyncedAt: number;
}

const EPISODE_OVERRIDES_KEY = 'yorumi_episode_overrides_v2';
const EPISODE_TITLES_KEY = 'yorumi_official_ep_titles_v2';
const EPISODE_NOTIFIED_KEY = 'yorumi_notified_episodes_v2';

export function getEpisodeOverrides(): Record<string, { status: EpisodeStatus; hasStreamSource: boolean; note?: string }> {
  try {
    const raw = localStorage.getItem(EPISODE_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveEpisodeOverride(
  animeId: number,
  episodeNumber: number,
  status: EpisodeStatus,
  hasStreamSource: boolean,
  note?: string
) {
  const overrides = getEpisodeOverrides();
  const key = `${animeId}_${episodeNumber}`;
  overrides[key] = { status, hasStreamSource, note };
  localStorage.setItem(EPISODE_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function removeEpisodeOverride(animeId: number, episodeNumber: number) {
  const overrides = getEpisodeOverrides();
  const key = `${animeId}_${episodeNumber}`;
  delete overrides[key];
  localStorage.setItem(EPISODE_OVERRIDES_KEY, JSON.stringify(overrides));
}

// Custom Title Overrides
export function getEpisodeTitleOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(EPISODE_TITLES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveEpisodeTitleOverride(animeId: number, episodeNumber: number, customTitle: string) {
  const titles = getEpisodeTitleOverrides();
  const key = `${animeId}_${episodeNumber}`;
  titles[key] = customTitle.trim();
  localStorage.setItem(EPISODE_TITLES_KEY, JSON.stringify(titles));
}

// Fetch official titles from Jikan API with local caching and safe response parsing
import { safeFetchJson } from '../utils/apiClient';

const jikanTitleCache = new Map<number, Record<number, { title: string; synopsis?: string }>>();

export async function fetchOfficialEpisodeTitles(
  animeId: number,
  malId?: number | null
): Promise<Record<number, { title: string; synopsis?: string }>> {
  if (jikanTitleCache.has(animeId)) {
    return jikanTitleCache.get(animeId)!;
  }

  if (!malId) return {};

  try {
    // Attempt 1: Backend proxy route
    let result = await safeFetchJson<{ data?: any[] }>(`/api/jikan/anime/${malId}/episodes`, { timeoutMs: 6000 });

    // Attempt 2: Direct Jikan API fallback if proxy didn't succeed
    if (!result.ok || !result.data?.data) {
      result = await safeFetchJson<{ data?: any[] }>(`https://api.jikan.moe/v4/anime/${malId}/episodes`, { timeoutMs: 6000 });
    }

    if (!result.ok || !result.data || !Array.isArray(result.data.data)) {
      return {};
    }

    const dataList = result.data.data;
    const map: Record<number, { title: string; synopsis?: string }> = {};

    dataList.forEach((ep: any) => {
      const epNum = ep.mal_id || ep.episode;
      const t = ep.title || ep.title_romanji || ep.title_japanese;
      if (epNum && t) {
        map[epNum] = {
          title: t,
          synopsis: ep.synopsis || undefined,
        };
      }
    });

    jikanTitleCache.set(animeId, map);
    return map;
  } catch (err) {
    console.warn(`Could not fetch Jikan episode titles for MAL ID ${malId}:`, err);
    return {};
  }
}

/**
 * Calculates progressive episode availability for an anime.
 * Core Rule: Airing anime episodes become available ONE AT A TIME as officially released.
 */
export function calculateAnimeEpisodeSchedule(anime: Anime): AnimeEpisodeSchedule {
  const overrides = getEpisodeOverrides();
  const titleOverrides = getEpisodeTitleOverrides();
  const nowSec = Math.floor(Date.now() / 1000);
  const totalEps = anime.episodes || (anime.status === 'FINISHED' ? 12 : 24);
  const animeStatus = anime.status || 'FINISHED';

  let highestReleasedEp = 0;

  if (animeStatus === 'FINISHED') {
    highestReleasedEp = totalEps;
  } else if (animeStatus === 'NOT_YET_RELEASED') {
    highestReleasedEp = 0;
  } else if (anime.nextAiringEpisode) {
    const nextEp = anime.nextAiringEpisode.episode;
    const nextAirAt = anime.nextAiringEpisode.airingAt;

    if (nowSec >= nextAirAt) {
      highestReleasedEp = nextEp;
    } else {
      highestReleasedEp = Math.max(0, nextEp - 1);
    }
  } else {
    highestReleasedEp = totalEps > 0 ? Math.min(totalEps, 12) : 12;
  }

  const jikanTitles = jikanTitleCache.get(anime.id) || {};
  const episodesList: EpisodeInfo[] = [];

  for (let epNum = 1; epNum <= totalEps; epNum++) {
    const overrideKey = `${anime.id}_${epNum}`;
    const override = overrides[overrideKey];
    const titleOverride = titleOverrides[overrideKey];

    let epStatus: EpisodeStatus = 'upcoming';
    let hasStream = false;
    let airingAtTs: number | undefined = undefined;

    if (override) {
      epStatus = override.status;
      hasStream = override.hasStreamSource;
    } else if (epNum <= highestReleasedEp) {
      epStatus = 'released';
      hasStream = true;
    } else if (anime.nextAiringEpisode && epNum === anime.nextAiringEpisode.episode) {
      airingAtTs = anime.nextAiringEpisode.airingAt;
      if (nowSec >= anime.nextAiringEpisode.airingAt) {
        epStatus = 'airing';
        hasStream = true;
      } else {
        epStatus = 'upcoming';
        hasStream = false;
      }
    } else {
      epStatus = 'upcoming';
      hasStream = false;
    }

    let statusLabel = 'Released';
    if (epStatus === 'upcoming') {
      statusLabel = 'Upcoming';
    } else if (epStatus === 'airing') {
      statusLabel = 'Airing Now';
    } else if (epStatus === 'delayed') {
      statusLabel = 'Delayed';
    } else if (epStatus === 'unavailable') {
      statusLabel = 'Released — Source Unavailable';
    }

    let releaseDateFormatted: string | undefined = undefined;
    if (airingAtTs) {
      releaseDateFormatted = new Date(airingAtTs * 1000).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    }

    const officialInfo = jikanTitles[epNum];
    const formattedEpNum = epNum < 10 ? `0${epNum}` : `${epNum}`;
    let finalTitle = titleOverride || (officialInfo ? `Episode ${epNum} — ${officialInfo.title}` : `Episode ${formattedEpNum}`);

    episodesList.push({
      episodeNumber: epNum,
      title: finalTitle,
      officialTitle: officialInfo?.title || titleOverride,
      status: epStatus,
      airingAtTimestamp: airingAtTs,
      hasStreamSource: hasStream,
      statusLabel,
      releaseDateFormatted,
      synopsis: officialInfo?.synopsis,
      thumbnail: anime.coverImage.extraLarge || anime.coverImage.large,
    });
  }

  return {
    animeId: anime.id,
    totalEpisodes: totalEps,
    status: animeStatus,
    latestReleasedEpisode: highestReleasedEp,
    episodes: episodesList,
    nextAiringEpisode: anime.nextAiringEpisode,
    lastSyncedAt: Date.now(),
  };
}

/**
 * Validates if an episode can be watched.
 */
export function isEpisodePlayable(anime: Anime, episodeNumber: number): {
  playable: boolean;
  reason?: string;
  status: EpisodeStatus;
  highestReleasedEp: number;
} {
  const schedule = calculateAnimeEpisodeSchedule(anime);
  const targetEp = schedule.episodes.find((e) => e.episodeNumber === episodeNumber);

  if (!targetEp) {
    return {
      playable: false,
      reason: `Episode ${episodeNumber} does not exist for this anime.`,
      status: 'upcoming',
      highestReleasedEp: schedule.latestReleasedEpisode,
    };
  }

  if (targetEp.status === 'upcoming') {
    return {
      playable: false,
      reason: `Episode ${episodeNumber} has not been officially released yet.`,
      status: 'upcoming',
      highestReleasedEp: schedule.latestReleasedEpisode,
    };
  }

  if (targetEp.status === 'delayed') {
    return {
      playable: false,
      reason: `Episode ${episodeNumber} official release has been delayed.`,
      status: 'delayed',
      highestReleasedEp: schedule.latestReleasedEpisode,
    };
  }

  if (targetEp.status === 'unavailable' || !targetEp.hasStreamSource) {
    return {
      playable: false,
      reason: `Episode ${episodeNumber} is released, but streaming source is currently unavailable.`,
      status: 'unavailable',
      highestReleasedEp: schedule.latestReleasedEpisode,
    };
  }

  return {
    playable: true,
    status: targetEp.status,
    highestReleasedEp: schedule.latestReleasedEpisode,
  };
}

/**
 * Retrieves next playable episode for Auto-Play Next.
 * Never attempts to play an upcoming or unreleased episode.
 */
export function getNextPlayableEpisode(anime: Anime, currentEpisode: number): EpisodeInfo | null {
  const schedule = calculateAnimeEpisodeSchedule(anime);
  const nextEpNum = currentEpisode + 1;
  const nextEp = schedule.episodes.find((e) => e.episodeNumber === nextEpNum);

  if (nextEp && (nextEp.status === 'released' || nextEp.status === 'airing') && nextEp.hasStreamSource) {
    return nextEp;
  }
  return null;
}

/**
 * Checks for new episode releases and sends user notifications.
 */
export function syncEpisodeReleasesAndNotify(anime: Anime): void {
  const schedule = calculateAnimeEpisodeSchedule(anime);
  const subscribedIds = getSubscribedAnimeIds();

  if (!subscribedIds.includes(anime.id)) return;

  const rawNotified = localStorage.getItem(EPISODE_NOTIFIED_KEY);
  const notifiedSet: string[] = rawNotified ? JSON.parse(rawNotified) : [];

  schedule.episodes.forEach((ep) => {
    if (ep.status === 'released' && ep.hasStreamSource) {
      const key = `${anime.id}_ep_${ep.episodeNumber}`;
      if (!notifiedSet.includes(key)) {
        notifiedSet.push(key);
        const title = anime.title.english || anime.title.romaji;
        const epTitle = ep.officialTitle ? `: ${ep.officialTitle}` : '';
        const isFav = isFavoriteAlertEnabled(anime.id);

        addNotification({
          title: isFav ? `⭐ New Episode: ${title}` : `New Episode Released: ${title}`,
          message: isFav
            ? `Episode ${ep.episodeNumber}${epTitle} of your favorited show is now ready to stream on Yorumi!`
            : `Episode ${ep.episodeNumber}${epTitle} is now available to stream on Yorumi!`,
          type: isFav ? 'favorite_release' : 'aired',
          animeId: anime.id,
          animeTitle: title,
          coverImage: anime.coverImage.large || anime.coverImage.extraLarge,
          episodeNumber: ep.episodeNumber,
        });
      }
    }
  });

  localStorage.setItem(EPISODE_NOTIFIED_KEY, JSON.stringify(notifiedSet));
}
