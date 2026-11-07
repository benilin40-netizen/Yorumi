import { Anime, WatchHistoryItem, WatchlistItem, WatchStatus, UserAccount } from '../types/anime';

const WATCHLIST_KEY = 'yorumi_user_watchlist';
const FAVORITES_KEY = 'yorumi_user_favorites';
const HISTORY_KEY = 'yorumi_user_history';
const ACCOUNTS_KEY = 'yorumi_user_accounts';
const CURRENT_USER_KEY = 'yorumi_current_user_id';

export function getWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse watchlist:', err);
    return [];
  }
}

export function saveWatchlistItem(anime: Anime, status: WatchStatus, userScore: number | null = null, episode: number = 1): WatchlistItem[] {
  const current = getWatchlist();
  const existingIdx = current.findIndex((item) => item.anime.id === anime.id);

  const updatedItem: WatchlistItem = {
    anime,
    status,
    userScore: userScore !== null ? userScore : existingIdx >= 0 ? current[existingIdx].userScore : null,
    lastWatchedEpisode: episode,
    updatedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    current[existingIdx] = updatedItem;
  } else {
    current.unshift(updatedItem);
  }

  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(current));
  return current;
}

export function removeFromWatchlist(animeId: number): WatchlistItem[] {
  const current = getWatchlist().filter((item) => item.anime.id !== animeId);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(current));
  return current;
}

export function getFavorites(): Anime[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse favorites:', err);
    return [];
  }
}

export function toggleFavorite(anime: Anime): { favorites: Anime[]; isFavorite: boolean } {
  const current = getFavorites();
  const exists = current.some((item) => item.id === anime.id);
  let updated: Anime[];

  if (exists) {
    updated = current.filter((item) => item.id !== anime.id);
  } else {
    updated = [anime, ...current];
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  return { favorites: updated, isFavorite: !exists };
}

export function getWatchHistory(): WatchHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse watch history:', err);
    return [];
  }
}

export function recordWatchHistory(params: {
  anime: Anime;
  episode: number;
  progressSeconds?: number;
  totalDurationSeconds?: number;
}): WatchHistoryItem[] {
  const { anime, episode, progressSeconds = 0, totalDurationSeconds = 1440 } = params;
  const current = getWatchHistory();

  const existingIdx = current.findIndex((item) => item.animeId === anime.id);
  
  const newItem: WatchHistoryItem = {
    animeId: anime.id,
    idMal: anime.idMal,
    animeTitle: anime.title.english || anime.title.romaji,
    coverImage: anime.coverImage.extraLarge || anime.coverImage.large,
    bannerImage: anime.bannerImage,
    episode,
    progressSeconds,
    totalDurationSeconds,
    timestamp: Date.now(),
  };

  if (existingIdx >= 0) {
    current.splice(existingIdx, 1);
  }

  current.unshift(newItem);
  const trimmed = current.slice(0, 50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function clearWatchHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

// User Accounts Storage Management - Demo accounts removed
export const GUEST_USER: UserAccount = {
  id: 'guest',
  username: 'guest',
  displayName: 'Guest Viewer',
  email: '',
  role: 'member',
  status: 'active',
  bio: 'Sign in to access synchronized watchlist and premium controls',
  createdAt: 0,
  watchlistCount: 0,
};

const DEMO_ACCOUNT_IDS = new Set(['user-admin-1', 'user-mod-2', 'user-vip-3', 'user-mem-4']);

export function getUserAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed: UserAccount[] = JSON.parse(raw);
    // Explicitly purge demo accounts if present from earlier runs
    const sanitized = parsed.filter((a) => !DEMO_ACCOUNT_IDS.has(a.id) && a.username !== 'kaito_mod' && a.username !== 'sakura_vip' && a.username !== 'ren_viewer');
    if (sanitized.length !== parsed.length) {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch (err) {
    console.error('Failed to load user accounts:', err);
    return [];
  }
}

export function saveUserAccounts(accounts: UserAccount[]): void {
  const sanitized = accounts.filter((a) => !DEMO_ACCOUNT_IDS.has(a.id) && a.username !== 'kaito_mod' && a.username !== 'sakura_vip' && a.username !== 'ren_viewer');
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(sanitized));
}

export function createUserAccount(data: Omit<UserAccount, 'id' | 'createdAt'>): UserAccount {
  const accounts = getUserAccounts();
  const newAccount: UserAccount = {
    ...data,
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
    watchlistCount: data.watchlistCount || 0,
  };
  accounts.unshift(newAccount);
  saveUserAccounts(accounts);
  return newAccount;
}

export function updateUserAccount(id: string, updates: Partial<UserAccount>): UserAccount[] {
  const accounts = getUserAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...updates };
    saveUserAccounts(accounts);
  }
  return accounts;
}

