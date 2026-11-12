import React, { useState, useEffect } from 'react';
import { UserProvider } from './contexts/UserContext';
import { Navbar } from './components/navigation/Navbar';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { Footer } from './components/layout/Footer';
import { ApiStatusMonitor } from './components/common/ApiStatusMonitor';
import { Login } from './pages/Login';
import { useUser } from './contexts/UserContext';

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

export function AppContent() {
  const { currentUser, isFirebaseLoading } = useUser();
  const [currentRoute, setCurrentRoute] = useState<string>('home');
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [searchOpen, setSearchOpen] = useState(false);

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

  if (isFirebaseLoading) {
    return <div className="min-h-screen bg-[#0d0b14] flex items-center justify-center text-white">Loading...</div>;
  }

  if (currentUser.id === 'guest') {
    return <Login />;
  }


  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAnime = (id: number) => {
    setSelectedAnimeId(id);
    setCurrentRoute('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWatchAnime = (id: number, episode: number = 1) => {
    setSelectedAnimeId(id);
    setSelectedEpisode(episode);
    setCurrentRoute('watch');
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
        if (currentUser.role !== 'admin' && currentUser.email !== 'benilin40@gmail.com') {
          return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                <span className="text-rose-400 text-xl font-bold font-mono">403</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2 font-display">Access Restricted</h2>
              <p className="text-xs text-zinc-400 max-w-sm mb-5 leading-relaxed">
                The Yorumi Administrator Control Center is restricted to verified system administrators.
              </p>
              <button
                onClick={() => handleNavigate('home')}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 text-white rounded-full text-xs font-bold shadow transition-all"
              >
                Return to Home
              </button>
            </div>
          );
        }
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

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0914] text-slate-100 font-sans selection:bg-violet-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        onOpenSearch={() => setSearchOpen(true)}
        onSelectAnime={handleSelectAnime}
        onWatchAnime={handleWatchAnime}
      />

      {/* Main Page View */}
      <main className="flex-1">{renderCurrentPage()}</main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

      {/* Global Search Overlay Modal */}
      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectAnime={handleSelectAnime}
        onWatchAnime={handleWatchAnime}
      />
      
      <ApiStatusMonitor />
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
