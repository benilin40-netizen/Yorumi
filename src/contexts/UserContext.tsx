import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import {
  Anime,
  AudioOption,
  WatchHistoryItem,
  WatchlistItem,
  WatchStatus,
  UserAccount,
  ProviderId,
  ProviderMode,
} from '../types/anime';
import type { WatchlistCategory } from '../types/supabase';
import {
  getWatchlist,
  saveWatchlistItem,
  removeFromWatchlist as removeStorageWatchlist,
  getFavorites,
  toggleFavorite as toggleStorageFavorite,
  getWatchHistory,
  recordWatchHistory,
  clearWatchHistory as clearStorageHistory,
  getUserAccounts,
  createUserAccount as createStorageUser,
  updateUserAccount as updateStorageUser,
  deleteUserAccount as deleteStorageUser,
  getCurrentUser,
  setCurrentUser as setStorageCurrentUser,
  GUEST_USER,
} from '../services/storage';
import {
  auth,
  testFirebaseConnection,
  signInWithGoogle,
  logoutFirebaseUser,
  syncUserProfile,
  fetchAllUsers,
  createFirestoreUserAccount,
  updateFirestoreUserAccount,
  deleteFirestoreUserAccount,
  saveWatchlistItemToFirestore,
  removeWatchlistItemFromFirestore,
  loadWatchlistFromFirestore,
  saveFavoriteToFirestore,
  removeFavoriteFromFirestore,
  loadFavoritesFromFirestore,
  saveHistoryToFirestore,
  loadHistoryFromFirestore,
} from '../services/firebase';
import {
  getStoredPreferredProvider,
  getStoredProviderMode,
  isValidProviderId,
  saveProviderPreference,
} from '../services/streaming/providerManager';
import {
  useAuth,
  readGuestWatchProgress,
  writeGuestWatchProgress,
} from './AuthContext';
import { supabase } from '../lib/supabase';

const PREFERRED_LANG_KEY = 'yorumi_preferred_lang';

function getStoredPreferredLang(): AudioOption {
  try {
    return localStorage.getItem(PREFERRED_LANG_KEY) === 'dub' ? 'dub' : 'sub';
  } catch {
    return 'sub';
  }
}

function saveStoredPreferredLang(lang: AudioOption): void {
  try {
    localStorage.setItem(PREFERRED_LANG_KEY, lang);
  } catch {
    // ignore
  }
}

export function toSupabaseWatchlistStatus(status: WatchStatus): WatchlistCategory {
  switch (status) {
    case 'WATCHING':
      return 'watching';
    case 'COMPLETED':
      return 'completed';
    case 'FAVORITE':
      return 'favorite';
    case 'PLANNING':
    case 'DROPPED':
    default:
      return 'plan';
  }
}

export function fromSupabaseWatchlistStatus(cat?: string | null): WatchStatus {
  switch ((cat || '').toLowerCase()) {
    case 'watching':
      return 'WATCHING';
    case 'completed':
      return 'COMPLETED';
    case 'favorite':
      return 'FAVORITE';
    case 'plan':
    default:
      return 'PLANNING';
  }
}

function makePlaceholderAnime(
  anilistId: number,
  title?: string | null,
  coverImage?: string | null,
  format?: string | null
): Anime {
  return {
    id: anilistId,
    idMal: null,
    title: {
      english: title || `Anime #${anilistId}`,
      romaji: title || `Anime #${anilistId}`,
      native: null,
    },
    coverImage: {
      extraLarge: coverImage || '',
      large: coverImage || '',
      medium: coverImage || '',
      color: null,
    },
    bannerImage: null,
    description: null,
    genres: [],
    averageScore: null,
    popularity: null,
    season: null,
    seasonYear: null,
    episodes: null,
    duration: null,
    status: 'RELEASING',
    format: format || 'TV',
  };
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: 'airing' | 'news' | 'system';
}

export interface SupabaseToastState {
  message: string;
  retry?: () => void;
}

