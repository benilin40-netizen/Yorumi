import {
  UserAccount,
  WatchlistItem,
  Anime,
  WatchHistoryItem,
  UserRole,
} from '../types/anime';
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
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  getCurrentUser,
  setCurrentUser,
  registerLocalAccount,
  loginLocalAccount,
  checkLocalUsername,
} from './storage';

// Mock Auth and DB objects for full local mode (Firebase removed)
export const auth = {
  currentUser: null as any,
};

export const db = {};

export const FIREBASE_PROJECT_ID = 'local-yorumi-mode';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'benilin40@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  console.error('Local Storage Operation Error: ', error, operationType, path);
  throw new Error(error instanceof Error ? error.message : String(error));
}

export async function testFirebaseConnection(): Promise<boolean> {
  return true;
}

export class RegistrationProfileError extends Error {
  code = 'auth-succeeded-profile-failed';
  user: any;
  userId: string;
  pendingProfile: UserAccount;

  constructor(message: string, user: any, pendingProfile: UserAccount) {
    super(message);
    this.name = 'RegistrationProfileError';
    this.user = user;
    this.userId = pendingProfile.id;
    this.pendingProfile = pendingProfile;
  }
}

export async function checkUsernameAvailable(username: string): Promise<{ available: boolean; message: string }> {
  return checkLocalUsername(username);
}

export async function sendVerificationEmail(): Promise<void> {
  return Promise.resolve();
}

export async function registerWithEmailPassword(data: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  bio?: string;
}): Promise<UserAccount> {
  return registerLocalAccount(data);
}

export async function createOrRetryUserProfile(
  fbUser: any,
  overrides?: { username?: string; displayName?: string; bio?: string }
): Promise<UserAccount> {
  const accounts = getUserAccounts();
  const found = accounts.find((a) => a.email.toLowerCase() === (fbUser.email || '').toLowerCase());
  if (found) return found;

  return registerLocalAccount({
    email: fbUser.email || 'user@yorumi.app',
    password: 'password123',
    username: overrides?.username || fbUser.email?.split('@')[0] || 'yorumi_user',
    displayName: overrides?.displayName || fbUser.displayName || 'Yorumi Member',
    bio: overrides?.bio,
  });
}

export async function syncUserProfile(firebaseUser: any): Promise<UserAccount> {
  return createOrRetryUserProfile(firebaseUser);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  return Promise.resolve();
}

export async function loginWithEmailOrUsername(identifier: string, password: string): Promise<UserAccount> {
  return loginLocalAccount(identifier, password);
}

export async function logoutFirebaseUser(): Promise<void> {
  return Promise.resolve();
}

export async function fetchAllUsers(): Promise<UserAccount[]> {
  return getUserAccounts();
}

export async function createFirestoreUserAccount(
  data: Omit<UserAccount, 'id' | 'createdAt'>
): Promise<UserAccount> {
  return createUserAccount(data);
}

export async function updateFirestoreUserAccount(
  userId: string,
  updates: Partial<UserAccount>
): Promise<void> {
  updateUserAccount(userId, updates);
}

export async function deleteFirestoreUserAccount(userId: string): Promise<void> {
  deleteUserAccount(userId);
}

// Watchlist, Favorites, History local persistence wrappers
export async function saveWatchlistItemToFirestore(userId: string, item: WatchlistItem): Promise<void> {
  saveWatchlistItem(item.anime, item.status, item.userScore, item.lastWatchedEpisode);
}

export async function removeWatchlistItemFromFirestore(userId: string, animeId: number): Promise<void> {
  removeStorageWatchlist(animeId);
}

export async function loadWatchlistFromFirestore(userId: string): Promise<WatchlistItem[]> {
  return getWatchlist();
}

export async function saveFavoriteToFirestore(userId: string, anime: Anime): Promise<void> {
  toggleStorageFavorite(anime);
}

export async function removeFavoriteFromFirestore(userId: string, animeId: number): Promise<void> {
  toggleStorageFavorite({ id: animeId } as any);
}

export async function loadFavoritesFromFirestore(userId: string): Promise<Anime[]> {
  return getFavorites();
}

export async function saveHistoryToFirestore(userId: string, item: WatchHistoryItem): Promise<void> {
  recordWatchHistory({
    anime: { id: item.animeId, title: { english: item.animeTitle, romaji: item.animeTitle }, coverImage: { large: item.coverImage, extraLarge: item.coverImage }, bannerImage: item.bannerImage } as any,
    episode: item.episode,
    progressSeconds: item.progressSeconds,
    totalDurationSeconds: item.totalDurationSeconds,
  });
}

export async function loadHistoryFromFirestore(userId: string): Promise<WatchHistoryItem[]> {
  return getWatchHistory();
}
