import React, { createContext, useContext, useState, useEffect } from 'react';
import { Anime, WatchHistoryItem, WatchlistItem, WatchStatus, UserAccount, UserRole } from '../types/anime';
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
  registerWithEmailPassword,
  checkUsernameAvailable,
  sendPasswordReset,
  loginWithEmailOrUsername,
  createOrRetryUserProfile,
} from '../services/firebase';
import {
  YorumiNotification,
  getNotifications,
  markAllNotificationsRead,
  notifyNewUserRegistration,
  notifyWelcomeUser,
} from '../services/notificationService';

interface UserContextType {
  watchlist: WatchlistItem[];
  favorites: Anime[];
  history: WatchHistoryItem[];
  notifications: YorumiNotification[];
  unreadNotificationCount: number;
  currentUser: UserAccount;
  userAccounts: UserAccount[];
  firebaseUser: any | null;
  isFirebaseLoading: boolean;
  firebaseConnected: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'signin' | 'signup' | 'forgot' | 'verify';
  setIsAuthModalOpen: (open: boolean) => void;
  setAuthModalMode: (mode: 'signin' | 'signup' | 'forgot' | 'verify') => void;
  openAuthModal: (mode?: 'signin' | 'signup' | 'forgot' | 'verify') => void;
  loginManual: (identifier: string, password: string) => Promise<UserAccount>;
  signUpManual: (data: {
    username: string;
    displayName: string;
    email: string;
    password: string;
    bio?: string;
  }) => Promise<UserAccount>;
  checkUsernameAvailable: (username: string) => Promise<{ available: boolean; message: string }>;
  sendVerificationEmailAction: () => Promise<void>;
  isEmailVerified: boolean;
  sendPasswordResetAction: (email: string) => Promise<void>;
  retryProfileSetup: (overrides?: { username?: string; displayName?: string; bio?: string }) => Promise<UserAccount>;
  authRecoveryUser: any | null;
  clearAuthRecovery: () => void;
  signOutUser: () => Promise<void>;
  updateWatchlist: (anime: Anime, status: WatchStatus, score?: number | null, episode?: number) => void;
  removeFromWatchlist: (animeId: number) => void;
  toggleFavorite: (anime: Anime) => boolean;
  isFavorite: (animeId: number) => boolean;
  getWatchlistItem: (animeId: number) => WatchlistItem | undefined;
  addHistoryRecord: (anime: Anime, episode: number, progressSeconds?: number) => void;
  clearHistory: () => void;
  markNotificationsRead: () => void;
  createUser: (data: Omit<UserAccount, 'id' | 'createdAt'>) => Promise<UserAccount>;
  updateUser: (id: string, updates: Partial<UserAccount>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  switchUser: (id: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUserState] = useState<UserAccount>(() => getCurrentUser());
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState<boolean>(false);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);

  // Manual Auth Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'forgot' | 'verify'>('signin');
  const [authRecoveryUser, setAuthRecoveryUser] = useState<any | null>(null);

