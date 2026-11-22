import { Anime } from '../types/anime';
import { aniListManager } from './anilistManager';
import { auth } from './firebase';
import { getWatchlist, getFavorites } from './storage';

export type NotificationCategory =
  | 'all'
  | 'airing'
  | 'aired'
  | 'new_anime'
  | 'seasons'
  | 'announcements'
  | 'account'
  | 'system'
  | 'favorite_release';

export interface NotificationPreference {
  airingReminders: boolean;
  airedAlerts: boolean;
  newAnimeAlerts: boolean;
  seasonAlerts: boolean;
  announcements: boolean;
  accountAlerts: boolean;
  favoriteReleaseAlerts: boolean;
  mutedFavoriteIds: number[];
  reminderIntervalMinutes: number;
  pushEnabled: boolean;
  timezone: string;
  preferredFormats: string[];
  subscribedAnimeIds?: number[];
}

export interface YorumiNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
  unread: boolean;
  type: NotificationCategory;
  animeId?: number;
  animeTitle?: string;
  coverImage?: string;
  episodeNumber?: number;
  actionUrl?: string;
}

const DEFAULT_PREFS: NotificationPreference = {
  airingReminders: true,
  airedAlerts: true,
  newAnimeAlerts: true,
  seasonAlerts: true,
  announcements: true,
  accountAlerts: true,
  favoriteReleaseAlerts: true,
  mutedFavoriteIds: [],
  reminderIntervalMinutes: 30,
  pushEnabled: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  preferredFormats: ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'],
};

function getCurrentUid(): string {
  const uid = auth.currentUser ? auth.currentUser.uid : 'guest';
  return uid;
}

function prefsStorageKey(uid = getCurrentUid()): string {
  return `yorumi_v2_${uid}_notification_prefs`;
}

function notifsStorageKey(uid = getCurrentUid()): string {
  return `yorumi_v2_${uid}_notifications`;
}

function subscribedStorageKey(uid = getCurrentUid()): string {
  return `yorumi_v2_${uid}_subscribed_anime`;
}

