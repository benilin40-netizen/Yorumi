import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  HardDrive,
  Layers,
  Lock,
  Monitor,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Tv,
  User as UserIcon,
  UserPlus,
  Users,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { ProviderId, UserAccount, UserRole, UserStatus } from '../types/anime';

function getSafeExternalUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

interface AdminProps {
  onNavigate?: (route: string) => void;
}

interface ServerProviderHealth {
  id: ProviderId;
  name: string;
  priority: number;
  enabled: boolean;
  supportsDub: boolean;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  latencyMs: number | null;
  lastChecked: number | null;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  successCount: number;
  failureCount: number;
}

interface ServerErrorLog {
  id: string;
  timestamp: number;
  service: string;
  message: string;
  statusCode?: number;
}

interface AiringTitleSummary {
  id: number;
  idMal?: number | null;
  title: string;
  airedEpisodes: number;
  totalEpisodes: number | null;
  nextEpisode: number | null;
  nextAiringAt: number | null;
  trailer: { id: string; site: string; thumbnail?: string } | null;
  hidden?: boolean;
}

interface TrailerOverrideItem {
  anilistId: number;
  trailerId: string;
  site: string;
  updatedAt: number;
}

interface SupabaseAdminDashboard {
  supabaseConfigured: boolean;
  overviewStats: {
    series?: number;
    movies?: number;
    registered_users?: number;
    users?: number;
    verified_episodes?: number;
  } | null;
  syncRuns: {
    id?: string | number;
    status: string;
    items_fetched: number;
    items_playable: number;
    items_skipped: number;
    pages_fetched: number;
    error?: string | null;
    started_at?: string;
    finished_at?: string | null;
  }[];
  providerHealthHistory: {
    id?: string | number;
    provider_id: string;
    status: string;
    latency_ms?: number | null;
    last_error?: string | null;
    checked_at?: string;
  }[];
  analyticsSummary: {
    totalEvents: number;
    byEvent: Record<string, number>;
  };
  catalogTitles: {
    id: number;
    title: string;
    format: string | null;
    status: string | null;
    airedEpisodes: number;
    totalEpisodes: number | null;
    hidden: boolean;
    trailerOverrideId: string | null;
    trailerId: string | null;
  }[];
}

interface AdminOverviewResponse {
  providers: ServerProviderHealth[];
  kurokoEnabled: boolean;
  apiUsage: {
    anilistRequests: number;
    jikanRequests: number;
    cacheHits: number;
    cacheMisses: number;
    rateLimitBackoffs: number;
    lastScheduleSyncAt: number | null;
    lastScheduleOk: boolean;
    lastScheduleError: string | null;
    cachedKeys: number;
    trailerOverridesCount: number;
    errorCount: number;
  };
  errorLogs: ServerErrorLog[];
  airingTitles: AiringTitleSummary[];
  trailerOverrides: TrailerOverrideItem[];
  supabase?: SupabaseAdminDashboard;
  server: {
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
    rssMb: number;
    heapUsedMb: number;
  };
}

const PREVIEW_PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'discover', label: 'Discover' },
  { id: 'trending', label: 'Trending' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'movies', label: 'Movies' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'history', label: 'History' },
  { id: 'details', label: 'Anime Details' },
  { id: 'watch', label: 'Watch Player' },
];

function formatRelativeOrTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCountdownShort(airingAt: number | null): string {
  if (!airingAt) return 'TBA';
  const diff = airingAt - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'Airing / Aired';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export const Admin: React.FC<AdminProps> = ({ onNavigate }) => {
  const {
    watchlist,
    favorites,
    history,
    clearHistory,
    currentUser,
    userAccounts,
    createUser,
    updateUser,
    deleteUser,
    switchUser,
    firebaseUser,
    signInGoogle,
    signOutGoogle,
    firebaseConnected,
    adminAuthenticated,
    refreshAdminSession,
    logoutAdminSession,
  } = useUser();
  const { session: supabaseSession, isAdmin: supabaseIsAdmin } = useAuth();

  const isEffectiveAdmin = adminAuthenticated || supabaseIsAdmin;

  const [sessionLoading, setSessionLoading] = useState(true);
  const [passwordConfigured, setPasswordConfigured] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmBootstrapInput, setConfirmBootstrapInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'providers' | 'airing' | 'preview' | 'logs' | 'users'
  >('overview');

  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  // Provider Probe Controls
  const [probing, setProbing] = useState(false);
  const [probeAnimeId, setProbeAnimeId] = useState<number>(21);
  const [probeEpisode, setProbeEpisode] = useState<number>(1);
  const [probeLang, setProbeLang] = useState<'sub' | 'dub'>('sub');

  // Trailer Override Editor
  const [editingTrailerId, setEditingTrailerId] = useState<number | null>(null);
  const [trailerInput, setTrailerInput] = useState('');
  const [customTrailerAnilistId, setCustomTrailerAnilistId] = useState('');
  const [customTrailerCode, setCustomTrailerCode] = useState('');

  // Live Site Preview Controls
  const [previewRoute, setPreviewRoute] = useState<string>('home');
  const [previewAnimeId, setPreviewAnimeId] = useState<number>(21);
  const [previewEpisode, setPreviewEpisode] = useState<number>(1);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewNonce, setPreviewNonce] = useState<number>(1);

  // Users Management State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | UserStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserAccount | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('member');
  const [newStatus, setNewStatus] = useState<UserStatus>('active');
  const [newBio, setNewBio] = useState('');
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [editBio, setEditBio] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const adminFetch = useCallback(
    (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers || {});
      if (supabaseSession?.access_token) {
        headers.set('Authorization', `Bearer ${supabaseSession.access_token}`);
      }
      if (init.method && init.method !== 'GET') {
        headers.set('X-Requested-With', 'XMLHttpRequest');
      }
      return fetch(url, {
        ...init,
        credentials: 'include',
        headers,
      });
    },
    [supabaseSession?.access_token]
  );

  const showToastNotice = useCallback((text: string, type: 'info' | 'error' = 'info') => {
    setNotice({ text, type });
    setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await adminFetch('/api/admin/overview');
      if (res.status === 401) {
        await refreshAdminSession();
        return;
      }
      if (!res.ok) {
        throw new Error(`Overview request failed (${res.status})`);
      }
      const data: AdminOverviewResponse = await res.json();
      setOverview(data);
      const nextDrafts: Record<string, number> = {};
      for (const p of data.providers || []) {
        nextDrafts[p.id] = p.priority;
      }
      setPriorityDrafts(nextDrafts);
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed to load admin overview', 'error');
    } finally {
      setOverviewLoading(false);
    }
  }, [adminFetch, refreshAdminSession, showToastNotice]);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      setSessionLoading(true);
      try {
        const res = await adminFetch('/api/admin/session');
        const data = await res.json();
        if (!cancelled) {
          setPasswordConfigured(Boolean(data?.configured));
          await refreshAdminSession();
          if (data?.authenticated || supabaseIsAdmin) {
            fetchOverview();
          }
        }
      } catch {
        if (!cancelled) {
          setAuthError('Unable to reach server authentication endpoint.');
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [adminFetch, refreshAdminSession, fetchOverview, supabaseIsAdmin]);

  useEffect(() => {
    if (isEffectiveAdmin && !overview && !overviewLoading) {
      fetchOverview();
    }
  }, [isEffectiveAdmin, overview, overviewLoading, fetchOverview]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setAuthError('Enter the administrator password.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 && data?.configured === false) {
          setPasswordConfigured(false);
        }
        setAuthError(
          data?.remainingAttempts !== undefined
            ? `${data.error} (${data.remainingAttempts} attempts remaining)`
            : data?.error || 'Authentication failed.'
        );
        return;
      }
      setPasswordInput('');
      await refreshAdminSession();
      await fetchOverview();
    } catch {
      setAuthError('Network error communicating with authentication server.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (passwordInput !== confirmBootstrapInput) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(data?.error || 'Failed to claim initial administrator password.');
        return;
      }
      setPasswordConfigured(true);
      setPasswordInput('');
      setConfirmBootstrapInput('');
      await refreshAdminSession();
      await fetchOverview();
    } catch {
      setAuthError('Network error during initial admin setup.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdminSession();
    setOverview(null);
    setPasswordInput('');
  };

  const handleProbeAllProviders = async () => {
    setProbing(true);
    try {
      const res = await adminFetch('/api/admin/providers/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anilistId: probeAnimeId,
          episode: probeEpisode,
          lang: probeLang,
        }),
      });
      if (!res.ok) throw new Error('Probe failed');
      const data = await res.json();
      setOverview((prev) => (prev ? { ...prev, providers: data.providers } : prev));
      await fetchOverview();
      showToastNotice(`Completed 4s health checks for AniList #${probeAnimeId} EP ${probeEpisode}`);
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed probing providers', 'error');
    } finally {
      setProbing(false);
    }
  };

  const handleToggleProvider = async (provider: ServerProviderHealth) => {
    try {
      const res = await adminFetch('/api/admin/providers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, enabled: !provider.enabled }),
      });
      if (!res.ok) throw new Error('Failed to update provider');
      const data = await res.json();
      setOverview((prev) => (prev ? { ...prev, providers: data.providers } : prev));
      showToastNotice(
        `${provider.name} ${!provider.enabled ? 'enabled' : 'disabled'} at runtime`
      );
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed updating provider', 'error');
    }
  };

  const handleSaveProviderPriority = async (providerId: ProviderId) => {
    const priority = Math.max(1, Math.floor(Number(priorityDrafts[providerId] ?? 10)));
    try {
      const res = await adminFetch('/api/admin/providers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: providerId, priority }),
      });
      if (!res.ok) throw new Error('Failed saving provider priority');
      const data = await res.json();
      setOverview((prev) => (prev ? { ...prev, providers: data.providers } : prev));
      showToastNotice(`Updated ${providerId} priority to ${priority}`);
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed updating provider priority', 'error');
    }
  };

  const handleMoveProvider = async (index: number, direction: -1 | 1) => {
    if (!overview) return;
    const list = [...overview.providers];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const [moved] = list.splice(index, 1);
    list.splice(target, 0, moved);
    const order = list.map((p) => p.id);

    try {
      const res = await adminFetch('/api/admin/providers/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error('Failed to reorder providers');
      const data = await res.json();
      setOverview((prev) => (prev ? { ...prev, providers: data.providers } : prev));
      const nextDrafts: Record<string, number> = {};
      for (const p of data.providers || []) nextDrafts[p.id] = p.priority;
      setPriorityDrafts(nextDrafts);
      showToastNotice(`Updated provider failover order: ${data.providers.map((p: any) => p.name).join(' → ')}`);
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed reordering providers', 'error');
    }
  };

  const handleRunCatalogSync = async () => {
    setSyncingCatalog(true);
    try {
      const res = await adminFetch('/api/admin/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync request failed');
      const data = await res.json();
      await fetchOverview();
      showToastNotice(
        `Catalog sync ${data.syncRun?.status || 'finished'}: ${data.syncRun?.items_fetched ?? 0} fetched, ${data.syncRun?.items_playable ?? 0} playable`
      );
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed running catalog sync', 'error');
    } finally {
      setSyncingCatalog(false);
    }
  };

  const handleToggleAnimeVisibility = async (anilistId: number, currentHidden: boolean) => {
    try {
      const res = await adminFetch('/api/admin/anime/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anilistId, hidden: !currentHidden }),
      });
      if (!res.ok) throw new Error('Failed toggling visibility');
      await fetchOverview();
      showToastNotice(`Title #${anilistId} is now ${!currentHidden ? 'hidden' : 'visible'} on public catalog`);
    } catch (err: any) {
      showToastNotice(err?.message || 'Visibility update failed', 'error');
    }
  };

  const handleSaveTrailerOverride = async (anilistId: number, rawTrailerId: string) => {
    const trimmed = rawTrailerId.trim();
    if (!trimmed) {
      showToastNotice('Enter a YouTube video ID or URL', 'error');
      return;
    }
    try {
      const res = await adminFetch('/api/admin/trailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anilistId, trailerId: trimmed }),
      });
      if (!res.ok) throw new Error('Failed saving trailer override');
      setEditingTrailerId(null);
      setTrailerInput('');
      setCustomTrailerAnilistId('');
      setCustomTrailerCode('');
      await fetchOverview();
      showToastNotice(`Saved trailer override for AniList #${anilistId}`);
    } catch (err: any) {
      showToastNotice(err?.message || 'Trailer override failed', 'error');
    }
  };

  const handleRemoveTrailerOverride = async (anilistId: number) => {
    try {
      const res = await adminFetch(`/api/admin/trailers/${anilistId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed removing trailer override');
      await fetchOverview();
      showToastNotice(`Removed trailer override for AniList #${anilistId}`);
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed removing override', 'error');
    }
  };

  const handleClearServerCache = async () => {
    try {
      const res = await adminFetch('/api/admin/cache/clear', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Cache clear failed');
      await fetchOverview();
      showToastNotice('Server AniList/Jikan response cache cleared');
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed clearing cache', 'error');
    }
  };

  const handleClearServerLogs = async () => {
    try {
      const res = await adminFetch('/api/admin/logs/clear', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Log clear failed');
      await fetchOverview();
      showToastNotice('Server error logs cleared');
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed clearing logs', 'error');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFormError(null);
    const cleanUsername = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setCreateFormError('Username must be at least 3 alphanumeric/underscore characters.');
      return;
    }
    if (userAccounts.some((u) => u.username.toLowerCase() === cleanUsername)) {
      setCreateFormError(`Account @${cleanUsername} already exists.`);
      return;
    }
    if (!newDisplayName.trim()) {
      setCreateFormError('Display name is required.');
      return;
    }
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setCreateFormError('A valid email address is required.');
      return;
    }
    try {
      const created = await createUser({
        username: cleanUsername,
        displayName: newDisplayName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        status: newStatus,
        avatarUrl: '',
        bio: newBio.trim() || `${newRole.toUpperCase()} member on YORUMI.`,
        watchlistCount: 0,
      });
      showToastNotice(`Created account @${created.username}`);
      setShowCreateModal(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewEmail('');
      setNewRole('member');
      setNewStatus('active');
      setNewBio('');
    } catch (err: any) {
      setCreateFormError(err?.message || 'Failed to create account.');
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editDisplayName.trim()) {
      setEditFormError('Display name cannot be empty.');
      return;
    }
    try {
      await updateUser(editingUser.id, {
        displayName: editDisplayName.trim(),
        role: editRole,
        status: editStatus,
        bio: editBio.trim(),
      });
      showToastNotice(`Updated profile @${editingUser.username}`);
      setEditingUser(null);
      setEditFormError(null);
    } catch (err: any) {
      setEditFormError(err?.message || 'Failed to update account.');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!pendingDeleteUser) return;
    try {
      await deleteUser(pendingDeleteUser.id);
      showToastNotice(`Deleted account @${pendingDeleteUser.username}`);
      setPendingDeleteUser(null);
    } catch (err: any) {
      showToastNotice(err?.message || 'Failed deleting account', 'error');
      setPendingDeleteUser(null);
    }
  };

  const calculateLocalStorageBytes = (): number => {
    let total = 0;
    try {
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          total += (localStorage[key].length + key.length) * 2;
        }
      }
    } catch {
      return 0;
    }
    return total;
  };

  if (sessionLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
          <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
          <span>Checking administrator session...</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW A: SERVER-AUTHENTICATED ADMIN LOGIN GATE
  // -------------------------------------------------------------
  if (!isEffectiveAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-[#161321] rounded-2xl border border-[#2a243a] p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 p-0.5 mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.4)]">
              <div className="w-full h-full bg-[#0d0b14] rounded-[14px] flex items-center justify-center">
                <Lock className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <h1 className="font-display text-2xl font-black text-white tracking-tight">
              YORUMI <span className="brand-gradient-text">Admin Console</span>
            </h1>
            <p className="text-xs text-[#a1a1aa] font-sans">
              {passwordConfigured
                ? 'Server-verified httpOnly session required. Rate limited to 5 attempts per 15 minutes.'
                : 'No ADMIN_PASSWORD environment variable is set. Claim an initial runtime password to unlock.'}
            </p>
          </div>

          <form
            onSubmit={passwordConfigured ? handleLoginSubmit : handleBootstrapSubmit}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#fafafa] font-display">
                {passwordConfigured ? 'Administrator Password' : 'Set Runtime Admin Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Enter password..."
                  autoFocus
                  className="w-full bg-[#0d0b14] border border-[#2a243a] focus:border-purple-500/60 rounded-xl px-4 py-3 text-sm text-white placeholder-[#a1a1aa] outline-none font-sans transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-[#a1a1aa] hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!passwordConfigured && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#fafafa] font-display">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmBootstrapInput}
                  onChange={(e) => {
                    setConfirmBootstrapInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Confirm password (min 6 chars)..."
                  className="w-full bg-[#0d0b14] border border-[#2a243a] focus:border-purple-500/60 rounded-xl px-4 py-3 text-sm text-white placeholder-[#a1a1aa] outline-none font-sans transition-all"
                />
              </div>
            )}

            {authError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 font-sans">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-95 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all"
            >
              {authSubmitting
                ? 'Verifying...'
                : passwordConfigured
                ? 'Sign In to Admin'
                : 'Claim & Unlock Console'}
            </button>
          </form>

          <div className="pt-2 border-t border-[#2a243a] flex items-center justify-between text-xs text-[#a1a1aa]">
            <span className="font-mono text-[11px]">SameSite Cookie Session</span>
            {onNavigate && (
              <button
                onClick={() => onNavigate('home')}
                className="hover:text-white transition-colors flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Site
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: AUTHENTICATED ADMIN DASHBOARD
  // -------------------------------------------------------------
  const providers = overview?.providers || [];
  const apiUsage = overview?.apiUsage;
  const errorLogs = overview?.errorLogs || [];
  const airingTitles = overview?.airingTitles || [];
  const trailerOverrides = overview?.trailerOverrides || [];
  const overrideMap = new Map(trailerOverrides.map((t) => [t.anilistId, t]));
  const storageKb = (calculateLocalStorageBytes() / 1024).toFixed(1);

  const previewUrl = `/?previewRoute=${encodeURIComponent(previewRoute)}&animeId=${previewAnimeId}&ep=${previewEpisode}&embedPreview=1&_r=${previewNonce}`;

  const filteredUsers = userAccounts.filter((u) => {
    const q = userSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'all' || u.status === userStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#2a243a]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              <div className="w-full h-full bg-[#0d0b14] rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              YORUMI <span className="brand-gradient-text">Control Center</span>
            </h1>
          </div>
          <p className="text-xs text-[#a1a1aa]">
            Live site preview, provider health & ordering, schedule status, AniList/Jikan telemetry, and trailer overrides.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRunCatalogSync}
            disabled={syncingCatalog}
            className="flex items-center gap-2 px-4 py-2 bg-[#161321] hover:bg-[#201c2e] border border-purple-500/40 text-purple-200 text-xs font-bold rounded-full transition-all disabled:opacity-50"
          >
            <Database className={`w-3.5 h-3.5 text-purple-400 ${syncingCatalog ? 'animate-spin' : ''}`} />
            <span>{syncingCatalog ? 'Syncing...' : 'Run Sync Now'}</span>
          </button>

          <button
            onClick={fetchOverview}
            disabled={overviewLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#161321] hover:bg-[#201c2e] border border-[#2a243a] text-white text-xs font-semibold rounded-full transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${overviewLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            onClick={handleProbeAllProviders}
            disabled={probing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-full shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all"
          >
            <Wifi className={`w-3.5 h-3.5 ${probing ? 'animate-pulse' : ''}`} />
            <span>{probing ? 'Probing (4s)...' : 'Probe Providers'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-rose-400 text-xs font-semibold rounded-full transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            notice.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              : 'bg-purple-950/60 border-purple-500/40 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-[#a1a1aa] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#161321] rounded-2xl border border-[#2a243a] text-xs font-semibold">
        {[
          { id: 'overview', label: 'System Overview', icon: Activity },
          { id: 'providers', label: 'Providers & Failover', icon: Radio, count: providers.length },
          { id: 'airing', label: 'Airing & Trailers', icon: Tv, count: airingTitles.length },
          { id: 'preview', label: 'Live Site Preview', icon: Monitor },
          { id: 'logs', label: 'API Usage & Error Log', icon: Server, count: errorLogs.length },
          { id: 'users', label: 'Users & Storage', icon: Users, count: userAccounts.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                active
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow font-bold'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-[#0d0b14] text-purple-300 border border-[#2a243a]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SYSTEM OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Supabase get_admin_overview() KPI Cards */}
          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2a243a] pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                <h2 className="font-display font-bold text-white text-sm">
                  Supabase Catalog & Community Overview
                </h2>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                  overview?.supabase?.supabaseConfigured
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {overview?.supabase?.supabaseConfigured
                  ? 'SERVICE ROLE ACTIVE'
                  : 'SERVICE ROLE KEY UNSET'}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[11px] font-bold uppercase text-[#a1a1aa]">Series</div>
                <div className="text-2xl font-display font-black text-white mt-1 tabular-nums">
                  {overview?.supabase?.overviewStats?.series ?? 0}
                </div>
                <div className="text-[10px] text-purple-300 font-mono mt-0.5">Synced anime series</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[11px] font-bold uppercase text-[#a1a1aa]">Movies</div>
                <div className="text-2xl font-display font-black text-white mt-1 tabular-nums">
                  {overview?.supabase?.overviewStats?.movies ?? 0}
                </div>
                <div className="text-[10px] text-blue-300 font-mono mt-0.5">Theatrical & feature films</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[11px] font-bold uppercase text-[#a1a1aa]">Registered Users</div>
                <div className="text-2xl font-display font-black text-white mt-1 tabular-nums">
                  {overview?.supabase?.overviewStats?.registered_users ??
                    overview?.supabase?.overviewStats?.users ??
                    0}
                </div>
                <div className="text-[10px] text-emerald-300 font-mono mt-0.5">Supabase Auth profiles</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[11px] font-bold uppercase text-[#a1a1aa]">Verified Episodes</div>
                <div className="text-2xl font-display font-black text-white mt-1 tabular-nums">
                  {overview?.supabase?.overviewStats?.verified_episodes ?? 0}
                </div>
                <div className="text-[10px] text-amber-300 font-mono mt-0.5">Aired & confirmed</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-[#161321] rounded-xl border border-[#2a243a] space-y-1">
              <div className="flex items-center justify-between text-[#a1a1aa] text-[10px] font-bold uppercase">
                <span>Uptime</span>
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-white">
                {overview?.server.uptimeSeconds ?? 0}s
              </div>
              <div className="text-[10px] text-emerald-400 font-mono">
                {overview?.server.nodeVersion || 'Node'}
              </div>
            </div>

            <div className="p-4 bg-[#161321] rounded-xl border border-[#2a243a] space-y-1">
              <div className="flex items-center justify-between text-[#a1a1aa] text-[10px] font-bold uppercase">
                <span>Providers Online</span>
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                {providers.filter((p) => p.enabled && p.status !== 'offline').length} / {providers.length}
              </div>
              <div className="text-[10px] text-[#a1a1aa] font-mono">
                Kuroko env: {overview?.kurokoEnabled ? 'ON' : 'OFF'}
              </div>
            </div>

            <div className="p-4 bg-[#161321] rounded-xl border border-[#2a243a] space-y-1">
              <div className="flex items-center justify-between text-[#a1a1aa] text-[10px] font-bold uppercase">
                <span>AniList Calls</span>
                <Wifi className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-white">
                {apiUsage?.anilistRequests ?? 0}
              </div>
              <div className="text-[10px] text-[#a1a1aa] font-mono">
                Backoffs: {apiUsage?.rateLimitBackoffs ?? 0}
              </div>
            </div>

            <div className="p-4 bg-[#161321] rounded-xl border border-[#2a243a] space-y-1">
              <div className="flex items-center justify-between text-[#a1a1aa] text-[10px] font-bold uppercase">
                <span>Jikan Calls</span>
                <Server className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-white">
                {apiUsage?.jikanRequests ?? 0}
              </div>
              <div className="text-[10px] text-[#a1a1aa] font-mono">
                Fallback engine
              </div>
            </div>

            <div className="p-4 bg-[#161321] rounded-xl border border-[#2a243a] space-y-1">
              <div className="flex items-center justify-between text-[#a1a1aa] text-[10px] font-bold uppercase">
                <span>Cache Hits</span>
                <Layers className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-white">
                {apiUsage?.cacheHits ?? 0}
              </div>
              <div className="text-[10px] text-[#a1a1aa] font-mono">
                {apiUsage?.cachedKeys ?? 0} cached keys
              </div>
            </div>

            <div className="p-4 bg-[#161321] rounded-xl border border-[#2a243a] space-y-1">
              <div className="flex items-center justify-between text-[#a1a1aa] text-[10px] font-bold uppercase">
                <span>Heap / RSS</span>
                <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-white">
                {overview?.server.heapUsedMb ?? 0} MB
              </div>
              <div className="text-[10px] text-[#a1a1aa] font-mono">
                RSS: {overview?.server.rssMb ?? 0} MB
              </div>
            </div>
          </div>

          {/* Schedule Source Status & Quick Health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <h2 className="font-display font-bold text-white text-sm">Schedule Source Status</h2>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                    apiUsage?.lastScheduleOk
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {apiUsage?.lastScheduleOk ? 'SYNCED' : 'ERROR'}
                </span>
              </div>
              <div className="space-y-2 text-xs text-[#a1a1aa]">
                <div className="flex justify-between py-1 border-b border-[#2a243a]/40">
                  <span>Primary Schedule Source</span>
                  <span className="text-white font-mono">AniList GraphQL (Server Cached)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2a243a]/40">
                  <span>Fallback Metadata Source</span>
                  <span className="text-white font-mono">Jikan v4 REST</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2a243a]/40">
                  <span>Last Schedule Sync</span>
                  <span className="text-white font-mono">
                    {formatRelativeOrTime(apiUsage?.lastScheduleSyncAt ?? null)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Schedule Error</span>
                  <span className="text-rose-300 font-mono">
                    {apiUsage?.lastScheduleError || 'None'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-400" />
                  <h2 className="font-display font-bold text-white text-sm">Provider Priority Order</h2>
                </div>
                <button
                  onClick={() => setActiveTab('providers')}
                  className="text-xs text-purple-300 hover:text-white font-semibold"
                >
                  Manage →
                </button>
              </div>
              <div className="space-y-2">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d0b14] border border-[#2a243a] text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-[#161321] border border-[#2a243a] font-mono text-[10px] text-purple-300">
                        P{p.priority}
                      </span>
                      <span className="font-bold text-white">{p.name}</span>
                      {!p.enabled && (
                        <span className="text-[10px] font-mono text-zinc-400">(Disabled)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-[#a1a1aa]">
                        {p.latencyMs !== null ? `${p.latencyMs}ms` : '—'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                          p.status === 'healthy'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : p.status === 'offline'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sync Runs & Analytics Events Summaries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
                <h2 className="font-display font-bold text-white text-sm">
                  Recent Catalog Sync Runs
                </h2>
                <button
                  onClick={handleRunCatalogSync}
                  disabled={syncingCatalog}
                  className="px-3 py-1 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-200 text-[11px] font-bold hover:text-white disabled:opacity-50"
                >
                  {syncingCatalog ? 'Running...' : 'Trigger Sync'}
                </button>
              </div>
              {(!overview?.supabase?.syncRuns || overview.supabase.syncRuns.length === 0) ? (
                <div className="p-6 text-center text-xs text-[#a1a1aa] bg-[#0d0b14] rounded-xl border border-[#2a243a]">
                  {overview?.supabase?.supabaseConfigured
                    ? 'No sync_runs recorded yet. Click Trigger Sync to populate.'
                    : 'Configure server database service credentials to enable sync_runs persistence.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {overview.supabase.syncRuns.map((run, idx) => (
                    <div
                      key={run.id ?? idx}
                      className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                              run.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {run.status}
                          </span>
                          <span className="text-white font-mono">
                            {run.items_fetched} fetched · {run.items_playable} playable · {run.pages_fetched}p
                          </span>
                        </div>
                        {run.error && <div className="text-[11px] text-rose-300">{run.error}</div>}
                      </div>
                      <span className="text-[10px] font-mono text-[#a1a1aa] shrink-0">
                        {run.started_at ? new Date(run.started_at).toLocaleTimeString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
                <h2 className="font-display font-bold text-white text-sm">
                  Analytics Events Summary
                </h2>
                <span className="text-xs font-mono text-purple-300">
                  {overview?.supabase?.analyticsSummary?.totalEvents ?? 0} recent events
                </span>
              </div>
              {Object.keys(overview?.supabase?.analyticsSummary?.byEvent || {}).length === 0 ? (
                <div className="p-6 text-center text-xs text-[#a1a1aa] bg-[#0d0b14] rounded-xl border border-[#2a243a]">
                  No analytics events recorded yet. Events populate automatically as users watch episodes and switch providers.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(overview?.supabase?.analyticsSummary?.byEvent || {}).map(
                    ([eventName, count]) => (
                      <div
                        key={eventName}
                        className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a] flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-[#fafafa] truncate">{eventName}</span>
                        <span className="font-mono font-bold text-purple-300 tabular-nums">{count}</span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROVIDERS & FAILOVER */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2a243a] pb-4">
              <div>
                <h2 className="font-display font-bold text-white text-base">
                  Stream Provider Health & Runtime Ordering
                </h2>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  Auto mode runs 4s server-side checks in priority order and fails over on 8s iframe load timeouts.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="number"
                  value={probeAnimeId}
                  onChange={(e) => setProbeAnimeId(Math.max(1, parseInt(e.target.value, 10) || 21))}
                  className="w-24 bg-[#0d0b14] border border-[#2a243a] rounded-lg px-2.5 py-1.5 text-white font-mono"
                  placeholder="AniList ID"
                />
                <input
                  type="number"
                  value={probeEpisode}
                  onChange={(e) => setProbeEpisode(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 bg-[#0d0b14] border border-[#2a243a] rounded-lg px-2.5 py-1.5 text-white font-mono"
                  placeholder="Ep"
                />
                <select
                  value={probeLang}
                  onChange={(e) => setProbeLang(e.target.value as 'sub' | 'dub')}
                  className="bg-[#0d0b14] border border-[#2a243a] rounded-lg px-2.5 py-1.5 text-white font-mono"
                >
                  <option value="sub">SUB</option>
                  <option value="dub">DUB</option>
                </select>
                <button
                  onClick={handleProbeAllProviders}
                  disabled={probing}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {probing ? 'Running 4s Probe...' : 'Run Probe'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#2a243a] text-[#a1a1aa] font-display uppercase text-[10px]">
                    <th className="py-2.5 px-3">Order</th>
                    <th className="py-2.5 px-3">Provider</th>
                    <th className="py-2.5 px-3">Health Status</th>
                    <th className="py-2.5 px-3">Latency</th>
                    <th className="py-2.5 px-3">Checks (OK / Fail)</th>
                    <th className="py-2.5 px-3">Last Failure</th>
                    <th className="py-2.5 px-3 text-right">Runtime Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a243a]/50">
                  {providers.map((p, index) => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={priorityDrafts[p.id] ?? p.priority}
                            onChange={(e) =>
                              setPriorityDrafts((prev) => ({
                                ...prev,
                                [p.id]: Math.max(1, parseInt(e.target.value, 10) || 1),
                              }))
                            }
                            className="w-14 bg-[#0d0b14] border border-[#2a243a] rounded px-2 py-0.5 text-purple-300 font-bold text-center outline-none focus:border-purple-500/60"
                            aria-label={`${p.name} priority`}
                          />
                          <button
                            onClick={() => handleSaveProviderPriority(p.id)}
                            className="px-2 py-0.5 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 text-[10px] font-bold border border-purple-500/30"
                            title="Save Priority"
                          >
                            Set
                          </button>
                          <button
                            onClick={() => handleMoveProvider(index, -1)}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-[#201c2e] text-[#a1a1aa] hover:text-white disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveProvider(index, 1)}
                            disabled={index === providers.length - 1}
                            className="p-1 rounded hover:bg-[#201c2e] text-[#a1a1aa] hover:text-white disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white font-display">{p.name}</div>
                        <div className="text-[10px] font-mono text-[#a1a1aa]">
                          id: {p.id} · {p.supportsDub ? 'SUB + DUB' : 'SUB only'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase border ${
                            !p.enabled
                              ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                              : p.status === 'healthy'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : p.status === 'offline'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {p.status === 'healthy' && p.enabled ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : p.status === 'offline' ? (
                            <XCircle className="w-3 h-3" />
                          ) : null}
                          {p.enabled ? p.status : 'disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-white">
                        {p.latencyMs !== null ? `${p.latencyMs} ms` : '—'}
                        <div className="text-[10px] text-[#a1a1aa]">
                          Checked: {formatRelativeOrTime(p.lastChecked)}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums">
                        <span className="text-emerald-400">{p.successCount}</span>
                        <span className="text-[#a1a1aa]"> / </span>
                        <span className="text-rose-400">{p.failureCount}</span>
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        {p.lastFailureReason ? (
                          <div>
                            <div className="text-rose-300 font-medium">{p.lastFailureReason}</div>
                            <div className="text-[10px] font-mono text-[#a1a1aa]">
                              {formatRelativeOrTime(p.lastFailureAt)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#a1a1aa]">No recorded failures</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleToggleProvider(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                            p.enabled
                              ? 'bg-emerald-500/10 hover:bg-rose-500/15 text-emerald-300 hover:text-rose-300 border-emerald-500/30 hover:border-rose-500/30'
                              : 'bg-zinc-800 hover:bg-emerald-500/15 text-zinc-300 hover:text-emerald-300 border-zinc-700 hover:border-emerald-500/30'
                          }`}
                        >
                          {p.enabled ? 'Enabled (Click to Disable)' : 'Disabled (Click to Enable)'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supabase provider_health log */}
          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
              <h3 className="font-display font-bold text-white text-sm">
                Supabase Provider Health Log (provider_health)
              </h3>
              <span className="text-xs font-mono text-[#a1a1aa]">
                {overview?.supabase?.providerHealthHistory?.length ?? 0} recent checks
              </span>
            </div>
            {(!overview?.supabase?.providerHealthHistory ||
              overview.supabase.providerHealthHistory.length === 0) ? (
              <div className="p-6 text-center text-xs text-[#a1a1aa] bg-[#0d0b14] rounded-xl border border-[#2a243a]">
                No logged checks in provider_health yet. Click Run Probe above to record checks.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#2a243a] text-[#a1a1aa] uppercase text-[10px]">
                      <th className="py-2 px-3">Provider</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Latency</th>
                      <th className="py-2 px-3">Error</th>
                      <th className="py-2 px-3">Checked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a243a]/50 font-mono">
                    {overview.supabase.providerHealthHistory.map((row, idx) => (
                      <tr key={row.id ?? idx}>
                        <td className="py-2 px-3 text-white font-bold">{row.provider_id}</td>
                        <td className="py-2 px-3">{row.status}</td>
                        <td className="py-2 px-3">{row.latency_ms !== null && row.latency_ms !== undefined ? `${row.latency_ms} ms` : '—'}</td>
                        <td className="py-2 px-3 text-rose-300">{row.last_error || '—'}</td>
                        <td className="py-2 px-3 text-[#a1a1aa]">
                          {row.checked_at ? new Date(row.checked_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AIRING TITLES & TRAILER OVERRIDES */}
      {activeTab === 'airing' && (
        <div className="space-y-6">
          {/* Manual Override Form */}
          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#2a243a] pb-3">
              <Film className="w-4 h-4 text-purple-400" />
              <h2 className="font-display font-bold text-white text-sm">
                Add / Override Trailer by AniList ID
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                value={customTrailerAnilistId}
                onChange={(e) => setCustomTrailerAnilistId(e.target.value)}
                placeholder="AniList ID (e.g. 21)"
                className="sm:w-44 bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3.5 py-2 text-xs text-white font-mono outline-none focus:border-purple-500/50"
              />
              <input
                type="text"
                value={customTrailerCode}
                onChange={(e) => setCustomTrailerCode(e.target.value)}
                placeholder="YouTube Video ID or URL (e.g. dQw4w9WgXcQ or https://youtu.be/...)"
                className="flex-1 bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3.5 py-2 text-xs text-white font-mono outline-none focus:border-purple-500/50"
              />
              <button
                onClick={() => {
                  const id = parseInt(customTrailerAnilistId, 10);
                  if (!Number.isFinite(id) || id <= 0) {
                    showToastNotice('Enter a valid positive AniList ID', 'error');
                    return;
                  }
                  handleSaveTrailerOverride(id, customTrailerCode);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold hover:opacity-90"
              >
                Save Override
              </button>
            </div>
          </div>

          {/* Airing Titles Table */}
          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
              <h2 className="font-display font-bold text-white text-sm">
                Currently Airing Titles & Aired-Episode Counts
              </h2>
              <span className="text-xs font-mono text-[#a1a1aa]">
                {airingTitles.length} active · {trailerOverrides.length} custom overrides
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#2a243a] text-[#a1a1aa] font-display uppercase text-[10px]">
                    <th className="py-2.5 px-3">AniList ID</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Aired / Total</th>
                    <th className="py-2.5 px-3">Next Episode</th>
                    <th className="py-2.5 px-3">Trailer</th>
                    <th className="py-2.5 px-3 text-right">Visibility & Trailer Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a243a]/50">
                  {airingTitles.map((item) => {
                    const hasOverride = overrideMap.has(item.id);
                    const isEditing = editingTrailerId === item.id;
                    const isHidden = Boolean(item.hidden);
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-mono text-purple-300">#{item.id}</td>
                        <td className="py-3 px-3 font-semibold text-white max-w-xs truncate">
                          {item.title}
                          {isHidden && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-[10px] font-mono text-rose-300">
                              HIDDEN
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums">
                          <span className="text-emerald-400 font-bold">{item.airedEpisodes}</span>
                          <span className="text-[#a1a1aa]"> / {item.totalEpisodes ?? 'Unknown'}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[#a1a1aa]">
                          {item.nextEpisode
                            ? `EP ${item.nextEpisode} (${formatCountdownShort(item.nextAiringAt)})`
                            : 'TBA'}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {item.trailer?.id ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] border ${
                                hasOverride
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                              }`}
                            >
                              {item.trailer.id} {hasOverride ? '(Override)' : ''}
                            </span>
                          ) : (
                            <span className="text-zinc-500">None</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                type="text"
                                value={trailerInput}
                                onChange={(e) => setTrailerInput(e.target.value)}
                                placeholder="YouTube ID / URL"
                                className="w-36 bg-[#0d0b14] border border-purple-500/50 rounded-lg px-2 py-1 text-[11px] text-white font-mono outline-none"
                              />
                              <button
                                onClick={() => handleSaveTrailerOverride(item.id, trailerInput)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTrailerId(null);
                                  setTrailerInput('');
                                }}
                                className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleToggleAnimeVisibility(item.id, isHidden)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 ${
                                  isHidden
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : 'bg-[#0d0b14] border-[#2a243a] text-[#a1a1aa] hover:text-white'
                                }`}
                              >
                                {isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                <span>{isHidden ? 'Show' : 'Hide'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTrailerId(item.id);
                                  setTrailerInput(item.trailer?.id || '');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#0d0b14] border border-[#2a243a] hover:border-purple-500/40 text-[#a1a1aa] hover:text-white text-[11px] font-semibold"
                              >
                                Override
                              </button>
                              {hasOverride && (
                                <button
                                  onClick={() => handleRemoveTrailerOverride(item.id)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-[11px]"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supabase Synced Catalog Visibility Table */}
          {overview?.supabase?.catalogTitles && overview.supabase.catalogTitles.length > 0 && (
            <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
                <h2 className="font-display font-bold text-white text-sm">
                  Synced Supabase Catalog (Hide / Show Titles)
                </h2>
                <span className="text-xs font-mono text-[#a1a1aa]">
                  {overview.supabase.catalogTitles.length} rows
                </span>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#2a243a] text-[#a1a1aa] uppercase text-[10px]">
                      <th className="py-2 px-3">ID</th>
                      <th className="py-2 px-3">Title</th>
                      <th className="py-2 px-3">Format / Status</th>
                      <th className="py-2 px-3">Visibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a243a]/50">
                    {overview.supabase.catalogTitles.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 px-3 font-mono text-purple-300">#{row.id}</td>
                        <td className="py-2 px-3 text-white font-semibold">{row.title}</td>
                        <td className="py-2 px-3 text-[#a1a1aa] font-mono">
                          {row.format || 'TV'} · {row.status || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => handleToggleAnimeVisibility(row.id, row.hidden)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 ${
                              row.hidden
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            }`}
                          >
                            {row.hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            <span>{row.hidden ? 'Hidden (Click to Show)' : 'Visible (Click to Hide)'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE SITE PREVIEW (EVERY PAGE) */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {PREVIEW_PAGES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreviewRoute(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    previewRoute === p.id
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                      : 'bg-[#0d0b14] text-[#a1a1aa] hover:text-white border border-[#2a243a]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(previewRoute === 'details' || previewRoute === 'watch') && (
                <>
                  <input
                    type="number"
                    value={previewAnimeId}
                    onChange={(e) =>
                      setPreviewAnimeId(Math.max(1, parseInt(e.target.value, 10) || 21))
                    }
                    className="w-20 bg-[#0d0b14] border border-[#2a243a] rounded-lg px-2 py-1.5 text-white font-mono"
                    title="AniList ID"
                  />
                  {previewRoute === 'watch' && (
                    <input
                      type="number"
                      value={previewEpisode}
                      onChange={(e) =>
                        setPreviewEpisode(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-16 bg-[#0d0b14] border border-[#2a243a] rounded-lg px-2 py-1.5 text-white font-mono"
                      title="Episode"
                    />
                  )}
                </>
              )}

              <div className="flex items-center rounded-lg bg-[#0d0b14] border border-[#2a243a] p-0.5">
                <button
                  onClick={() => setPreviewViewport('desktop')}
                  className={`p-1.5 rounded-md ${
                    previewViewport === 'desktop' ? 'bg-purple-600 text-white' : 'text-[#a1a1aa]'
                  }`}
                  title="Desktop Viewport"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPreviewViewport('mobile')}
                  className={`p-1.5 rounded-md ${
                    previewViewport === 'mobile' ? 'bg-purple-600 text-white' : 'text-[#a1a1aa]'
                  }`}
                  title="Mobile Viewport (390px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setPreviewNonce((n) => n + 1)}
                className="px-3 py-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa] hover:text-white flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>

              {onNavigate && previewRoute !== 'details' && previewRoute !== 'watch' && (
                <button
                  onClick={() => onNavigate(previewRoute)}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-200 hover:text-white flex items-center gap-1.5 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Navigate</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-[#0d0b14] rounded-2xl border border-[#2a243a] p-4 flex justify-center overflow-hidden">
            <iframe
              key={previewUrl}
              src={previewUrl}
              title={`YORUMI Live Preview (${previewRoute})`}
              className={`h-[700px] rounded-xl border border-[#2a243a] bg-[#0B0914] transition-all ${
                previewViewport === 'mobile' ? 'w-[390px]' : 'w-full'
              }`}
            />
          </div>
        </div>
      )}

      {/* TAB 5: API USAGE & SERVER ERROR LOG */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
              <h2 className="font-display font-bold text-white text-sm">
                External API Telemetry & Cache Controls
              </h2>
              <button
                onClick={handleClearServerCache}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] hover:border-purple-500/40 text-xs font-semibold text-white"
              >
                <Trash2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Clear Server Cache</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[#a1a1aa]">AniList Requests</div>
                <div className="text-lg font-mono font-bold text-white mt-1">
                  {apiUsage?.anilistRequests ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[#a1a1aa]">Jikan Requests</div>
                <div className="text-lg font-mono font-bold text-white mt-1">
                  {apiUsage?.jikanRequests ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[#a1a1aa]">Cache Hits</div>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                  {apiUsage?.cacheHits ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[#a1a1aa]">Cache Misses</div>
                <div className="text-lg font-mono font-bold text-amber-300 mt-1">
                  {apiUsage?.cacheMisses ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[#a1a1aa]">Cached Entries</div>
                <div className="text-lg font-mono font-bold text-white mt-1">
                  {apiUsage?.cachedKeys ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a]">
                <div className="text-[#a1a1aa]">Rate-Limit Backoffs</div>
                <div className="text-lg font-mono font-bold text-rose-400 mt-1">
                  {apiUsage?.rateLimitBackoffs ?? 0}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
              <h2 className="font-display font-bold text-white text-sm">
                Server Error Log ({errorLogs.length})
              </h2>
              <button
                onClick={handleClearServerLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] hover:border-rose-500/40 text-xs font-semibold text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            </div>

            {errorLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#a1a1aa] bg-[#0d0b14] rounded-xl border border-[#2a243a]">
                No server errors recorded in this runtime window.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {errorLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[#0d0b14] border border-[#2a243a] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-[10px] shrink-0">
                        {log.service}
                      </span>
                      <span className="text-white break-words">{log.message}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-[#a1a1aa] shrink-0">
                      {log.statusCode && <span>HTTP {log.statusCode}</span>}
                      <span>{formatRelativeOrTime(log.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: USERS & CLIENT STORAGE */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Active Session + Firebase Sync */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#161321] p-5 rounded-2xl border border-[#2a243a] space-y-3">
              <div className="flex items-center justify-between border-b border-[#2a243a] pb-2.5">
                <span className="font-display font-bold text-white text-sm">Active Profile</span>
                <span className="text-[11px] font-mono text-[#a1a1aa]">
                  Firebase: {firebaseConnected ? 'Connected' : 'Local Fallback'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {getSafeExternalUrl(currentUser?.avatarUrl) ? (
                    <img
                      src={getSafeExternalUrl(currentUser?.avatarUrl)!}
                      alt={currentUser.displayName}
                      className="w-10 h-10 rounded-full object-cover border border-purple-500/50"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-purple-300" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-white text-sm">{currentUser?.displayName}</div>
                    <div className="text-xs font-mono text-[#a1a1aa]">
                      @{currentUser?.username} · {currentUser?.role}
                    </div>
                  </div>
                </div>
                {firebaseUser ? (
                  <button
                    onClick={signOutGoogle}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-semibold"
                  >
                    Sign Out Google
                  </button>
                ) : (
                  <button
                    onClick={signInGoogle}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold"
                  >
                    Sign In Google
                  </button>
                )}
              </div>
            </div>

            <div className="bg-[#161321] p-5 rounded-2xl border border-[#2a243a] space-y-3">
              <div className="flex items-center justify-between border-b border-[#2a243a] pb-2.5">
                <span className="font-display font-bold text-white text-sm">Client Storage Quota</span>
                <Database className="w-4 h-4 text-purple-400" />
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-[#0d0b14] border border-[#2a243a]">
                  <div className="text-[#a1a1aa] text-[10px]">Watchlist</div>
                  <div className="font-mono font-bold text-white">{watchlist.length}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0d0b14] border border-[#2a243a]">
                  <div className="text-[#a1a1aa] text-[10px]">Favorites</div>
                  <div className="font-mono font-bold text-white">{favorites.length}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0d0b14] border border-[#2a243a]">
                  <div className="text-[#a1a1aa] text-[10px]">History</div>
                  <div className="font-mono font-bold text-white">{history.length}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0d0b14] border border-[#2a243a]">
                  <div className="text-[#a1a1aa] text-[10px]">Size</div>
                  <div className="font-mono font-bold text-white">{storageKb} KB</div>
                </div>
              </div>
              <button
                onClick={() => {
                  clearHistory();
                  showToastNotice('Local watch history cleared');
                }}
                className="text-xs text-rose-300 hover:text-rose-200 font-semibold"
              >
                Clear Local Watch History
              </button>
            </div>
          </div>

          {/* Account Controls & Directory */}
          <div className="bg-[#161321] rounded-2xl border border-[#2a243a] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2a243a] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="bg-[#0d0b14] border border-[#2a243a] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value as any)}
                  className="bg-[#0d0b14] border border-[#2a243a] rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="vip">VIP</option>
                  <option value="member">Member</option>
                </select>
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value as any)}
                  className="bg-[#0d0b14] border border-[#2a243a] rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#a1a1aa]">
                No user accounts match the current filter.
              </div>
            ) : (
              <div className="divide-y divide-[#2a243a]/50">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center font-bold text-purple-300">
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{u.displayName}</span>
                          <span className="px-2 py-0.5 rounded bg-[#0d0b14] border border-[#2a243a] font-mono text-[10px] uppercase text-purple-300">
                            {u.role}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase ${
                              u.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : 'bg-rose-500/10 text-rose-300'
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#a1a1aa]">
                          @{u.username} · {u.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          switchUser(u.id);
                          showToastNotice(`Switched active profile to @${u.username}`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa] hover:text-white"
                      >
                        Switch
                      </button>
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setEditDisplayName(u.displayName);
                          setEditRole(u.role);
                          setEditStatus(u.status);
                          setEditBio(u.bio || '');
                          setEditFormError(null);
                        }}
                        className="p-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa] hover:text-white"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPendingDeleteUser(u)}
                        className="p-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-rose-400 hover:bg-rose-950/30"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161321] border border-[#2a243a] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
              <h3 className="font-display font-bold text-white text-base">Create Account</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[#a1a1aa] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateUserSubmit} className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Username (alphanumeric)"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
              <input
                type="text"
                placeholder="Display Name"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3 py-2 text-white"
                >
                  <option value="member">Member</option>
                  <option value="vip">VIP</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                  className="bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3 py-2 text-white"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <textarea
                placeholder="Bio (optional)"
                value={newBio}
                onChange={(e) => setNewBio(e.target.value)}
                rows={2}
                className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3.5 py-2 text-white outline-none"
              />
              {createFormError && (
                <div className="text-rose-300 text-xs">{createFormError}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161321] border border-[#2a243a] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
              <h3 className="font-display font-bold text-white text-base">
                Edit @{editingUser.username}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-[#a1a1aa] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs">
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3 py-2 text-white"
                >
                  <option value="member">Member</option>
                  <option value="vip">VIP</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3 py-2 text-white"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={2}
                className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3.5 py-2 text-white outline-none"
              />
              {editFormError && <div className="text-rose-300">{editFormError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (replaces window.confirm) */}
      {pendingDeleteUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161321] border border-rose-500/30 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-display font-bold text-white text-base">Confirm Account Deletion</h3>
            <p className="text-xs text-[#a1a1aa]">
              Permanently delete @{pendingDeleteUser.username} ({pendingDeleteUser.displayName})?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDeleteUser(null)}
                className="px-4 py-2 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