export function deleteUserAccount(id: string): UserAccount[] {
  const accounts = getUserAccounts().filter((a) => a.id !== id);
  saveUserAccounts(accounts);
  return accounts;
}

export function getCurrentUser(): UserAccount {
  const accounts = getUserAccounts();
  const currentId = localStorage.getItem(CURRENT_USER_KEY);
  if (currentId) {
    const found = accounts.find((a) => a.id === currentId);
    if (found) return found;
  }
  return GUEST_USER;
}

export function setCurrentUser(userId: string): UserAccount {
  localStorage.setItem(CURRENT_USER_KEY, userId);
  return getCurrentUser();
}

export function checkLocalUsername(username: string): { available: boolean; message: string } {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (clean.length < 3) {
    return { available: false, message: 'Username must be at least 3 characters.' };
  }
  const accounts = getUserAccounts();
  const exists = accounts.some((a) => a.username.toLowerCase() === clean || a.email.toLowerCase() === clean);
  return {
    available: !exists,
    message: exists ? 'This username or email is already registered.' : 'Username is available.',
  };
}

export function registerLocalAccount(data: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  bio?: string;
}): UserAccount {
  const { email, password, username, displayName, bio } = data;
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const accounts = getUserAccounts();
  const existing = accounts.find(
    (a) => a.email.toLowerCase() === cleanEmail || a.username.toLowerCase() === cleanUsername
  );
  if (existing) {
    if (existing.email.toLowerCase() === cleanEmail) {
      throw new Error('This email address is already registered. Please sign in.');
    }
    throw new Error('This username is already taken. Please choose another username.');
  }

  const isBootstrappedAdmin = cleanEmail === 'benilin40@gmail.com' || cleanUsername === 'benilin';
  const now = Date.now();
  const newAccount: UserAccount = {
    id: `usr_${now}_${Math.random().toString(36).substring(2, 6)}`,
    uid: `usr_${now}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    displayName: displayName.trim() || cleanUsername,
    email: cleanEmail,
    role: isBootstrappedAdmin ? 'admin' : 'USER',
    status: 'active',
    accountStatus: 'active',
    bio: bio?.trim() || 'Anime collector and streamer on YORUMI.',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    watchlistCount: 0,
    passwordHash: password, // Stored locally
  };

  accounts.unshift(newAccount);
  saveUserAccounts(accounts);
  return newAccount;
}

export function loginLocalAccount(identifier: string, password: string): UserAccount {
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId || !password) {
    throw new Error('Please enter your email/username and password.');
  }

  const accounts = getUserAccounts();
  const found = accounts.find(
    (a) =>
      (a.email.toLowerCase() === cleanId || a.username.toLowerCase() === cleanId) &&
      (a.passwordHash === password || !a.passwordHash)
  );

  if (!found) {
    throw new Error('Invalid email/username or password. Please verify your credentials.');
  }

  // Update last login
  found.lastLoginAt = Date.now();
  saveUserAccounts(accounts);
  return found;
}


