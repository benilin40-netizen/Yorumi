import { Anime } from '../types/anime';
import { aniListManager } from './anilistManager';
import { getWatchlist, getFavorites } from './storage';

export type NotificationCategory = 'all' | 'airing' | 'aired' | 'new_anime' | 'seasons' | 'announcements' | 'account' | 'system' | 'favorite_release';

export interface NotificationPreference {
  airingReminders: boolean;
  airedAlerts: boolean;
  newAnimeAlerts: boolean;
  seasonAlerts: boolean;
  announcements: boolean;
  accountAlerts: boolean;
  favoriteReleaseAlerts: boolean; // Opt-in to receive alerts for new episode releases for favorited shows
  mutedFavoriteIds: number[];     // Individual anime IDs muted by the user
  reminderIntervalMinutes: number; // 15, 30, 60
  pushEnabled: boolean;
  timezone: string;
  preferredFormats: string[]; // TV, MOVIE, OVA, ONA, SPECIAL
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

const NOTIFICATION_PREFS_KEY = 'yorumi_notification_prefs_v3';
const NOTIFICATIONS_KEY = 'yorumi_notifications_v3';
const SUBSCRIBED_ANIME_KEY = 'yorumi_subscribed_anime_ids';

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
  timezone: 'Africa/Kampala',
  preferredFormats: ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'],
};

export function getNotificationPreferences(): NotificationPreference {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNotificationPreferences(prefs: NotificationPreference): void {
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

export function getNotifications(): YorumiNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveNotifications(notifications: YorumiNotification[]): void {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export function addNotification(notif: Omit<YorumiNotification, 'id' | 'timestamp' | 'time' | 'unread'>): YorumiNotification {
  const current = getNotifications();
  const newNotif: YorumiNotification = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    time: 'Just now',
    unread: true,
  };

  current.unshift(newNotif);
  const trimmed = current.slice(0, 150);
  saveNotifications(trimmed);

  // Trigger browser push if enabled
  const prefs = getNotificationPreferences();
  if (prefs.pushEnabled && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(newNotif.title, {
        body: newNotif.message,
        icon: newNotif.coverImage || '/favicon.ico',
      });
    } catch {}
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

export function isFavoriteAlertEnabled(animeId: number): boolean {
  const prefs = getNotificationPreferences();
  if (!prefs.favoriteReleaseAlerts) return false;
  return !prefs.mutedFavoriteIds?.includes(animeId);
}

export function toggleFavoriteAlert(animeId: number): boolean {
  const prefs = getNotificationPreferences();
  const muted = prefs.mutedFavoriteIds || [];
  const isMuted = muted.includes(animeId);
  let updatedMuted: number[];

  if (isMuted) {
    updatedMuted = muted.filter((id) => id !== animeId);
  } else {
    updatedMuted = [...muted, animeId];
  }

  saveNotificationPreferences({
    ...prefs,
    favoriteReleaseAlerts: true, // ensure master opt-in stays true when toggling
    mutedFavoriteIds: updatedMuted,
  });

  return isMuted; // returns true if now enabled
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
    title: `⭐ New Episode: ${title}`,
    message: `Episode ${episodeNum} is now available! As requested for your favorited shows, you're getting this live alert.`,
    type: 'favorite_release',
    animeId: anime.id,
    animeTitle: title,
    coverImage: anime.coverImage.large || anime.coverImage.extraLarge,
    episodeNumber: episodeNum,
  });
}

export function getSubscribedAnimeIds(): number[] {
  const subscribedSet = new Set<number>();

  // 1. Explicitly subscribed IDs
  try {
    const raw = localStorage.getItem(SUBSCRIBED_ANIME_KEY);
    if (raw) {
      const parsed: number[] = JSON.parse(raw);
      parsed.forEach((id) => subscribedSet.add(id));
    }
  } catch {}

  // 2. Watchlist IDs
  const watchlist = getWatchlist();
  watchlist.forEach((w) => subscribedSet.add(w.anime.id));

  // 3. Favorited Anime IDs (if favoriteReleaseAlerts is opted in)
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
  localStorage.setItem(SUBSCRIBED_ANIME_KEY, JSON.stringify(result));
  return result;
}

export function toggleAnimeSubscription(animeId: number): boolean {
  const ids = getSubscribedAnimeIds();
  const index = ids.indexOf(animeId);
  let isSubscribed = false;
  if (index >= 0) {
    ids.splice(index, 1);
  } else {
    ids.push(animeId);
    isSubscribed = true;
  }
  localStorage.setItem(SUBSCRIBED_ANIME_KEY, JSON.stringify(ids));
  return isSubscribed;
}

// Registration notification helpers
export function notifyNewUserRegistration(username: string, email: string) {
  // Admin alert
  addNotification({
    title: `New User Registration: @${username}`,
    message: `Account created successfully. Email: ${email}. Status: Active.`,
    type: 'account',
  });
}

export function notifyWelcomeUser(displayName: string) {
  // User welcome alert
  addNotification({
    title: `Welcome to Yorumi, ${displayName}!`,
    message: 'Your account has been successfully created. Explore the anime catalogue and customize your notification preferences.',
    type: 'account',
  });
}

// Background checker for airing schedules & new releases
export async function checkAiringScheduleAndNotify(): Promise<void> {
  const prefs = getNotificationPreferences();
  if (!prefs.airingReminders && !prefs.airedAlerts) return;

  try {
    const query = `
      query {
        Page(page: 1, perPage: 25) {
          airingSchedules(notYetAired: true, sort: TIME_ASC) {
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

    const data = await aniListManager.request<any>(query);
    const schedules = data?.Page?.airingSchedules || [];
    const subscribedIds = getSubscribedAnimeIds();
    const existingNotifs = getNotifications();

    for (const sch of schedules) {
      const animeId = sch.media.id;
      if (!subscribedIds.includes(animeId)) continue;

      const title = sch.media.title.english || sch.media.title.romaji;
      const cover = sch.media.coverImage?.large;
      const timeUntil = sch.timeUntilAiring; // seconds

      // 30 min reminder (approx 1800s)
      if (prefs.airingReminders && timeUntil <= 1800 && timeUntil > 1200) {
        const notifId = `airing_30_${sch.id}`;
        if (!existingNotifs.some((n) => n.id === notifId)) {
          addNotification({
            title: `Upcoming Episode: ${title}`,
            message: `Episode ${sch.episode} starts airing in ~30 minutes. Get ready!`,
            type: 'airing',
            animeId,
            animeTitle: title,
            coverImage: cover,
            episodeNumber: sch.episode,
          });
        }
      }

      // 15 min reminder (approx 900s)
      if (prefs.airingReminders && timeUntil <= 900 && timeUntil > 300) {
        const notifId = `airing_15_${sch.id}`;
        if (!existingNotifs.some((n) => n.id === notifId)) {
          addNotification({
            title: `Starting Soon: ${title}`,
            message: `Episode ${sch.episode} airs in 15 minutes!`,
            type: 'airing',
            animeId,
            animeTitle: title,
            coverImage: cover,
            episodeNumber: sch.episode,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Airing notification check warning:', err);
  }
}
