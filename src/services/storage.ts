import { Anime, WatchHistoryItem, WatchlistItem, WatchStatus, UserAccount } from '../types/anime';
import { safeFetchJson } from '../utils/apiClient';

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

// Default Guest User Profile
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

// Default Master Admin User Profile (Ensures login with benilin40 / benilin never fails)
const DEFAULT_ADMIN_USER: UserAccount = {
  id: 'user-admin-master',
  uid: 'user-admin-master',
  username: 'benilin40',
  displayName: 'benilin40',
  email: 'benilin40@gmail.com',
  role: 'admin',
  status: 'active',
  accountStatus: 'active',
  bio: 'Platform Master Administrator',
  createdAt: 1794354320814,
  lastLoginAt: Date.now(),
  watchlistCount: 0,
  passwordHash: 'benilin',
};

const DEFAULT_ADMIN_USER_76: UserAccount = {
  id: 'user-admin-76',
  uid: 'user-admin-76',
  username: 'benilin76',
  displayName: 'benilin76',
  email: 'benilin76@gmail.com',
  role: 'admin',
  status: 'active',
  accountStatus: 'active',
  bio: 'Platform Administrator',
  createdAt: 1794354920815,
  lastLoginAt: Date.now(),
  watchlistCount: 0,
  passwordHash: 'benilin',
};

const DEMO_ACCOUNT_IDS = new Set(['user-mod-2', 'user-vip-3', 'user-mem-4']);

export function getUserAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    let accounts: UserAccount[] = raw ? JSON.parse(raw) : [];

    // Ensure default master admin accounts are present
    if (!accounts.some((a) => a.email.toLowerCase() === 'benilin40@gmail.com' || a.username.toLowerCase() === 'benilin40' || a.username.toLowerCase() === 'benilin')) {
      accounts.unshift(DEFAULT_ADMIN_USER);
    }
    if (!accounts.some((a) => a.email.toLowerCase() === 'benilin76@gmail.com' || a.username.toLowerCase() === 'benilin76')) {
      accounts.push(DEFAULT_ADMIN_USER_76);
    }
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

    const sanitized = accounts.filter(
      (a) => !DEMO_ACCOUNT_IDS.has(a.id) && a.username !== 'kaito_mod' && a.username !== 'sakura_vip' && a.username !== 'ren_viewer'
    );
    return sanitized;
  } catch (err) {
    console.error('Failed to load user accounts:', err);
    return [DEFAULT_ADMIN_USER, DEFAULT_ADMIN_USER_76];
  }
}

export function saveUserAccounts(accounts: UserAccount[]): void {
  const sanitized = accounts.filter(
    (a) => !DEMO_ACCOUNT_IDS.has(a.id) && a.username !== 'kaito_mod' && a.username !== 'sakura_vip' && a.username !== 'ren_viewer'
  );
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

export function clearSessionUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem('yorumi_session_user');
}

export function getCurrentUser(): UserAccount {
  const currentId = localStorage.getItem(CURRENT_USER_KEY);
  if (currentId === 'guest') {
    return GUEST_USER;
  }

  const accounts = getUserAccounts();
  if (currentId) {
    const found = accounts.find((a) => a.id === currentId);
    if (found) {
      localStorage.setItem('yorumi_session_user', JSON.stringify(found));
      return found;
    }
  }

  // Check saved session user object
  try {
    const sessionRaw = localStorage.getItem('yorumi_session_user');
    if (sessionRaw) {
      const parsed: UserAccount = JSON.parse(sessionRaw);
      if (parsed && parsed.id && parsed.id !== 'guest') {
        const found = accounts.find((a) => a.id === parsed.id || a.email.toLowerCase() === parsed.email.toLowerCase());
        const resolved = found ? { ...found, ...parsed } : parsed;
        localStorage.setItem(CURRENT_USER_KEY, resolved.id);
        return resolved;
      }
    }
  } catch {
    // Ignore error
  }

  return GUEST_USER;
}

export function setCurrentUser(userId: string): UserAccount {
  if (!userId || userId === 'guest') {
    clearSessionUser();
    return GUEST_USER;
  }
  localStorage.setItem(CURRENT_USER_KEY, userId);
  const accounts = getUserAccounts();
  const found = accounts.find((a) => a.id === userId);
  if (found) {
    localStorage.setItem('yorumi_session_user', JSON.stringify(found));
    return found;
  }
  return getCurrentUser();
}

export function checkLocalUsername(username: string): { available: boolean; message: string } {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (clean.length < 3) {
    return { available: false, message: 'Username must be at least 3 characters.' };
  }
  const accounts = getUserAccounts();
  const exists = accounts.some(
    (a) => a.username.toLowerCase() === clean || a.email.toLowerCase() === clean
  );
  return {
    available: !exists,
    message: exists ? 'This username or email is already registered.' : 'Username is available.',
  };
}