function sanitizeNotificationId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export function formatTimeForZone(tsMs: number, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: timezone || getNotificationPreferences().timezone || 'UTC',
    }).format(new Date(tsMs));
  } catch {
    return new Date(tsMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export function getNotificationPreferences(): NotificationPreference {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PREFS;
    const raw = localStorage.getItem(prefsStorageKey());
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNotificationPreferences(prefs: NotificationPreference): void {
  const uid = getCurrentUid();
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(prefsStorageKey(uid), JSON.stringify(prefs));
  }
}

export function getNotifications(): YorumiNotification[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(notifsStorageKey());
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveNotifications(notifications: YorumiNotification[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(notifsStorageKey(), JSON.stringify(notifications.slice(0, 150)));
  }
}

export function addNotification(
  notif: Omit<YorumiNotification, 'id' | 'timestamp' | 'time' | 'unread'> & {
    id?: string;
    timestamp?: number;
    time?: string;
  }
): YorumiNotification {
  const current = getNotifications();
  const resolvedId = sanitizeNotificationId(
    notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  );

  const existing = current.find((n) => n.id === resolvedId);
  if (existing) {
    return existing;
  }

  const ts = notif.timestamp || Date.now();
  const prefs = getNotificationPreferences();
  const newNotif: YorumiNotification = {
    ...notif,
    id: resolvedId,
    timestamp: ts,
    time: notif.time || formatTimeForZone(ts, prefs.timezone),
    unread: true,
  };

  current.unshift(newNotif);
  saveNotifications(current);

  if (prefs.pushEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(newNotif.title, {
        body: newNotif.message,
        icon: newNotif.coverImage || '/favicon.ico',
      });
    } catch {
      // ignore
    }
  }

  return newNotif;
}

export function markAllNotificationsRead(): YorumiNotification[] {
  const current = getNotifications();
  const updated = current.map((n) => ({ ...n, unread: false }));
  saveNotifications(updated);
  return updated;
}

export function deleteNotification(id: string): YorumiNotification[] {
  const current = getNotifications();
  const updated = current.filter((n) => n.id !== id);
  saveNotifications(updated);
  return updated;
}

export function clearReadNotifications(): YorumiNotification[] {
  const current = getNotifications();
  const updated = current.filter((n) => n.unread);
  saveNotifications(updated);
  return updated;
}

export async function syncNotificationsAndPrefsFromFirestore(uid: string): Promise<{
  notifications: YorumiNotification[];
  preferences: NotificationPreference;
}> {
  return {
    notifications: getNotifications(),
    preferences: getNotificationPreferences(),
  };
}

export function isFavoriteAlertEnabled(animeId: number): boolean {
  const prefs = getNotificationPreferences();
  if (!prefs.favoriteReleaseAlerts) return false;
  return !prefs.mutedFavoriteIds?.includes(animeId);
}

export function toggleFavoriteAlert(animeId: number): boolean {
  const prefs = getNotificationPreferences();
  const muted = prefs.mutedFavoriteIds || [];
  const isMuted = muted.includes(animeId);
  const updatedMuted = isMuted ? muted.filter((id) => id !== animeId) : [...muted, animeId];

  saveNotificationPreferences({
    ...prefs,
    favoriteReleaseAlerts: true,
    mutedFavoriteIds: updatedMuted,
  });

  return isMuted;
}

export function enableAllFavoritesAlerts(animeIds: number[]): void {
  const prefs = getNotificationPreferences();
  const muted = prefs.mutedFavoriteIds || [];
  const updatedMuted = muted.filter((id) => !animeIds.includes(id));
  saveNotificationPreferences({
    ...prefs,
    favoriteReleaseAlerts: true,
    mutedFavoriteIds: updatedMuted,
  });
}

export function muteAllFavoritesAlerts(animeIds: number[]): void {
  const prefs = getNotificationPreferences();
  const muted = new Set(prefs.mutedFavoriteIds || []);
  animeIds.forEach((id) => muted.add(id));
  saveNotificationPreferences({
    ...prefs,
    mutedFavoriteIds: Array.from(muted),
  });
}

export function testFavoriteReleaseAlert(anime: Anime, episodeNum: number = 1): YorumiNotification {
  const title = anime.title.english || anime.title.romaji;
  return addNotification({
    id: `test_fav_${anime.id}_${Date.now()}`,
    title: `Favorite Release Alert Test: ${title}`,
    message: `Episode ${episodeNum} release alert simulation for your favorited show.`,
    type: 'favorite_release',
    animeId: anime.id,
    animeTitle: title,
    coverImage: anime.coverImage.large || anime.coverImage.extraLarge,
    episodeNumber: episodeNum,
    actionUrl: `/watch/${anime.id}/${episodeNum}`,
  });
}

export function getSubscribedAnimeIds(): number[] {
  const uid = getCurrentUid();
  const subscribedSet = new Set<number>();

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(subscribedStorageKey(uid));
      if (raw) {
        const parsed: number[] = JSON.parse(raw);
        parsed.forEach((id) => subscribedSet.add(id));
      }
    }
  } catch {
    // ignore
  }

  const watchlist = getWatchlist();
  watchlist.forEach((w) => subscribedSet.add(w.anime.id));

  const prefs = getNotificationPreferences();
  if (prefs.favoriteReleaseAlerts) {
    const favorites = getFavorites();
    const mutedSet = new Set(prefs.mutedFavoriteIds || []);
    favorites.forEach((fav) => {
      if (!mutedSet.has(fav.id)) {
        subscribedSet.add(fav.id);
      }
    });
  }

  const result = Array.from(subscribedSet);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(subscribedStorageKey(uid), JSON.stringify(result));
  }
  return result;
}

export function toggleAnimeSubscription(animeId: number): boolean {
  const uid = getCurrentUid();
  const ids = getSubscribedAnimeIds();
  const index = ids.indexOf(animeId);
  let isSubscribed = false;
  if (index >= 0) {
    ids.splice(index, 1);
  } else {
    ids.push(animeId);
    isSubscribed = true;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(subscribedStorageKey(uid), JSON.stringify(ids));
  }
  return isSubscribed;
}

