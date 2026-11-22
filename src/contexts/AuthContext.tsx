import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ProfileRow } from '../types/supabase';
import type { AudioOption, ProviderId } from '../types/anime';

export interface LocalWatchProgressEntry {
  anilist_id: number;
  episode_number: number;
  position_seconds: number;
  duration_seconds: number;
  anime_title?: string;
  cover_image?: string;
  banner_image?: string | null;
  updated_at?: string;
}

const GUEST_PROGRESS_STORAGE_KEY = 'yorumi_guest_watch_progress';

export function readGuestWatchProgress(): LocalWatchProgressEntry[] {
  try {
    const raw = localStorage.getItem(GUEST_PROGRESS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeGuestWatchProgress(entry: LocalWatchProgressEntry): LocalWatchProgressEntry[] {
  const list = readGuestWatchProgress().filter(
    (item) =>
      !(item.anilist_id === entry.anilist_id && item.episode_number === entry.episode_number)
  );
  list.unshift({ ...entry, updated_at: entry.updated_at || new Date().toISOString() });
  const trimmed = list.slice(0, 50);
  try {
    localStorage.setItem(GUEST_PROGRESS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
  return trimmed;
}

export function clearGuestWatchProgress(): void {
  try {
    localStorage.removeItem(GUEST_PROGRESS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: ProfileRow | null;
  isAdmin: boolean;
  loading: boolean;
  supabaseConfigured: boolean;
  authModalOpen: boolean;
  authModalMode: 'signin' | 'signup';
  supabaseError: string | null;
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  closeAuthModal: () => void;
  clearSupabaseError: () => void;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    username?: string
  ) => Promise<{ ok: boolean; needsConfirmation?: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  refreshAuthMe: (overrideToken?: string) => Promise<void>;
  updateProfilePreferences: (updates: {
    preferred_provider?: ProviderId;
    preferred_lang?: AudioOption;
  }) => Promise<void>;
  trackEvent: (
    eventName: string,
    data?: {
      anilist_id?: number;
      episode_number?: number;
      provider_id?: string;
      metadata?: Record<string, any>;
    }
  ) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const fetchAuthMe = useCallback(async (accessToken?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetch('/api/auth/me', { headers });
      if (!res.ok) return;
      const data = await res.json();
      setIsAdmin(Boolean(data?.isAdmin));
      if (data?.profile) {
        setProfile(data.profile);
      }
    } catch {
      // Non-fatal fallback
    }
  }, []);

  const fetchProfileDirect = useCallback(async (userId: string): Promise<ProfileRow | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, preferred_provider, preferred_lang, is_admin, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        return null;
      }
      if (data) {
        setProfile(data as ProfileRow);
        setIsAdmin(Boolean(data.is_admin));
        return data as ProfileRow;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const mergeGuestProgressIntoAccount = useCallback(
    async (userId: string, accessToken?: string) => {
      const guestItems = readGuestWatchProgress();
      if (guestItems.length === 0) return;

      try {
        if (supabase) {
          const rows = guestItems.map((item) => ({
            user_id: userId,
            anilist_id: item.anilist_id,
            episode_number: item.episode_number,
            position_seconds: item.position_seconds,
            duration_seconds: item.duration_seconds,
            anime_title: item.anime_title || null,
            cover_image: item.cover_image || null,
            banner_image: item.banner_image || null,
            updated_at: item.updated_at || new Date().toISOString(),
          }));
          const { error } = await supabase
            .from('watch_progress')
            .upsert(rows as any, { onConflict: 'user_id,anilist_id,episode_number' });
          if (!error) {
            clearGuestWatchProgress();
            return;
          }
        }

        if (accessToken) {
          const res = await fetch('/api/user/progress/merge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ items: guestItems }),
          });
          if (res.ok) {
            clearGuestWatchProgress();
          }
        }
      } catch {
        // Keep guest progress intact to retry later
      }
    },
    []
  );

  const hydrateSession = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await Promise.allSettled([
          fetchProfileDirect(nextSession.user.id),
          fetchAuthMe(nextSession.access_token),
          mergeGuestProgressIntoAccount(nextSession.user.id, nextSession.access_token),
        ]);
      } else {
        setProfile(null);
        setIsAdmin(false);
        await fetchAuthMe();
      }
    },
    [fetchAuthMe, fetchProfileDirect, mergeGuestProgressIntoAccount]
  );

  useEffect(() => {
    let active = true;

    async function init() {
      if (!supabase) {
        await fetchAuthMe();
        if (active) setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setSupabaseError(error.message);
        }
        if (active) {
          await hydrateSession(data?.session ?? null);
        }
      } catch (err: any) {
        if (active) setSupabaseError(err?.message || 'Failed to restore session');
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      hydrateSession(nextSession).catch(() => {});
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchAuthMe, hydrateSession]);

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!supabase) {
      return { ok: false, error: 'Supabase client is not configured.' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    if (data.session) {
      await hydrateSession(data.session);
    }
    setAuthModalOpen(false);
    return { ok: true };
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    username?: string
  ): Promise<{ ok: boolean; needsConfirmation?: boolean; error?: string; message?: string }> => {
    if (!supabase) {
      return { ok: false, error: 'Supabase client is not configured.' };
    }
    const cleanUsername =
      username?.trim() ||
      email
        .trim()
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 24) ||
      'viewer';

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: cleanUsername,
        },
      },
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    if (data.session) {
      await hydrateSession(data.session);
      setAuthModalOpen(false);
      return { ok: true, needsConfirmation: false };
    }
    return {
      ok: true,
      needsConfirmation: true,
      message: 'Account created! Please check your email inbox to confirm your account before signing in.',
    };
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSupabaseError(error.message);
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const updateProfilePreferences = useCallback(
    async (updates: { preferred_provider?: ProviderId; preferred_lang?: AudioOption }) => {
      if (!user || !session) return;

      setProfile((prev) =>
        prev
          ? { ...prev, ...updates }
          : {
              id: user.id,
              username: user.email?.split('@')[0] || 'viewer',
              preferred_provider: updates.preferred_provider ?? 'yenime',
              preferred_lang: updates.preferred_lang ?? 'sub',
              is_admin: isAdmin,
            }
      );

      try {
        if (supabase) {
          const { error } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() } as any)
            .eq('id', user.id);
          if (!error) return;
        }
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          throw new Error('Failed saving preferences to profile');
        }
      } catch (err: any) {
        setSupabaseError(err?.message || 'Unable to sync profile preferences');
      }
    },
    [user, session, isAdmin]
  );

  const trackEvent = useCallback(
    (
      eventName: string,
      data?: {
        anilist_id?: number;
        episode_number?: number;
        provider_id?: string;
        metadata?: Record<string, any>;
      }
    ) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        fetch('/api/analytics/track', {
          method: 'POST',
          headers,
          body: JSON.stringify({ event_name: eventName, ...data }),
        }).catch(() => {});
      } catch {
        // analytics must never throw
      }
    },
    [session?.access_token]
  );

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);
  const clearSupabaseError = () => setSupabaseError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        supabaseConfigured: isSupabaseConfigured,
        authModalOpen,
        authModalMode,
        supabaseError,
        openAuthModal,
        closeAuthModal,
        clearSupabaseError,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshAuthMe: fetchAuthMe,
        updateProfilePreferences,
        trackEvent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