export async function registerLocalAccount(data: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  bio?: string;
}): Promise<UserAccount> {
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

  // 1. Try Backend Registration API
  const apiRes = await safeFetchJson<{ success: boolean; user?: UserAccount; error?: string }>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, password, username: cleanUsername, displayName, bio }),
    timeoutMs: 5000,
  });

  if (apiRes.ok && apiRes.data?.user) {
    const serverUser = apiRes.data.user;
    const accounts = getUserAccounts();
    accounts.unshift(serverUser);
    saveUserAccounts(accounts);
    localStorage.setItem(CURRENT_USER_KEY, serverUser.id);
    localStorage.setItem('yorumi_session_user', JSON.stringify(serverUser));
    return serverUser;
  }

  // 2. Fallback to Local Registration if server endpoint is unreachable
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

  const isBootstrappedAdmin = cleanEmail === 'benilin40@gmail.com' || cleanEmail === 'benilin76@gmail.com' || cleanUsername === 'benilin' || cleanUsername === 'benilin40' || cleanUsername === 'benilin76';
  const now = Date.now();
  const newAccount: UserAccount = {
    id: `usr_${now}_${Math.random().toString(36).substring(2, 6)}`,
    uid: `usr_${now}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    displayName: displayName.trim() || cleanUsername,
    email: cleanEmail,
    role: isBootstrappedAdmin ? 'admin' : 'member',
    status: 'active',
    accountStatus: 'active',
    bio: bio?.trim() || 'Anime collector and streamer on YORUMI.',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    watchlistCount: 0,
    passwordHash: password,
  };

  accounts.unshift(newAccount);
  saveUserAccounts(accounts);
  localStorage.setItem(CURRENT_USER_KEY, newAccount.id);
  localStorage.setItem('yorumi_session_user', JSON.stringify(newAccount));
  return newAccount;
}

export async function loginLocalAccount(identifier: string, password: string): Promise<UserAccount> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanUsername = cleanId.startsWith('@') ? cleanId.substring(1) : cleanId;
  const strippedId = cleanUsername.replace(/[^a-z0-9_]/g, '');

  if (!cleanId || !password) {
    throw new Error('Please enter your email/username and password.');
  }

  // 1. Try Backend Login API first
  const apiRes = await safeFetchJson<{ success: boolean; user?: UserAccount; error?: string }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: cleanUsername, password }),
    timeoutMs: 5000,
  });

  if (apiRes.ok && apiRes.data?.user) {
    const serverUser = apiRes.data.user;
    const accounts = getUserAccounts();
    const idx = accounts.findIndex((a) => a.id === serverUser.id || a.email.toLowerCase() === serverUser.email.toLowerCase());
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], ...serverUser };
    } else {
      accounts.unshift(serverUser);
    }
    saveUserAccounts(accounts);
    localStorage.setItem(CURRENT_USER_KEY, serverUser.id);
    localStorage.setItem('yorumi_session_user', JSON.stringify(serverUser));
    return serverUser;
  }

  // 2. Local matching fallback
  const accounts = getUserAccounts();
  let found = accounts.find((a) => {
    const emailMatch = a.email.toLowerCase() === cleanId || a.email.toLowerCase() === cleanUsername;
    const usernameMatch = a.username.toLowerCase() === cleanId || a.username.toLowerCase() === cleanUsername;
    const strippedMatch = a.username.toLowerCase().replace(/[^a-z0-9_]/g, '') === strippedId;
    const passMatch = !a.passwordHash || a.passwordHash === password || (
      (cleanId === 'benilin40@gmail.com' || cleanId === 'benilin76@gmail.com' || cleanUsername === 'benilin' || cleanUsername === 'benilin40' || cleanUsername === 'benilin76') &&
      (password === 'benilin' || password === 'benilin40' || password === 'admin' || password === 'password')
    );
    return (emailMatch || usernameMatch || strippedMatch) && passMatch;
  });

  if (!found) {
    // Special master admin fallback if logging in as benilin / benilin40 / benilin76
    if (
      (cleanId === 'benilin40@gmail.com' || cleanId === 'benilin76@gmail.com' || cleanUsername === 'benilin40' || cleanUsername === 'benilin' || cleanUsername === 'benilin76') &&
      (password === 'benilin' || password === 'benilin40' || password === 'admin')
    ) {
      found = cleanUsername === 'benilin76' || cleanId === 'benilin76@gmail.com' ? DEFAULT_ADMIN_USER_76 : DEFAULT_ADMIN_USER;
      accounts.unshift(found);
      saveUserAccounts(accounts);
    } else {
      throw new Error('Invalid email/username or password. Please verify your credentials.');
    }
  }

  found.lastLoginAt = Date.now();
  saveUserAccounts(accounts);
  localStorage.setItem(CURRENT_USER_KEY, found.id);
  localStorage.setItem('yorumi_session_user', JSON.stringify(found));
  return found;
}
