import { Anime, EpisodeStatus } from '../types/anime';
import {
  addNotification,
  getSubscribedAnimeIds,
  isFavoriteAlertEnabled,
} from './notificationService';
import { safeFetchJson } from '../utils/apiClient';

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

export interface EpisodeOverrideRecord {
  status: EpisodeStatus;
  hasStreamSource: boolean;
  note?: string;
  titleOverride?: string;
  updatedAt?: number;
}

const EPISODE_OVERRIDES_KEY = 'yorumi_episode_overrides_v3';
const EPISODE_TITLES_KEY = 'yorumi_official_ep_titles_v3';
const EPISODE_NOTIFIED_KEY = 'yorumi_notified_episodes_v3';

export function getEpisodeOverrides(): Record<string, EpisodeOverrideRecord> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(EPISODE_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalOverrides(overrides: Record<string, EpisodeOverrideRecord>) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EPISODE_OVERRIDES_KEY, JSON.stringify(overrides));
    }
  } catch {
    // ignore storage errors
  }
}

export async function loadEpisodeOverridesFromFirestore(): Promise<Record<string, EpisodeOverrideRecord>> {
  return getEpisodeOverrides();
}

export async function saveEpisodeOverride(
  animeId: number,
  episodeNumber: number,
  status: EpisodeStatus,
  hasStreamSource: boolean,
  note?: string
): Promise<void> {
  const overrides = getEpisodeOverrides();
  const key = `${animeId}_${episodeNumber}`;
  const titleOverride = getEpisodeTitleOverrides()[key];
  const record: EpisodeOverrideRecord = {
    status,
    hasStreamSource,
    note,
    ...(titleOverride ? { titleOverride } : {}),
    updatedAt: Date.now(),
  };

  overrides[key] = record;
  writeLocalOverrides(overrides);
}

export async function removeEpisodeOverride(animeId: number, episodeNumber: number): Promise<void> {
  const overrides = getEpisodeOverrides();
  const key = `${animeId}_${episodeNumber}`;
  delete overrides[key];
  writeLocalOverrides(overrides);
}

export function getEpisodeTitleOverrides(): Record<string, string> {
  try {
    if (typeof localStorage === 'undefined') return {};
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
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(EPISODE_TITLES_KEY, JSON.stringify(titles));
  }
}

const jikanTitleCache = new Map<number, Record<number, { title: string; synopsis?: string }>>();
const jikanTitleInFlight = new Map<number, Promise<Record<number, { title: string; synopsis?: string }>>>();

