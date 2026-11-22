import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, WatchlistItem, Anime, WatchHistoryItem, UserRole } from '../types/anime';

// Initialize Firebase App & Services
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Bootstrapped Connection Prober
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears to be offline. Verify network or database status.');
    }
    return false;
  }
}

// Authentication Helpers
export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

export async function logoutFirebaseUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// User Profile Synchronization in Firestore
export async function syncUserProfile(firebaseUser: FirebaseUser): Promise<UserAccount> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const path = `users/${firebaseUser.uid}`;

  try {
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      return snap.data() as UserAccount;
    }

    // Auto-create profile for new authenticated user
    const username = (
      firebaseUser.email?.split('@')[0] ||
      firebaseUser.displayName?.toLowerCase().replace(/[^a-z0-9_]/g, '') ||
      `user_${firebaseUser.uid.substring(0, 6)}`
    ).replace(/[^a-z0-9_]/g, '_');

    const newProfile: UserAccount = {
      id: firebaseUser.uid,
      username,
      displayName: firebaseUser.displayName || 'Anime Fan',
      email: firebaseUser.email || '',
      role: 'member' as UserRole,
      status: 'active',
      avatarUrl: firebaseUser.photoURL || '',
      bio: 'YORUMI anime viewer and collector',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      watchlistCount: 0,
    };

    await setDoc(userRef, newProfile);
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch all registered users for Admin panel
export async function fetchAllUsers(): Promise<UserAccount[]> {
  const path = 'users';
  try {
    const q = query(collection(db, path), limit(100));
    const snap = await getDocs(q);
    const users: UserAccount[] = [];
    snap.forEach((docSnap) => {
      users.push(docSnap.data() as UserAccount);
    });
    return users;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Create user directly from Admin console into Firestore
export async function createFirestoreUserAccount(
  data: Omit<UserAccount, 'id' | 'createdAt'>
): Promise<UserAccount> {
  const generatedId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const userRef = doc(db, 'users', generatedId);
  const path = `users/${generatedId}`;

  const newAccount: UserAccount = {
    ...data,
    id: generatedId,
    createdAt: Date.now(),
    watchlistCount: data.watchlistCount || 0,
  };

  try {
    await setDoc(userRef, newAccount);
    if (data.role === 'admin') {
      try {
        await setDoc(doc(db, 'admins', generatedId), {
          userId: generatedId,
          email: data.email,
          role: 'admin',
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Admin record creation warning:', err);
      }
    }
    return newAccount;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Update user in Firestore
export async function updateFirestoreUserAccount(
  userId: string,
  updates: Partial<UserAccount>
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const path = `users/${userId}`;
  try {
    await updateDoc(userRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete user in Firestore
export async function deleteFirestoreUserAccount(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const path = `users/${userId}`;
  try {
    await deleteDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Watchlist Firestore Persistence
export async function saveWatchlistItemToFirestore(userId: string, item: WatchlistItem): Promise<void> {
  const path = `users/${userId}/watchlist/${item.anime.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'watchlist', String(item.anime.id)), {
      animeId: item.anime.id,
      status: item.status,
      userScore: item.userScore,
      lastWatchedEpisode: item.lastWatchedEpisode,
      updatedAt: item.updatedAt,
      anime: item.anime,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeWatchlistItemFromFirestore(userId: string, animeId: number): Promise<void> {
  const path = `users/${userId}/watchlist/${animeId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'watchlist', String(animeId)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadWatchlistFromFirestore(userId: string): Promise<WatchlistItem[]> {
  const path = `users/${userId}/watchlist`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'watchlist'));
    const items: WatchlistItem[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      items.push({
        anime: data.anime,
        status: data.status,
        userScore: data.userScore ?? null,
        lastWatchedEpisode: data.lastWatchedEpisode || 1,
        updatedAt: data.updatedAt || Date.now(),
      });
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Favorites Firestore Persistence
export async function saveFavoriteToFirestore(userId: string, anime: Anime): Promise<void> {
  const path = `users/${userId}/favorites/${anime.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'favorites', String(anime.id)), {
      animeId: anime.id,
      anime,
      createdAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeFavoriteFromFirestore(userId: string, animeId: number): Promise<void> {
  const path = `users/${userId}/favorites/${animeId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'favorites', String(animeId)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadFavoritesFromFirestore(userId: string): Promise<Anime[]> {
  const path = `users/${userId}/favorites`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'favorites'));
    const list: Anime[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.anime) list.push(data.anime);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Watch History Firestore Persistence
export async function saveHistoryToFirestore(userId: string, item: WatchHistoryItem): Promise<void> {
  const path = `users/${userId}/history/${item.animeId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'history', String(item.animeId)), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadHistoryFromFirestore(userId: string): Promise<WatchHistoryItem[]> {
  const path = `users/${userId}/history`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'history'));
    const list: WatchHistoryItem[] = [];
    snap.forEach((d) => list.push(d.data() as WatchHistoryItem));
    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
