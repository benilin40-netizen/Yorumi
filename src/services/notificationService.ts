import { Anime } from '../types/anime';
import { aniListManager } from './anilistManager';
import { getWatchlist } from './storage';

export interface NotificationPreference {
  airingReminders: boolean;
  airedAlerts: boolean;
  availableAlerts: boolean;
  newAnimeAlerts: boolean;
  announcements: boolean;
  reminderIntervalMinutes: number; // 10, 30
  pushEnabled: boolean;
  timezone: string;
}

export interface YorumiNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
  unread: boolean;
  type: 'airing' | 'aired' | 'available' | 'news' | 'system' | 'announcement';
  animeId?: number;
  animeTitle?: string;
  coverImage?: string;
  episodeNumber?: number;
  actionUrl?: string;
}

const NOTIFICATION_PREFS_KEY = 'yorumi_notification_prefs_v2';
const NOTIFICATIONS_KEY = 'yorumi_notifications_v2';
const SUBSCRIBED_ANIME_KEY = 'yorumi_subscribed_anime_ids';

const DEFAULT_PREFS: NotificationPreference = {
  airingReminders: true,
  airedAlerts: true,
  availableAlerts: true,
  newAnimeAlerts: true,
  announcements: true,
  reminderIntervalMinutes: 30,
  pushEnabled: false,
  timezone: 'Africa/Kampala',
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
  const trimmed = current.slice(0, 100);
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

export function getSubscribedAnimeIds(): number[] {
  try {
    const raw = localStorage.getItem(SUBSCRIBED_ANIME_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  // Default to watchlist anime IDs
  const watchlist = getWatchlist();
  const ids = watchlist.map((w) => w.anime.id);
  localStorage.setItem(SUBSCRIBED_ANIME_KEY, JSON.stringify(ids));
  return ids;
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

// Background scheduler / checker for airing schedule
export async function checkAiringScheduleAndNotify(): Promise<void> {
  const prefs = getNotificationPreferences();
  if (!prefs.airingReminders && !prefs.airedAlerts) return;

  try {
    const query = `
      query {
        Page(page: 1, perPage: 20) {
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
      // If user subscribed or has it in watchlist
      if (!subscribedIds.includes(animeId)) continue;

      const title = sch.media.title.english || sch.media.title.romaji;
      const cover = sch.media.coverImage?.large;
      const timeUntil = sch.timeUntilAiring; // seconds

      // 30 min reminder (approx 1800s)
      if (prefs.airingReminders && timeUntil <= 1800 && timeUntil > 1500) {
        const notifId = `airing_30_${sch.id}`;
        if (!existingNotifs.some((n) => n.id === notifId)) {
          addNotification({
            title: `Upcoming Airing: ${title}`,
            message: `Episode ${sch.episode} starts airing in ~30 minutes!`,
            type: 'airing',
            animeId,
            animeTitle: title,
            coverImage: cover,
            episodeNumber: sch.episode,
          });
        }
      }

      // 10 min reminder (approx 600s)
      if (prefs.airingReminders && timeUntil <= 600 && timeUntil > 300) {
        const notifId = `airing_10_${sch.id}`;
        if (!existingNotifs.some((n) => n.id === notifId)) {
          addNotification({
            title: `Starting Soon: ${title}`,
            message: `Episode ${sch.episode} airs in 10 minutes. Get ready!`,
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
