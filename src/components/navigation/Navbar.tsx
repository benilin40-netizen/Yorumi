import React, { useState } from 'react';
import {
  Sparkles,
  Compass,
  TrendingUp,
  Calendar,
  Film,
  Clock,
  Bookmark,
  History,
  Search,
  Bell,
  User,
  Settings,
  Menu,
  X,
  LogIn,
  LogOut,
  UserPlus,
} from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { AuthModal } from '../auth/AuthModal';
import { NotificationCenterModal } from '../common/NotificationCenterModal';
import { getUserInitials } from '../../utils/userAvatar';

export interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenSearch: () => void;
  onSelectAnime?: (id: number) => void;
  onWatchAnime?: (id: number, episode?: number) => void;
}

export const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Sparkles },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'seasonal', label: 'Seasonal', icon: Calendar },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'upcoming', label: 'Upcoming', icon: Clock },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'history', label: 'History', icon: History },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  onOpenSearch,
  onSelectAnime,
  onWatchAnime,
}) => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    currentUser,
    signOutUser,
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalMode,
    openAuthModal,
  } = useUser();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoggedIn = currentUser && currentUser.id !== 'guest';

  return (
    <>
      <header className="sticky top-0 z-40 w-full h-16 glass-nav px-4 lg:px-8 flex items-center justify-between gap-6 border-b border-[#2a243a]">
        {/* Zone 1: Logo & Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 text-left group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)] group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0d0b14] rounded-[10px] flex items-center justify-center">
                <span className="font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 text-base">
                  Y
                </span>
              </div>
            </div>
            <span className="font-display font-extrabold text-lg tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-300 to-blue-400 group-hover:opacity-90 transition-opacity">
              YORUMI
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden xl:flex items-center gap-6 text-sm font-medium">
          {NAV_ITEMS.map((item) => {
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`whitespace-nowrap transition-colors py-1 relative font-sans ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-[#a1a1aa] hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions (Search, Notifications, Account Brand Gradient Pill) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Quick Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161321] border border-[#2a243a] text-[#a1a1aa] hover:text-white hover:border-purple-500/40 text-xs transition-all"
          >
            <Search className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[#0d0b14] rounded-full border border-[#2a243a] text-purple-300">
              Ctrl+K
            </kbd>
          </button>

          {/* Notifications Popover & Advanced Centre */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotificationModal(true);
                setShowProfileMenu(false);
              }}
              className="p-2 rounded-full bg-[#161321] border border-[#2a243a] text-[#a1a1aa] hover:text-white hover:border-purple-500/40 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-purple-400" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white font-mono text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
          </div>

          {/* Account Actions: Brand Gradient Pill / Profile Menu */}
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:opacity-90 transition-all active:scale-95"
              >
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName}
                    className="w-4 h-4 rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-purple-600/40 text-[9px] font-bold flex items-center justify-center text-purple-200">
                    {getUserInitials(currentUser?.displayName || currentUser?.username)}
                  </span>
                )}
                <span className="truncate max-w-[100px]">{currentUser?.displayName || 'Account'}</span>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 glass-panel rounded-2xl p-2.5 shadow-2xl border border-[#2a243a] z-50 animate-in fade-in zoom-in-95">
                  {/* Current Active Account Header */}
                  <div className="p-2 mb-1.5 rounded-xl bg-[#0d0b14]/70 border border-[#2a243a]/60">
                    <div className="flex items-center gap-2.5">
                      {currentUser?.avatarUrl ? (
                        <img
                          src={currentUser.avatarUrl}
                          alt={currentUser.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-purple-500/40 shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold border border-purple-500/40 shrink-0 shadow-sm">
                          {getUserInitials(currentUser?.displayName || currentUser?.username)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate font-display">
                            {currentUser?.displayName}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {currentUser?.role || 'member'}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#a1a1aa] font-mono block truncate">
                          @{currentUser?.username}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-[#2a243a]/40">
                    <button
                      onClick={() => {
                        onNavigate('watchlist');
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#a1a1aa] hover:text-white hover:bg-purple-600/20 rounded-xl transition-colors font-medium"
                    >
                      <Bookmark className="w-4 h-4 text-purple-400" />
                      My Watchlist
                    </button>
                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#a1a1aa] hover:text-white hover:bg-purple-600/20 rounded-xl transition-colors font-medium"
                    >
                      <Settings className="w-4 h-4 text-purple-400" />
                      Admin Console
                    </button>

                    <button
                      onClick={async () => {
                        await signOutUser();
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-950/30 rounded-xl transition-colors font-medium pt-2 border-t border-[#2a243a]/30"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthModal('signup')}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#2a243a] text-[#a1a1aa] hover:text-white hover:border-purple-500/40 text-xs font-semibold transition-all"
              >
                <UserPlus className="w-3.5 h-3.5 text-purple-400" />
                Sign Up
              </button>
              <button
                onClick={() => openAuthModal('signin')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:opacity-90 transition-all active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 text-[#a1a1aa] hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="xl:hidden fixed inset-x-0 top-16 z-30 glass-panel border-b border-[#2a243a] p-4 shadow-2xl animate-in slide-in-from-top-2 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold shadow-md'
                      : 'bg-[#161321] text-[#a1a1aa] hover:text-white hover:bg-[#201c2e]'
                  }`}
                >
                  <Icon className="w-4 h-4 text-purple-300" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#2a243a]">
            {isLoggedIn ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5">
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName}
                      className="w-7 h-7 rounded-full object-cover border border-purple-500/40 shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold border border-purple-500/40 shrink-0 shadow-sm">
                      {getUserInitials(currentUser?.displayName || currentUser?.username)}
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-white font-bold block">{currentUser?.displayName}</span>
                    <span className="text-[10px] text-[#a1a1aa] font-mono">@{currentUser?.username}</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await signOutUser();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 hover:text-rose-200 font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    openAuthModal('signin');
                    setMobileMenuOpen(false);
                  }}
                  className="py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </button>
                <button
                  onClick={() => {
                    openAuthModal('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="py-2.5 bg-[#161321] border border-[#2a243a] hover:border-purple-500/40 text-white font-bold text-xs rounded-full flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5 text-purple-400" />
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Authentication Modal (Sign In & Sign Up) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      {/* Advanced Notification Centre Modal */}
      <NotificationCenterModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onWatchAnime={(id, ep) => {
          setShowNotificationModal(false);
          onWatchAnime?.(id, ep);
        }}
        onSelectAnime={(id) => {
          setShowNotificationModal(false);
          onSelectAnime?.(id);
        }}
      />
    </>
  );
};
