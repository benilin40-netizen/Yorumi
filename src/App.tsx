import React, { useState, useEffect, useCallback } from 'react';
import { MotionConfig, AnimatePresence, motion } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { Navbar } from './components/navigation/Navbar';
import { AuthModal } from './components/auth/AuthModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { Footer } from './components/layout/Footer';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

// Pages
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { Trending } from './pages/Trending';
import { Seasonal } from './pages/Seasonal';
import { Movies } from './pages/Movies';
import { Upcoming } from './pages/Upcoming';
import { Schedule } from './pages/Schedule';
import { Watch } from './pages/Watch';
import { AnimeDetails } from './pages/AnimeDetails';
import { Watchlist } from './pages/Watchlist';
import { History } from './pages/History';
import { Admin } from './pages/Admin';

interface ParsedLocation {
  route: string;
  animeId: number | null;
  episode: number;
}

const VALID_STATIC_ROUTES = new Set([
  'home',
  'discover',
  'trending',
  'seasonal',
  'movies',
  'upcoming',
  'schedule',
  'watchlist',
  'mylist',
  'history',
  'admin',
]);

function parseLocationRoute(): ParsedLocation {
  if (typeof window === 'undefined') {
    return { route: 'home', animeId: null, episode: 1 };
  }

  const params = new URLSearchParams(window.location.search);
  const previewRoute = params.get('previewRoute');
  const paramAnimeId = parseInt(params.get('animeId') || '', 10);
  const paramEp = Math.max(1, parseInt(params.get('ep') || '1', 10) || 1);

  if (previewRoute) {
    if (previewRoute === 'details' || previewRoute === 'watch') {
      return {
        route: previewRoute,
        animeId: Number.isFinite(paramAnimeId) && paramAnimeId > 0 ? paramAnimeId : 21,
        episode: paramEp,
      };
    }
    if (VALID_STATIC_ROUTES.has(previewRoute)) {
      return { route: previewRoute, animeId: null, episode: 1 };
    }
  }

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/') {
    return { route: 'home', animeId: null, episode: 1 };
  }

  const parts = pathname.split('/').filter(Boolean);
  const head = parts[0]?.toLowerCase() || 'home';

  if (head === 'anime' && parts[1]) {
    const id = parseInt(parts[1], 10);
    if (Number.isFinite(id) && id > 0) {
      return { route: 'details', animeId: id, episode: 1 };
    }
  }

  if (head === 'watch' && parts[1]) {
    const id = parseInt(parts[1], 10);
    const ep = Math.max(1, parseInt(parts[2] || '1', 10) || 1);
    if (Number.isFinite(id) && id > 0) {
      return { route: 'watch', animeId: id, episode: ep };
    }
  }

  if (head === 'mylist' || head === 'watchlist') {
    return { route: 'watchlist', animeId: null, episode: 1 };
  }

  if (VALID_STATIC_ROUTES.has(head)) {
    return { route: head, animeId: null, episode: 1 };
  }

  return { route: 'home', animeId: null, episode: 1 };
}

function buildPathForRoute(route: string, animeId?: number | null, episode: number = 1): string {
  if (route === 'home') return '/';
  if (route === 'watchlist') return '/mylist';
  if (route === 'details' && animeId) return `/anime/${animeId}`;
  if (route === 'watch' && animeId) return `/watch/${animeId}/${episode}`;
  return `/${route}`;
}

export function AppContent() {
  const initial = parseLocationRoute();
  const [currentRoute, setCurrentRoute] = useState<string>(initial.route);
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(initial.animeId);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initial.episode);
  const [searchOpen, setSearchOpen] = useState(false);
  const { supabaseError, clearSupabaseError } = useAuth();
  const { supabaseToast, dismissSupabaseToast } = useUser();

  // Sync URL back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseLocationRoute();
      setCurrentRoute(parsed.route);
      setSelectedAnimeId(parsed.animeId);
      setSelectedEpisode(parsed.episode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pushUrlIfChanged = useCallback((nextPath: string) => {
    if (typeof window === 'undefined') return;
    const isEmbed = new URLSearchParams(window.location.search).get('embedPreview') === '1';
    if (isEmbed) return;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  }, []);

  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    pushUrlIfChanged(buildPathForRoute(route));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAnime = (id: number) => {
    setSelectedAnimeId(id);
    setCurrentRoute('details');
    pushUrlIfChanged(buildPathForRoute('details', id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWatchAnime = (id: number, episode: number = 1) => {
    setSelectedAnimeId(id);
    setSelectedEpisode(episode);
    setCurrentRoute('watch');
    pushUrlIfChanged(buildPathForRoute('watch', id, episode));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderCurrentPage = () => {
    switch (currentRoute) {
      case 'home':
        return (
          <Home
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
            onNavigate={handleNavigate}
          />
        );
      case 'discover':
        return (
          <Discover
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
          />
        );
      case 'trending':
        return (
          <Trending
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
          />
        );
      case 'seasonal':
        return (
          <Seasonal
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
          />
        );
      case 'movies':
        return (
          <Movies
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
          />
        );
      case 'upcoming':
        return (
          <Upcoming
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
          />
        );
      case 'schedule':
        return (
          <Schedule
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
          />
        );
      case 'watch':
        return selectedAnimeId ? (
          <Watch
            animeId={selectedAnimeId}
            initialEpisode={selectedEpisode}
            onSelectAnime={handleSelectAnime}
            onNavigateBack={() => handleNavigate('home')}
          />
        ) : (
          <Home
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
            onNavigate={handleNavigate}
          />
        );
      case 'details':
        return selectedAnimeId ? (
          <AnimeDetails
            animeId={selectedAnimeId}
            onWatchAnime={handleWatchAnime}
            onSelectAnime={handleSelectAnime}
            onNavigateBack={() => handleNavigate('home')}
          />
        ) : (
          <Home
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
            onNavigate={handleNavigate}
          />
        );
      case 'watchlist':
        return (
          <Watchlist
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
          />
        );
      case 'history':
        return (
          <History
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
          />
        );
      case 'admin':
        return <Admin onNavigate={handleNavigate} />;
      default:
        return (
          <Home
            onSelectAnime={handleSelectAnime}
            onWatchAnime={handleWatchAnime}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  const pageKey = `${currentRoute}:${selectedAnimeId ?? ''}:${selectedEpisode}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0914] text-slate-100 font-sans selection:bg-violet-600 selection:text-white">
      {/* Top Navbar (includes slim Admin bar when authenticated) */}
      <Navbar
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Main Page View with Smooth Transitions */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={pageKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {renderCurrentPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

      {/* Supabase Auth Modal */}
      <AuthModal />

      {/* Global Search Overlay Modal */}
      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectAnime={handleSelectAnime}
        onWatchAnime={handleWatchAnime}
      />

      {/* Graceful Supabase Error Toast with Retry */}
      {(supabaseToast || supabaseError) && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-md bg-[#161321]/95 backdrop-blur-md border border-rose-500/40 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 text-xs text-rose-100"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="flex-1">{supabaseToast?.message || supabaseError}</span>
          {supabaseToast?.retry && (
            <button
              onClick={() => {
                const retryFn = supabaseToast.retry;
                dismissSupabaseToast();
                retryFn?.();
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
          <button
            onClick={() => {
              dismissSupabaseToast();
              clearSupabaseError();
            }}
            className="text-[#a1a1aa] hover:text-white p-1"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