export function notifyWelcomeUser(displayName: string) {
  const uid = getCurrentUid();
  addNotification({
    id: `welcome_${uid}`,
    title: `Welcome to Yorumi, ${displayName}!`,
    message:
      'Your account is ready. Explore seasonal airing anime and customize your release notifications.',
    type: 'account',
  });
}

export async function checkAiringScheduleAndNotify(): Promise<number> {
  const prefs = getNotificationPreferences();
  if (!prefs.airingReminders && !prefs.airedAlerts && !prefs.favoriteReleaseAlerts) return 0;

  const subscribedIds = getSubscribedAnimeIds();
  if (subscribedIds.length === 0) return 0;

  let addedCount = 0;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const windowSeconds = Math.max(15, prefs.reminderIntervalMinutes || 30) * 60;
    const targetIds = subscribedIds.slice(0, 50);

    const queryGql = `
      query ($mediaIds: [Int], $airingGreater: Int, $airingLesser: Int) {
        Page(page: 1, perPage: 50) {
          airingSchedules(mediaId_in: $mediaIds, airingAt_greater: $airingGreater, airingAt_lesser: $airingLesser, sort: TIME) {
            id
            episode
            airingAt
            timeUntilAiring
            media {
              id
              title {
                english
                romaji
              }
              coverImage {
                large
              }
              format
            }
          }
        }
      }
    `;

    const data = await aniListManager.request<any>(
      queryGql,
      {
        mediaIds: targetIds,
        airingGreater: nowSec - 3600 * 6,
        airingLesser: nowSec + Math.max(windowSeconds, 3600) + 600,
      },
      120000
    );

    const schedules = data?.Page?.airingSchedules || [];
    const existingNotifs = getNotifications();
    const favoriteIds = new Set(getFavorites().map((f) => f.id));

    for (const sch of schedules) {
      const animeId = sch.media?.id;
      if (!animeId) continue;

      if (
        Array.isArray(prefs.preferredFormats) &&
        prefs.preferredFormats.length > 0 &&
        sch.media.format &&
        !prefs.preferredFormats.includes(sch.media.format)
      ) {
        continue;
      }

      const title = sch.media.title?.english || sch.media.title?.romaji || 'Anime';
      const cover = sch.media.coverImage?.large;
      const diffSec = sch.airingAt - nowSec;
      const airTimeLabel = formatTimeForZone(sch.airingAt * 1000, prefs.timezone);
      const isFav = favoriteIds.has(animeId) && isFavoriteAlertEnabled(animeId);

      if (prefs.airingReminders && diffSec > 60 && diffSec <= windowSeconds) {
        const minsLeft = Math.max(1, Math.round(diffSec / 60));
        const notifId = `airing_${prefs.reminderIntervalMinutes}_${sch.id}`;
        if (!existingNotifs.some((n) => n.id === notifId)) {
          addNotification({
            id: notifId,
            title: `Airing Soon: ${title}`,
            message: `Episode ${sch.episode} airs in ~${minsLeft} min (${airTimeLabel}).`,
            type: 'airing',
            animeId,
            animeTitle: title,
            coverImage: cover,
            episodeNumber: sch.episode,
            actionUrl: `/watch/${animeId}/${sch.episode}`,
          });
          addedCount += 1;
        }
      }

      if ((prefs.airedAlerts || isFav) && diffSec <= 0 && diffSec >= -3600 * 6) {
        const notifId = `aired_${sch.id}`;
        if (!existingNotifs.some((n) => n.id === notifId)) {
          addNotification({
            id: notifId,
            title: isFav ? `New Favorite Episode: ${title}` : `Episode Aired: ${title}`,
            message: isFav
              ? `Episode ${sch.episode} of your favorited show aired at ${airTimeLabel}.`
              : `Episode ${sch.episode} aired at ${airTimeLabel}.`,
            type: isFav ? 'favorite_release' : 'aired',
            animeId,
            animeTitle: title,
            coverImage: cover,
            episodeNumber: sch.episode,
            actionUrl: `/watch/${animeId}/${sch.episode}`,
          });
          addedCount += 1;
        }
      }
    }
  } catch (err) {
    console.warn('Airing notification check warning:', err);
  }

  return addedCount;
}