export async function fetchOfficialEpisodeTitles(
  animeId: number,
  malId?: number | null
): Promise<Record<number, { title: string; synopsis?: string }>> {
  if (jikanTitleCache.has(animeId)) {
    return jikanTitleCache.get(animeId)!;
  }

  if (!malId) return {};

  const existing = jikanTitleInFlight.get(animeId);
  if (existing) return existing;

  const task = (async () => {
    try {
      const result = await safeFetchJson<{ data?: any[] }>(`/api/jikan/anime/${malId}/episodes`, { timeoutMs: 6000 });

      if (!result.ok || !result.data || !Array.isArray(result.data.data)) {
        return {};
      }

      const map: Record<number, { title: string; synopsis?: string }> = {};
      result.data.data.forEach((ep: any) => {
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
    } finally {
      jikanTitleInFlight.delete(animeId);
    }
  })();

  jikanTitleInFlight.set(animeId, task);
  return task;
}

export function calculateAnimeEpisodeSchedule(anime: Anime): AnimeEpisodeSchedule {
  const overrides = getEpisodeOverrides();
  const titleOverrides = getEpisodeTitleOverrides();
  const jikanTitles = jikanTitleCache.get(anime.id) || {};
  const nowSec = Math.floor(Date.now() / 1000);

  const animeStatus = anime.status || 'FINISHED';
  const knownTotalEpisodes = typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : null;
  const jikanEpisodeNums = Object.keys(jikanTitles).map((k) => parseInt(k, 10)).filter((n) => !Number.isNaN(n));
  const maxJikanEp = jikanEpisodeNums.length > 0 ? Math.max(...jikanEpisodeNums) : 0;

  let maxOverrideEp = 0;
  const prefix = `${anime.id}_`;
  Object.keys(overrides).forEach((key) => {
    if (key.startsWith(prefix)) {
      const epNum = parseInt(key.slice(prefix.length), 10);
      if (!Number.isNaN(epNum) && epNum > maxOverrideEp) {
        maxOverrideEp = epNum;
      }
    }
  });

  let highestConfirmedReleasedEp = 0;

  if (animeStatus === 'NOT_YET_RELEASED') {
    highestConfirmedReleasedEp = 0;
  } else if (animeStatus === 'FINISHED') {
    highestConfirmedReleasedEp = knownTotalEpisodes || maxJikanEp || 0;
  } else if (anime.nextAiringEpisode && anime.nextAiringEpisode.episode >= 1) {
    const nextEp = anime.nextAiringEpisode.episode;
    highestConfirmedReleasedEp = Math.max(0, nextEp - 1);
  } else if (maxJikanEp > 0) {
    highestConfirmedReleasedEp = maxJikanEp;
  } else {
    highestConfirmedReleasedEp = 0;
  }

  for (let i = highestConfirmedReleasedEp + 1; i <= maxOverrideEp; i++) {
    const ov = overrides[`${anime.id}_${i}`];
    if (ov && (ov.status === 'released' || ov.status === 'airing') && ov.hasStreamSource) {
      highestConfirmedReleasedEp = i;
    }
  }

  const nextEpNumber = anime.nextAiringEpisode?.episode || 0;
  const displayCeiling = knownTotalEpisodes
    ? Math.max(knownTotalEpisodes, highestConfirmedReleasedEp, nextEpNumber, maxOverrideEp)
    : Math.max(highestConfirmedReleasedEp, nextEpNumber, maxJikanEp, maxOverrideEp);

  const episodesList: EpisodeInfo[] = [];

  for (let epNum = 1; epNum <= displayCeiling; epNum++) {
    const overrideKey = `${anime.id}_${epNum}`;
    const override = overrides[overrideKey];
    const titleOverride = titleOverrides[overrideKey] || override?.titleOverride;

    let epStatus: EpisodeStatus = 'upcoming';
    let hasStream = false;
    let airingAtTs: number | undefined = undefined;

    if (anime.nextAiringEpisode && epNum === anime.nextAiringEpisode.episode) {
      airingAtTs = anime.nextAiringEpisode.airingAt;
    }

    if (override) {
      epStatus = override.status;
      hasStream = override.hasStreamSource;
    } else if (epNum <= highestConfirmedReleasedEp) {
      epStatus = 'released';
      hasStream = true;
    } else if (anime.nextAiringEpisode && epNum === anime.nextAiringEpisode.episode) {
      if (nowSec >= anime.nextAiringEpisode.airingAt && nowSec <= anime.nextAiringEpisode.airingAt + 3600 * 6) {
        epStatus = 'airing';
        hasStream = false;
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
      statusLabel = 'Airing';
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
    const finalTitle = titleOverride || (officialInfo ? `Episode ${epNum} — ${officialInfo.title}` : `Episode ${formattedEpNum}`);

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
      thumbnail: anime.coverImage?.extraLarge || anime.coverImage?.large || '',
    });
  }

  return {
    animeId: anime.id,
    totalEpisodes: knownTotalEpisodes,
    status: animeStatus,
    latestReleasedEpisode: highestConfirmedReleasedEp,
    episodes: episodesList,
    nextAiringEpisode: anime.nextAiringEpisode,
    lastSyncedAt: Date.now(),
  };
}

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
      reason: `Episode ${episodeNumber} is not released or confirmed yet for this anime.`,
      status: 'upcoming',
      highestReleasedEp: schedule.latestReleasedEpisode,
    };
  }

  if (targetEp.status === 'upcoming') {
    return {
      playable: false,
      reason: `Episode ${episodeNumber} is scheduled (${targetEp.releaseDateFormatted || 'date TBA'}) and has not been officially released yet.`,
      status: 'upcoming',
      highestReleasedEp: schedule.latestReleasedEpisode,
    };
  }

  if (targetEp.status === 'airing' && !targetEp.hasStreamSource) {
    return {
      playable: false,
      reason: `Episode ${episodeNumber} is currently airing and awaiting verified stream confirmation.`,
      status: 'airing',
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
      reason: `Episode ${episodeNumber} is released, but the streaming source is currently unavailable.`,
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

export function getNextPlayableEpisode(anime: Anime, currentEpisode: number): EpisodeInfo | null {
  const schedule = calculateAnimeEpisodeSchedule(anime);
  const nextEpNum = currentEpisode + 1;
  const nextEp = schedule.episodes.find((e) => e.episodeNumber === nextEpNum);

  if (nextEp && (nextEp.status === 'released' || nextEp.status === 'airing') && nextEp.hasStreamSource) {
    return nextEp;
  }
  return null;
}

export function syncEpisodeReleasesAndNotify(anime: Anime): void {
  const schedule = calculateAnimeEpisodeSchedule(anime);
  const subscribedIds = getSubscribedAnimeIds();

  if (!subscribedIds.includes(anime.id) || typeof localStorage === 'undefined') return;

  const rawNotified = localStorage.getItem(EPISODE_NOTIFIED_KEY);
  const notifiedSet: string[] = rawNotified ? JSON.parse(rawNotified) : [];

  let changed = false;
  schedule.episodes.forEach((ep) => {
    if (ep.status === 'released' && ep.hasStreamSource) {
      const key = `${anime.id}_ep_${ep.episodeNumber}`;
      if (!notifiedSet.includes(key)) {
        notifiedSet.push(key);
        changed = true;
        const title = anime.title.english || anime.title.romaji;
        const epTitle = ep.officialTitle ? `: ${ep.officialTitle}` : '';
        const isFav = isFavoriteAlertEnabled(anime.id);

        addNotification({
          id: `rel_${anime.id}_${ep.episodeNumber}`,
          title: isFav ? `New Favorite Episode: ${title}` : `New Episode Released: ${title}`,
          message: isFav
            ? `Episode ${ep.episodeNumber}${epTitle} of your favorited show is now ready to stream on Yorumi.`
            : `Episode ${ep.episodeNumber}${epTitle} is now available to stream on Yorumi.`,
          type: isFav ? 'favorite_release' : 'aired',
          animeId: anime.id,
          animeTitle: title,
          coverImage: anime.coverImage.large || anime.coverImage.extraLarge,
          episodeNumber: ep.episodeNumber,
          actionUrl: `/watch/${anime.id}/${ep.episodeNumber}`,
        });
      }
    }
  });

  if (changed) {
    localStorage.setItem(EPISODE_NOTIFIED_KEY, JSON.stringify(notifiedSet.slice(-500)));
  }
}
