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
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';

export interface NavbarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenSearch: () => void;
}

export const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Sparkles },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'seasonal', label: 'Seasonal', icon: Calendar },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'upcoming', label: 'Upcoming', icon: Clock },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'watchlist', label: 'My List', icon: Bookmark },
  { id: 'history', label: 'History', icon: History },
];

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate, onOpenSearch }) => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    currentUser,
    adminAuthenticated,
    logoutAdminSession,
  } = useUser();

  const {
    user: supabaseUser,
    profile: supabaseProfile,
    isAdmin: supabaseIsAdmin,
    openAuthModal,
    signOut: signOutSupabase,
  } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isEmbedPreview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('embedPreview') === '1';

  const showAdminBar = (adminAuthenticated || supabaseIsAdmin) && !isEmbedPreview;

  const displayUsername =
    supabaseProfile?.username ||
    supabaseUser?.user_metadata?.username ||
    supabaseUser?.email?.split('@')[0] ||
    currentUser?.displayName ||
    'Account';

  const handleAdminBarLogout = async () => {
    await logoutAdminSession();
    if (supabaseIsAdmin) {
      await signOutSupabase();
    }
  };

  return (
    <>
      <div className="sticky top-0 z-40 w-full">
        {/* Slim Admin Bar on Every Page When Logged In as Admin */}
        {showAdminBar && (
          <div className="w-full h-8 bg-[#120f1e] border-b border-purple-500/30 px-4 lg:px-8 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-purple-300 font-medium whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Admin</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <button
                onClick={() => onNavigate('admin')}
                className="text-white hover:text-purple-300 font-semibold transition-colors whitespace-nowrap"
              >
                /admin Dashboard
              </button>
              <button
                onClick={handleAdminBarLogout}
                className="flex items-center gap-1 text-rose-300 hover:text-rose-200 font-semibold transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3 h-3" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}

        <header className="w-full h-16 glass-nav px-4 lg:px-8 flex items-center justify-between gap-6 border-b border-[#2a243a]">
          {/* Zone 1: Logo & Tagline */}
          <div className="flex items-center gap-4 shrink-0">
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
              <div className="leading-tight">
                <span className="font-display font-extrabold text-lg tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-300 to-blue-400 group-hover:opacity-90 transition-opacity block">
                  YORUMI
                </span>
                <span className="hidden sm:block text-[10px] text-[#a1a1aa] font-sans tracking-normal whitespace-nowrap">
                  Catch every episode as it airs.
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden xl:flex items-center gap-5 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`whitespace-nowrap shrink-0 transition-colors py-1 relative font-sans ${
                    isActive ? 'text-white font-semibold' : 'text-[#a1a1aa] hover:text-white'
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

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161321] border border-[#2a243a] text-[#a1a1aa] hover:text-white hover:border-purple-500/40 text-xs transition-all whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[#0d0b14] rounded-full border border-[#2a243a] text-purple-300">
                Ctrl+K
              </kbd>
            </button>

            {/* Notifications Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                  if (!showNotifications && unreadNotificationCount > 0) {
                    markNotificationsRead();
                  }
                }}
                className="p-2 rounded-full bg-[#161321] border border-[#2a243a] text-[#a1a1aa] hover:text-white hover:border-purple-500/40 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4 text-purple-400" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white font-mono text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 glass-panel rounded-2xl p-3 shadow-2xl border border-[#2a243a] z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2a243a]">
                    <span className="text-xs font-semibold text-white">Release Alerts</span>
                    <span className="text-[10px] text-purple-400 font-mono">{notifications.length} updates</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 rounded-xl bg-[#0d0b14] border border-[#2a243a] hover:border-purple-500/30 transition-colors text-xs"
                      >
                        <div className="flex items-center justify-between text-white font-medium">
                          <span className="truncate">{n.title}</span>
                          <span className="text-[10px] text-[#a1a1aa] shrink-0 ml-1">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-[#a1a1aa] mt-0.5">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sign In Button (Logged Out) or Account Menu (Logged In) */}
            {!supabaseUser ? (
              <button
                onClick={() => openAuthModal('signin')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:opacity-90 transition-all active:scale-95 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowProfileMenu(!showProfileMenu);
                    setShowNotifications(false);
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:opacity-90 transition-all active:scale-95 whitespace-nowrap shrink-0"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[110px]">{displayUsername}</span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-60 glass-panel rounded-2xl p-2.5 shadow-2xl border border-[#2a243a] z-50">
                    <div className="p-2 mb-1.5 rounded-xl bg-[#0d0b14]/70 border border-[#2a243a]/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-purple-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate font-display">
                              {displayUsername}
                            </span>
                            {supabaseIsAdmin && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                admin
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#a1a1aa] font-mono block truncate">
                            {supabaseUser.email}
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
                        My List
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
                          setShowProfileMenu(false);
                          await signOutSupabase();
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
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 text-[#a1a1aa] hover:text-white"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>
      </div>

      {mobileMenuOpen && (
        <div className="xl:hidden fixed inset-x-0 top-16 z-30 glass-panel border-b border-[#2a243a] p-4 shadow-2xl space-y-4">
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

          <div className="pt-2 border-t border-[#2a243a] flex items-center justify-between gap-2">
            {supabaseUser ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-5 h-5 text-purple-400 shrink-0" />
                  <span className="text-xs text-white font-bold truncate">{displayUsername}</span>
                </div>
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await signOutSupabase();
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold shrink-0"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuthModal('signin');
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold text-xs rounded-full flex items-center justify-center gap-2"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuthModal('signup');
                  }}
                  className="flex-1 py-2.5 bg-[#161321] border border-[#2a243a] text-white font-bold text-xs rounded-full flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5 text-purple-400" />
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
