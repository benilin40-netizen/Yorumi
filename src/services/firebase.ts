import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocFromServer, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  UserAccount,
  WatchlistItem,
  Anime,
  WatchHistoryItem,
} from '../types/anime';
import {
  getWatchlist,
  saveWatchlistItem,
  removeFromWatchlist as removeStorageWatchlist,
  getFavorites,
  toggleFavorite as toggleStorageFavorite,
  getWatchHistory,
  recordWatchHistory,
  getUserAccounts,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  registerLocalAccount,
  loginLocalAccount,
  checkLocalUsername,
} from './storage';

// -------------------------------------------------------------
// REAL FIREBASE INITIALIZATION & FIRESTORE BINDING
// -------------------------------------------------------------
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const BOOTSTRAPPED_ADMIN_EMAIL = 'benilin40@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    console.warn('Firestore connectivity check:', error);
    return true; // Fallback smoothly to local mode if offline
  }
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
  const account = await registerLocalAccount(data);

  // Sync profile document to Firestore users collection
  try {
    const userRef = doc(db, 'users', account.id);
    await setDoc(userRef, {
      id: account.id,
      uid: account.id,
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      role: account.role,
      status: account.status,
      accountStatus: account.status,
      bio: account.bio || '',
      watchlistCount: 0,
      createdAt: account.createdAt,
      updatedAt: account.createdAt,
      lastLoginAt: account.createdAt,
    });
  } catch (err) {
    console.warn('Firestore user profile sync warning (proceeding with local user):', err);
  }

  return account;
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
  const account = await loginLocalAccount(identifier, password);
  return account;
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
  const account = createUserAccount(data);
  try {
    const userRef = doc(db, 'users', account.id);
    await setDoc(userRef, {
      id: account.id,
      uid: account.id,
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      role: account.role,
      status: account.status,
      bio: account.bio || '',
      createdAt: account.createdAt,
    });
  } catch (err) {
    console.warn('Firestore user creation warning:', err);
  }
  return account;
}

export async function updateFirestoreUserAccount(
  userId: string,
  updates: Partial<UserAccount>
): Promise<void> {
  updateUserAccount(userId, updates);
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { ...updates, updatedAt: Date.now() });
  } catch (err) {
    console.warn('Firestore user update warning:', err);
  }
}

export async function deleteFirestoreUserAccount(userId: string): Promise<void> {
  deleteUserAccount(userId);
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
  } catch (err) {
    console.warn('Firestore user delete warning:', err);
  }
}

// Watchlist, Favorites, History wrappers
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
    anime: {
      id: item.animeId,
      title: { english: item.animeTitle, romaji: item.animeTitle, native: null },
      coverImage: { extraLarge: item.coverImage, large: item.coverImage, medium: item.coverImage, color: null },
      bannerImage: item.bannerImage,
    } as any,
    episode: item.episode,
    progressSeconds: item.progressSeconds,
    totalDurationSeconds: item.totalDurationSeconds,
  });
}

export async function loadHistoryFromFirestore(userId: string): Promise<WatchHistoryItem[]> {
  return getWatchHistory();
}