interface UserContextType {
  watchlist: WatchlistItem[];
  favorites: Anime[];
  history: WatchHistoryItem[];
  continueWatching: WatchHistoryItem[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  currentUser: UserAccount;
  userAccounts: UserAccount[];
  firebaseUser: FirebaseUser | null;
  isFirebaseLoading: boolean;
  firebaseConnected: boolean;
  preferredProvider: ProviderId;
  providerMode: ProviderMode;
  preferredLang: AudioOption;
  setProviderPreference: (mode: ProviderMode, providerId: ProviderId) => void;
  setPreferredLang: (lang: AudioOption) => void;
  adminAuthenticated: boolean;
  refreshAdminSession: () => Promise<boolean>;
  logoutAdminSession: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOutGoogle: () => Promise<void>;
  updateWatchlist: (anime: Anime, status: WatchStatus, score?: number | null, episode?: number) => void;
  removeFromWatchlist: (animeId: number) => void;
  toggleFavorite: (anime: Anime) => boolean;
  isFavorite: (animeId: number) => boolean;
  getWatchlistItem: (animeId: number) => WatchlistItem | undefined;
  addHistoryRecord: (anime: Anime, episode: number, progressSeconds?: number) => void;
  saveWatchProgress: (params: {
    anime: Anime;
    episode: number;
    positionSeconds: number;
    durationSeconds?: number;
  }) => Promise<void>;
  getResumePosition: (animeId: number, episode: number) => number;
  clearHistory: () => void;
  markNotificationsRead: () => void;
  refreshNotifications: () => void;
  isEmailVerified: boolean;
  sendVerificationEmailAction: () => Promise<void>;
  refreshVerificationStatusAction: () => Promise<boolean>;
  updateMyProfile: (updates: Partial<UserAccount>) => Promise<void>;
  createUser: (data: Omit<UserAccount, 'id' | 'createdAt'>) => Promise<UserAccount>;
  updateUser: (id: string, updates: Partial<UserAccount>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  switchUser: (id: string) => void;
  supabaseToast: SupabaseToastState | null;
  dismissSupabaseToast: () => void;
  refreshSupabaseUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user: supabaseUser,
    session: supabaseSession,
    profile: supabaseProfile,
    isAdmin: supabaseIsAdmin,
    updateProfilePreferences,
  } = useAuth();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchHistoryItem[]>([]);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUserState] = useState<UserAccount>(() => getCurrentUser());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState<boolean>(true);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);

  const [preferredProvider, setPreferredProvider] = useState<ProviderId>(() =>
    getStoredPreferredProvider()
  );
  const [providerMode, setProviderMode] = useState<ProviderMode>(() =>
    getStoredProviderMode()
  );
  const [preferredLang, setPreferredLangState] = useState<AudioOption>(() =>
    getStoredPreferredLang()
  );
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(false);
  const [supabaseToast, setSupabaseToast] = useState<SupabaseToastState | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'Airing Schedule Synced',
      message: 'Live episode countdowns and release times update in your local timezone.',
      time: 'Live',
      unread: true,
      type: 'airing',
    },
    {
      id: '2',
      title: 'Multi-Provider Auto Failover',
      message: 'Yenime, AniEmbed, and Kuroko streaming engines are ready with automatic failover.',
      time: 'Active',
      unread: false,
      type: 'system',
    },
  ]);

  const dismissSupabaseToast = useCallback(() => setSupabaseToast(null), []);

  const refreshAdminSession = useCallback(async (): Promise<boolean> => {
    try {
      const headers: Record<string, string> = {};
      if (supabaseSession?.access_token) {
        headers.Authorization = `Bearer ${supabaseSession.access_token}`;
      }
      const res = await fetch('/api/admin/session', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        setAdminAuthenticated(Boolean(supabaseIsAdmin));
        return Boolean(supabaseIsAdmin);
      }
      const data = await res.json();
      const authed = Boolean(data?.authenticated) || Boolean(supabaseIsAdmin);
      setAdminAuthenticated(authed);
      return authed;
    } catch {
      setAdminAuthenticated(Boolean(supabaseIsAdmin));
      return Boolean(supabaseIsAdmin);
    }
  }, [supabaseSession?.access_token, supabaseIsAdmin]);

  const logoutAdminSession = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } catch {
      // ignore
    }
    setAdminAuthenticated(Boolean(supabaseIsAdmin));
  }, [supabaseIsAdmin]);

  const hydrateGuestContinueWatching = useCallback(() => {
    const guest = readGuestWatchProgress().map<WatchHistoryItem>((g) => ({
      animeId: g.anilist_id,
      idMal: null,
      animeTitle: g.anime_title || `Anime #${g.anilist_id}`,
      coverImage: g.cover_image || '',
      bannerImage: g.banner_image || null,
      episode: g.episode_number,
      progressSeconds: g.position_seconds,
      totalDurationSeconds: g.duration_seconds || 1440,
      timestamp: g.updated_at ? Date.parse(g.updated_at) || Date.now() : Date.now(),
    }));

    const localHist = getWatchHistory();
    const map = new Map<number, WatchHistoryItem>();
    for (const item of [...guest, ...localHist]) {
      const existing = map.get(item.animeId);
      if (!existing || item.timestamp > existing.timestamp) {
        map.set(item.animeId, item);
      }
    }
    setContinueWatching(Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  const refreshSupabaseUserData = useCallback(async () => {
    if (!supabaseUser || !supabaseSession?.access_token) {
      hydrateGuestContinueWatching();
      return;
    }

    try {
      let progressRows: any[] = [];
      let watchlistRows: any[] = [];

      if (supabase) {
        const [progRes, wlRes] = await Promise.all([
          supabase
            .from('watch_progress')
            .select('*')
            .eq('user_id', supabaseUser.id)
            .order('updated_at', { ascending: false })
            .limit(50),
          supabase
            .from('watchlist')
            .select('*')
            .eq('user_id', supabaseUser.id)
            .order('updated_at', { ascending: false }),
        ]);

        if (progRes.error && wlRes.error) {
          throw new Error(progRes.error.message || wlRes.error.message);
        }
        progressRows = progRes.data || [];
        watchlistRows = wlRes.data || [];
      } else {
        const [progApi, wlApi] = await Promise.all([
          fetch('/api/user/progress', {
            headers: { Authorization: `Bearer ${supabaseSession.access_token}` },
          }),
          fetch('/api/user/watchlist', {
            headers: { Authorization: `Bearer ${supabaseSession.access_token}` },
          }),
        ]);
        if (progApi.ok) {
          const pj = await progApi.json();
          progressRows = pj.items || [];
        }
        if (wlApi.ok) {
          const wj = await wlApi.json();
          watchlistRows = wj.items || [];
        }
      }

      const mappedProgress: WatchHistoryItem[] = progressRows.map((r) => ({
        animeId: r.anilist_id,
        idMal: null,
        animeTitle: r.anime_title || `Anime #${r.anilist_id}`,
        coverImage: r.cover_image || '',
        bannerImage: r.banner_image || null,
        episode: r.episode_number,
        progressSeconds: r.position_seconds || 0,
        totalDurationSeconds: r.duration_seconds || 1440,
        timestamp: r.updated_at ? Date.parse(r.updated_at) || Date.now() : Date.now(),
      }));

      setContinueWatching(mappedProgress);
      if (mappedProgress.length > 0) {
        setHistory(mappedProgress);
      }

      if (watchlistRows.length > 0) {
        const existingLocalMap = new Map(getWatchlist().map((w) => [w.anime.id, w.anime]));
        const mappedWatchlist: WatchlistItem[] = watchlistRows.map((r) => {
          const existingAnime = existingLocalMap.get(r.anilist_id);
          const anime =
            existingAnime ||
            makePlaceholderAnime(r.anilist_id, r.anime_title, r.cover_image, r.format);
          return {
            anime,
            status: fromSupabaseWatchlistStatus(r.status),
            isFavorite: Boolean(r.is_favorite || r.status === 'favorite'),
            userScore: r.score ?? null,
            lastWatchedEpisode: r.last_watched_episode || 1,
            updatedAt: r.updated_at ? Date.parse(r.updated_at) || Date.now() : Date.now(),
          };
        });
        setWatchlist(mappedWatchlist);

        const favs = mappedWatchlist
          .filter((w) => w.isFavorite || w.status === 'FAVORITE')
          .map((w) => w.anime);
        setFavorites(favs);
      }
      setSupabaseToast(null);
    } catch (err: any) {
      setSupabaseToast({
        message: err?.message || 'Unable to sync your Supabase account data.',
        retry: () => {
          refreshSupabaseUserData();
        },
      });
      hydrateGuestContinueWatching();
    }
  }, [supabaseUser, supabaseSession?.access_token, hydrateGuestContinueWatching]);

  // Apply Supabase profile preferences when loaded
  useEffect(() => {
    if (!supabaseProfile) return;
    if (supabaseProfile.preferred_provider && isValidProviderId(supabaseProfile.preferred_provider)) {
      setPreferredProvider(supabaseProfile.preferred_provider);
      saveProviderPreference(providerMode, supabaseProfile.preferred_provider);
    }
    if (supabaseProfile.preferred_lang === 'sub' || supabaseProfile.preferred_lang === 'dub') {
      setPreferredLangState(supabaseProfile.preferred_lang);
      saveStoredPreferredLang(supabaseProfile.preferred_lang);
    }
  }, [supabaseProfile, providerMode]);

  useEffect(() => {
    refreshAdminSession();
  }, [refreshAdminSession]);

  useEffect(() => {
    refreshSupabaseUserData();
  }, [refreshSupabaseUserData]);

  useEffect(() => {
    setWatchlist(getWatchlist());
    setFavorites(getFavorites());
    setHistory(getWatchHistory());
    setUserAccounts(getUserAccounts());
    hydrateGuestContinueWatching();

    testFirebaseConnection().then((connected) => {
      setFirebaseConnected(connected);
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsFirebaseLoading(true);
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const profile = await syncUserProfile(fbUser);
          setCurrentUserState(profile);

          if (profile.preferredProvider && isValidProviderId(profile.preferredProvider)) {
            const mode: ProviderMode = profile.providerMode === 'manual' ? 'manual' : 'auto';
            setPreferredProvider(profile.preferredProvider);
            setProviderMode(mode);
            saveProviderPreference(mode, profile.preferredProvider);
          }

          const [cloudWatchlist, cloudFavorites, cloudHistory] = await Promise.allSettled([
            loadWatchlistFromFirestore(fbUser.uid),
            loadFavoritesFromFirestore(fbUser.uid),
            loadHistoryFromFirestore(fbUser.uid),
          ]);

          if (cloudWatchlist.status === 'fulfilled' && cloudWatchlist.value.length > 0) {
            setWatchlist(cloudWatchlist.value);
          }
          if (cloudFavorites.status === 'fulfilled' && cloudFavorites.value.length > 0) {
            setFavorites(cloudFavorites.value);
          }
          if (cloudHistory.status === 'fulfilled' && cloudHistory.value.length > 0) {
            setHistory(cloudHistory.value);
          }

          try {
            const allUsers = await fetchAllUsers();
            if (allUsers.length > 0) {
              setUserAccounts(allUsers);
            } else {
              setUserAccounts([profile]);
            }
          } catch {
            setUserAccounts([profile]);
          }
        } catch (err) {
          console.error('Failed to sync Firestore profile:', err);
        }
      } else {
        setFirebaseUser(null);
        const localAccounts = getUserAccounts();
        setUserAccounts(localAccounts);
        setCurrentUserState(localAccounts[0] || GUEST_USER);
      }
      setIsFirebaseLoading(false);
    });

    return () => unsubscribe();
  }, [hydrateGuestContinueWatching]);

  const setProviderPreference = useCallback(
    (mode: ProviderMode, providerId: ProviderId) => {
      setProviderMode(mode);
      setPreferredProvider(providerId);
      saveProviderPreference(mode, providerId);

      if (supabaseUser) {
        updateProfilePreferences({ preferred_provider: providerId }).catch(() => {});
      }

      if (firebaseUser) {
        updateFirestoreUserAccount(firebaseUser.uid, {
          providerMode: mode,
          preferredProvider: providerId,
        }).catch(() => {});
      }
    },
    [firebaseUser, supabaseUser, updateProfilePreferences]
  );

  const setPreferredLang = useCallback(
    (lang: AudioOption) => {
      setPreferredLangState(lang);
      saveStoredPreferredLang(lang);
      if (supabaseUser) {
        updateProfilePreferences({ preferred_lang: lang }).catch(() => {});
      }
    },
    [supabaseUser, updateProfilePreferences]
  );

  const signInGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in error:', err);
    }
  };

  const signOutGoogle = async () => {
    try {
      await logoutFirebaseUser();
      setCurrentUserState(GUEST_USER);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const persistWatchlistToSupabase = useCallback(
    async (anime: Anime, status: WatchStatus, episode: number, score: number | null, isFav?: boolean) => {
      if (!supabaseUser) return;
      const mappedStatus = toSupabaseWatchlistStatus(status);
      const favFlag = isFav ?? (status === 'FAVORITE');
      const title = anime.title.english || anime.title.romaji;
      const cover = anime.coverImage.extraLarge || anime.coverImage.large || null;

      try {
        if (supabase) {
          const { error } = await supabase.from('watchlist').upsert(
            {
              user_id: supabaseUser.id,
              anilist_id: anime.id,
              status: mappedStatus,
              is_favorite: favFlag,
              score: score ?? null,
              last_watched_episode: episode || 1,
              anime_title: title,
              cover_image: cover,
              format: anime.format || 'TV',
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: 'user_id,anilist_id' }
          );
          if (!error) return;
        }
        if (supabaseSession?.access_token) {
          const res = await fetch('/api/user/watchlist', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseSession.access_token}`,
            },
            body: JSON.stringify({
              anilist_id: anime.id,
              status: mappedStatus,
              is_favorite: favFlag,
              last_watched_episode: episode || 1,
              anime_title: title,
              cover_image: cover,
              format: anime.format || 'TV',
            }),
          });
          if (!res.ok) throw new Error('Failed saving watchlist item');
        }
      } catch (err: any) {
        setSupabaseToast({
          message: err?.message || 'Could not sync watchlist change to Supabase.',
          retry: () => {
            persistWatchlistToSupabase(anime, status, episode, score, isFav);
          },
        });
      }
    },
    [supabaseUser, supabaseSession?.access_token]
  );

  const updateWatchlist = (
    anime: Anime,
    status: WatchStatus,
    score: number | null = null,
    episode: number = 1
  ) => {
    const updated = saveWatchlistItem(anime, status, score, episode);
    setWatchlist([...updated]);

    if (status === 'FAVORITE' && !favorites.some((f) => f.id === anime.id)) {
      const favRes = toggleStorageFavorite(anime);
      setFavorites([...favRes.favorites]);
    }

    persistWatchlistToSupabase(
      anime,
      status,
      episode,
      score,
      status === 'FAVORITE' || favorites.some((f) => f.id === anime.id)
    );

    if (firebaseUser) {
      const item = updated.find((w) => w.anime.id === anime.id);
      if (item) {
        saveWatchlistItemToFirestore(firebaseUser.uid, item).catch((err) =>
          console.warn('Firestore watchlist sync warning:', err)
        );
      }
    }
  };

  const removeFromWatchlist = (animeId: number) => {
    const updated = removeStorageWatchlist(animeId);
    setWatchlist([...updated]);

    if (supabaseUser) {
      (async () => {
        try {
          if (supabase) {
            const { error } = await supabase
              .from('watchlist')
              .delete()
              .eq('user_id', supabaseUser.id)
              .eq('anilist_id', animeId);
            if (!error) return;
          }
          if (supabaseSession?.access_token) {
            const res = await fetch(`/api/user/watchlist/${animeId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${supabaseSession.access_token}` },
            });
            if (!res.ok) throw new Error('Failed removing watchlist item');
          }
        } catch (err: any) {
          setSupabaseToast({
            message: err?.message || 'Failed removing title from My List.',
            retry: () => removeFromWatchlist(animeId),
          });
        }
      })();
    }

    if (firebaseUser) {
      removeWatchlistItemFromFirestore(firebaseUser.uid, animeId).catch((err) =>
        console.warn('Firestore watchlist remove warning:', err)
      );
    }
  };

  const toggleFavorite = (anime: Anime): boolean => {
    const { favorites: updated, isFavorite: fav } = toggleStorageFavorite(anime);
    setFavorites([...updated]);

    if (fav) {
      const existing = getWatchlistItem(anime.id);
      const nextStatus: WatchStatus = existing?.status || 'FAVORITE';
      const nextList = saveWatchlistItem(anime, nextStatus, existing?.userScore ?? null, existing?.lastWatchedEpisode ?? 1);
      setWatchlist([...nextList]);
      persistWatchlistToSupabase(anime, nextStatus, existing?.lastWatchedEpisode ?? 1, existing?.userScore ?? null, true);
    } else {
      const existing = getWatchlistItem(anime.id);
      if (existing && existing.status === 'FAVORITE') {
        removeFromWatchlist(anime.id);
      } else if (existing) {
        persistWatchlistToSupabase(anime, existing.status, existing.lastWatchedEpisode, existing.userScore, false);
      }
    }

    if (firebaseUser) {
      if (fav) {
        saveFavoriteToFirestore(firebaseUser.uid, anime).catch(console.warn);
      } else {
        removeFavoriteFromFirestore(firebaseUser.uid, anime.id).catch(console.warn);
      }
    }

    return fav;
  };

  const isFavorite = (animeId: number): boolean => {
    return favorites.some((item) => item.id === animeId);
  };

  const getWatchlistItem = (animeId: number): WatchlistItem | undefined => {
    return watchlist.find((item) => item.anime.id === animeId);
  };

  const saveWatchProgress = useCallback(
    async (params: {
      anime: Anime;
      episode: number;
      positionSeconds: number;
      durationSeconds?: number;
    }) => {
      const { anime, episode, positionSeconds, durationSeconds = (anime.duration || 24) * 60 } = params;
      const safePos = Math.max(0, Math.floor(positionSeconds));
      const safeDur = Math.max(60, Math.floor(durationSeconds));
      const title = anime.title.english || anime.title.romaji;
      const cover = anime.coverImage.extraLarge || anime.coverImage.large;

      const updatedLocal = recordWatchHistory({
        anime,
        episode,
        progressSeconds: safePos,
        totalDurationSeconds: safeDur,
      });
      setHistory([...updatedLocal]);

      if (!supabaseUser) {
        writeGuestWatchProgress({
          anilist_id: anime.id,
          episode_number: episode,
          position_seconds: safePos,
          duration_seconds: safeDur,
          anime_title: title,
          cover_image: cover,
          banner_image: anime.bannerImage,
          updated_at: new Date().toISOString(),
        });
      }

      setContinueWatching((prev) => {
        const nextItem: WatchHistoryItem = {
          animeId: anime.id,
          idMal: anime.idMal,
          animeTitle: title,
          coverImage: cover,
          bannerImage: anime.bannerImage,
          episode,
          progressSeconds: safePos,
          totalDurationSeconds: safeDur,
          timestamp: Date.now(),
        };
        const filtered = prev.filter((item) => item.animeId !== anime.id);
        return [nextItem, ...filtered].slice(0, 50);
      });

      if (supabaseUser) {
        try {
          if (supabase) {
            const { error } = await supabase.from('watch_progress').upsert(
              {
                user_id: supabaseUser.id,
                anilist_id: anime.id,
                episode_number: episode,
                position_seconds: safePos,
                duration_seconds: safeDur,
                anime_title: title,
                cover_image: cover,
                banner_image: anime.bannerImage,
                updated_at: new Date().toISOString(),
              } as any,
              { onConflict: 'user_id,anilist_id,episode_number' }
            );
            if (!error) return;
          }
          if (supabaseSession?.access_token) {
            const res = await fetch('/api/user/progress', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseSession.access_token}`,
              },
              body: JSON.stringify({
                anilist_id: anime.id,
                episode_number: episode,
                position_seconds: safePos,
                duration_seconds: safeDur,
                anime_title: title,
                cover_image: cover,
                banner_image: anime.bannerImage,
              }),
            });
            if (!res.ok) throw new Error('Failed saving watch progress');
          }
        } catch (err: any) {
          setSupabaseToast({
            message: err?.message || 'Failed saving watch progress to Supabase.',
            retry: () => {
              saveWatchProgress(params);
            },
          });
        }
      }
    },
    [supabaseUser, supabaseSession?.access_token]
  );

  const getResumePosition = useCallback(
    (animeId: number, episode: number): number => {
      const match = continueWatching.find(
        (item) => item.animeId === animeId && item.episode === episode
      );
      if (match && match.progressSeconds > 5) {
        return match.progressSeconds;
      }
      const histMatch = history.find(
        (item) => item.animeId === animeId && item.episode === episode
      );
      if (histMatch && histMatch.progressSeconds > 5) {
        return histMatch.progressSeconds;
      }
      return 0;
    },
    [continueWatching, history]
  );

  const addHistoryRecord = (anime: Anime, episode: number, progressSeconds = 0) => {
    saveWatchProgress({
      anime,
      episode,
      positionSeconds: progressSeconds,
      durationSeconds: (anime.duration || 24) * 60,
    });

    if (firebaseUser) {
      const item: WatchHistoryItem = {
        animeId: anime.id,
        idMal: anime.idMal,
        animeTitle: anime.title.english || anime.title.romaji,
        coverImage: anime.coverImage.extraLarge || anime.coverImage.large,
        bannerImage: anime.bannerImage,
        episode,
        progressSeconds,
        totalDurationSeconds: (anime.duration || 24) * 60,
        timestamp: Date.now(),
      };
      saveHistoryToFirestore(firebaseUser.uid, item).catch(console.warn);
    }
  };

  const clearHistory = () => {
    clearStorageHistory();
    setHistory([]);
    if (!supabaseUser) {
      setContinueWatching([]);
    }
  };

  const markNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const refreshNotifications = useCallback(() => {
    setNotifications((prev) => [...prev]);
  }, []);

  const isEmailVerified = Boolean(supabaseUser?.email_confirmed_at || firebaseUser?.emailVerified);

  const sendVerificationEmailAction = useCallback(async () => {
    // Email verification is managed by Supabase Auth on sign up
  }, []);

  const refreshVerificationStatusAction = useCallback(async (): Promise<boolean> => {
    return Boolean(supabaseUser?.email_confirmed_at || firebaseUser?.emailVerified);
  }, [supabaseUser?.email_confirmed_at, firebaseUser?.emailVerified]);

  const createUser = async (data: Omit<UserAccount, 'id' | 'createdAt'>): Promise<UserAccount> => {
    let created: UserAccount;
    try {
      created = await createFirestoreUserAccount(data);
      setUserAccounts((prev) => [created, ...prev.filter((u) => u.id !== created.id)]);
    } catch {
      created = createStorageUser(data);
      setUserAccounts(getUserAccounts());
    }
    return created;
  };

  const updateUser = async (id: string, updates: Partial<UserAccount>): Promise<void> => {
    try {
      await updateFirestoreUserAccount(id, updates);
    } catch (err) {
      console.warn('Firestore user update fallback to storage:', err);
    }
    const updatedList = updateStorageUser(id, updates);
    setUserAccounts([...updatedList]);
    if (currentUser.id === id) {
      setCurrentUserState((prev) => ({ ...prev, ...updates }));
    }
  };

  const updateMyProfile = useCallback(
    async (updates: Partial<UserAccount>) => {
      await updateUser(currentUser.id, updates);
    },
    [currentUser.id]
  );

  const deleteUser = async (id: string): Promise<void> => {
    try {
      await deleteFirestoreUserAccount(id);
    } catch (err) {
      console.warn('Firestore user delete fallback to storage:', err);
    }
    const remaining = deleteStorageUser(id);
    setUserAccounts([...remaining]);
    if (currentUser.id === id) {
      const fallback = remaining[0] || GUEST_USER;
      setStorageCurrentUser(fallback.id);
      setCurrentUserState(fallback);
    }
  };

  const switchUser = (id: string) => {
    const user = setStorageCurrentUser(id);
    setCurrentUserState(user);
  };

  const unreadNotificationCount = notifications.filter((n) => n.unread).length;

  return (
    <UserContext.Provider
      value={{
        watchlist,
        favorites,
        history,
        continueWatching,
        notifications,
        unreadNotificationCount,
        currentUser,
        userAccounts,
        firebaseUser,
        isFirebaseLoading,
        firebaseConnected,
        preferredProvider,
        providerMode,
        preferredLang,
        setProviderPreference,
        setPreferredLang,
        adminAuthenticated: adminAuthenticated || supabaseIsAdmin,
        refreshAdminSession,
        logoutAdminSession,
        signInGoogle,
        signOutGoogle,
        updateWatchlist,
        removeFromWatchlist,
        toggleFavorite,
        isFavorite,
        getWatchlistItem,
        addHistoryRecord,
        saveWatchProgress,
        getResumePosition,
        clearHistory,
        markNotificationsRead,
        refreshNotifications,
        isEmailVerified,
        sendVerificationEmailAction,
        refreshVerificationStatusAction,
        updateMyProfile,
        createUser,
        updateUser,
        deleteUser,
        switchUser,
        supabaseToast,
        dismissSupabaseToast,
        refreshSupabaseUserData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