  const openAuthModal = (mode: 'signin' | 'signup' | 'forgot' | 'verify' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const clearAuthRecovery = () => {
    setAuthRecoveryUser(null);
  };

  const [notifications, setNotifications] = useState<YorumiNotification[]>(() => getNotifications());

  // Initial load
  useEffect(() => {
    setWatchlist(getWatchlist());
    setFavorites(getFavorites());
    setHistory(getWatchHistory());
    setUserAccounts(getUserAccounts());
    setNotifications(getNotifications());
    const current = getCurrentUser();
    setCurrentUserState(current);
    if (current && current.id !== 'guest') {
      setFirebaseUser({ uid: current.id, email: current.email, emailVerified: true });
    }
    setIsFirebaseLoading(false);
  }, []);

  const loginManual = async (identifier: string, password: string): Promise<UserAccount> => {
    const user = await loginWithEmailOrUsername(identifier, password);
    setCurrentUserState(user);
    setStorageCurrentUser(user.id);
    setFirebaseUser({ uid: user.id, email: user.email, emailVerified: true });
    setUserAccounts(getUserAccounts());
    return user;
  };

  const signUpManual = async (data: {
    username: string;
    displayName: string;
    email: string;
    password: string;
    bio?: string;
  }): Promise<UserAccount> => {
    const user = await registerWithEmailPassword(data);
    setCurrentUserState(user);
    setStorageCurrentUser(user.id);
    setFirebaseUser({ uid: user.id, email: user.email, emailVerified: true });
    setUserAccounts(getUserAccounts());
    notifyNewUserRegistration(user.username, user.email);
    notifyWelcomeUser(user.displayName);
    setNotifications(getNotifications());
    return user;
  };

  const retryProfileSetup = async (overrides?: {
    username?: string;
    displayName?: string;
    bio?: string;
  }): Promise<UserAccount> => {
    const activeUser = currentUser;
    const user = await createOrRetryUserProfile(activeUser, overrides);
    setCurrentUserState(user);
    setStorageCurrentUser(user.id);
    setAuthRecoveryUser(null);
    setUserAccounts(getUserAccounts());
    return user;
  };

  const isEmailVerified = true;

  const sendVerificationEmailAction = async (): Promise<void> => {
    return Promise.resolve();
  };

  const sendPasswordResetAction = async (email: string): Promise<void> => {
    await sendPasswordReset(email);
  };

  const signOutUser = async () => {
    setCurrentUserState(GUEST_USER);
    setFirebaseUser(null);
    setAuthRecoveryUser(null);
    localStorage.removeItem('yorumi_current_user_id');
  };

  const updateWatchlist = (anime: Anime, status: WatchStatus, score: number | null = null, episode: number = 1) => {
    const updated = saveWatchlistItem(anime, status, score, episode);
    setWatchlist([...updated]);
  };

  const removeFromWatchlist = (animeId: number) => {
    const updated = removeStorageWatchlist(animeId);
    setWatchlist([...updated]);
  };

  const toggleFavorite = (anime: Anime): boolean => {
    const result = toggleStorageFavorite(anime);
    setFavorites([...result.favorites]);
    return result.isFavorite;
  };

  const isFavorite = (animeId: number): boolean => {
    return favorites.some((item) => item.id === animeId);
  };

  const getWatchlistItem = (animeId: number): WatchlistItem | undefined => {
    return watchlist.find((item) => item.anime.id === animeId);
  };

  const addHistoryRecord = (anime: Anime, episode: number, progressSeconds: number = 0) => {
    const updated = recordWatchHistory({ anime, episode, progressSeconds });
    setHistory([...updated]);
  };

  const clearHistory = () => {
    clearStorageHistory();
    setHistory([]);
  };

  const markNotificationsRead = () => {
    const updated = markAllNotificationsRead();
    setNotifications([...updated]);
  };

  const createUser = async (data: Omit<UserAccount, 'id' | 'createdAt'>): Promise<UserAccount> => {
    const newAcc = createStorageUser(data);
    setUserAccounts(getUserAccounts());
    return newAcc;
  };

  const updateUser = async (id: string, updates: Partial<UserAccount>): Promise<void> => {
    updateStorageUser(id, updates);
    setUserAccounts(getUserAccounts());
    if (currentUser.id === id) {
      setCurrentUserState(getCurrentUser());
    }
  };

  const deleteUser = async (id: string): Promise<void> => {
    deleteStorageUser(id);
    setUserAccounts(getUserAccounts());
    if (currentUser.id === id) {
      setCurrentUserState(GUEST_USER);
      localStorage.removeItem('yorumi_current_user_id');
    }
  };

  const switchUser = (id: string) => {
    const user = setStorageCurrentUser(id);
    setCurrentUserState(user);
    if (user && user.id !== 'guest') {
      setFirebaseUser({ uid: user.id, email: user.email, emailVerified: true });
    } else {
      setFirebaseUser(null);
    }
  };

  const unreadNotificationCount = notifications.filter((n) => n.unread).length;

  return (
    <UserContext.Provider
      value={{
        watchlist,
        favorites,
        history,
        notifications,
        unreadNotificationCount,
        currentUser,
        userAccounts,
        firebaseUser,
        isFirebaseLoading,
        firebaseConnected,
        isAuthModalOpen,
        authModalMode,
        setIsAuthModalOpen,
        setAuthModalMode,
        openAuthModal,
        loginManual,
        signUpManual,
        checkUsernameAvailable,
        sendVerificationEmailAction,
        isEmailVerified,
        sendPasswordResetAction,
        retryProfileSetup,
        authRecoveryUser,
        clearAuthRecovery,
        signOutUser,
        updateWatchlist,
        removeFromWatchlist,
        toggleFavorite,
        isFavorite,
        getWatchlistItem,
        addHistoryRecord,
        clearHistory,
        markNotificationsRead,
        createUser,
        updateUser,
        deleteUser,
        switchUser,
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
