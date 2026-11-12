import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  Trash2,
  Search,
  Tv,
  Sliders,
  Heart,
  BellRing,
  BellOff,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  YorumiNotification,
  NotificationPreference,
  getNotifications,
  getNotificationPreferences,
  saveNotificationPreferences,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
  isFavoriteAlertEnabled,
  toggleFavoriteAlert,
  enableAllFavoritesAlerts,
  muteAllFavoritesAlerts,
  testFavoriteReleaseAlert,
} from '../../services/notificationService';
import { getFavorites } from '../../services/storage';
import { Anime } from '../../types/anime';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWatchAnime?: (animeId: number, episode: number) => void;
  onSelectAnime?: (animeId: number) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onWatchAnime,
  onSelectAnime,
}) => {
  const [notifications, setNotifications] = useState<YorumiNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreference>(getNotificationPreferences());
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'airing' | 'aired' | 'new_anime' | 'seasons' | 'announcements' | 'account' | 'prefs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [testAlertToast, setTestAlertToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotifications(getNotifications());
      setPrefs(getNotificationPreferences());
      setFavorites(getFavorites());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    const updated = markAllNotificationsRead();
    setNotifications([...updated]);
  };

  const handleDelete = (id: string) => {
    const updated = deleteNotification(id);
    setNotifications([...updated]);
  };

  const handleClearRead = () => {
    const updated = clearReadNotifications();
    setNotifications([...updated]);
  };

  const handleSavePrefs = (newPrefs: NotificationPreference) => {
    setPrefs(newPrefs);
    saveNotificationPreferences(newPrefs);
    if (newPrefs.pushEnabled && 'Notification' in window) {
      Notification.requestPermission();
    }
  };

  const handleToggleFavoriteItem = (animeId: number) => {
    toggleFavoriteAlert(animeId);
    setPrefs(getNotificationPreferences());
  };

  const handleEnableAllFavorites = () => {
    enableAllFavoritesAlerts(favorites.map((f) => f.id));
    setPrefs(getNotificationPreferences());
  };

  const handleMuteAllFavorites = () => {
    muteAllFavoritesAlerts(favorites.map((f) => f.id));
    setPrefs(getNotificationPreferences());
  };

  const handleTriggerTestAlert = () => {
    if (favorites.length === 0) {
      setTestAlertToast('Please add an anime to your Favorites first!');
      setTimeout(() => setTestAlertToast(null), 3000);
      return;
    }
    const sampleAnime = favorites[0];
    const newNotif = testFavoriteReleaseAlert(sampleAnime, 1);
    setNotifications([newNotif, ...getNotifications()]);
    setTestAlertToast(`Simulated release alert sent for "${sampleAnime.title.english || sampleAnime.title.romaji}"!`);
    setTimeout(() => setTestAlertToast(null), 3500);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (unreadOnly && !n.unread) return false;
    if (activeTab === 'favorites') {
      if (n.type !== 'favorite_release' && n.type !== 'aired' && n.type !== 'airing') return false;
      // Filter for favorite shows if matched
      if (favorites.length > 0) {
        const favIds = favorites.map((f) => f.id);
        if (n.animeId && !favIds.includes(n.animeId)) return false;
      }
    } else if (activeTab !== 'all' && activeTab !== 'prefs' && n.type !== activeTab) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.animeTitle && n.animeTitle.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;
  const activeFavoritesAlertsCount = favorites.filter((f) => isFavoriteAlertEnabled(f.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl bg-[#161321] rounded-3xl border border-[#2a243a] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#2a243a] flex items-center justify-between bg-[#0d0b14]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              <div className="w-full h-full bg-[#0d0b14] rounded-[14px] flex items-center justify-center">
                <Bell className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-extrabold text-white text-lg">Notification Centre</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-purple-600 text-white font-mono text-[10px] font-bold rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-xs text-[#a1a1aa] font-sans">
                Real-time episode releases, airing schedules & favorite show alerts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-white p-2 rounded-xl bg-[#0d0b14] border border-[#2a243a] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Alert Feedback */}
        {testAlertToast && (
          <div className="mx-6 mt-3 p-3 bg-purple-900/60 border border-purple-500/50 rounded-2xl flex items-center gap-2 text-xs text-purple-200 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
            <span className="flex-1 font-medium">{testAlertToast}</span>
          </div>
        )}

        {/* Toolbar & Category Tabs */}
        <div className="px-6 pt-4 pb-3 border-b border-[#2a243a] space-y-3 bg-[#0d0b14]/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-[#0d0b14] p-1 rounded-2xl border border-[#2a243a] text-xs font-semibold">
              {[
                { id: 'all', label: 'All' },
                {
                  id: 'favorites',
                  label: `Favorites (${favorites.length})`,
                  icon: Heart,
                  highlight: true,
                },
                { id: 'airing', label: 'Upcoming' },
                { id: 'aired', label: 'Aired' },
                { id: 'new_anime', label: 'New' },
                { id: 'announcements', label: 'Announcements' },
                { id: 'prefs', label: 'Preferences', icon: Sliders },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? tab.highlight
                        ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow font-bold'
                        : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow font-bold'
                      : tab.highlight && favorites.length > 0
                      ? 'text-rose-400 hover:text-rose-300'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  {tab.icon && (
                    <tab.icon
                      className={`w-3.5 h-3.5 ${
                        tab.highlight && activeTab === tab.id ? 'fill-current' : ''
                      }`}
                    />
                  )}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            {activeTab !== 'prefs' && activeTab !== 'favorites' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllRead}
                  className="px-3 py-1.5 bg-[#161321] hover:bg-[#201c2e] text-[#a1a1aa] hover:text-white border border-[#2a243a] text-xs rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-purple-400" />
                  Mark Read
                </button>
                <button
                  onClick={handleClearRead}
                  className="px-3 py-1.5 bg-[#161321] hover:bg-[#201c2e] text-[#a1a1aa] hover:text-white border border-[#2a243a] text-xs rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Clear Read
                </button>
              </div>
            )}
          </div>

          {/* Search & Filters */}
          {activeTab !== 'prefs' && activeTab !== 'favorites' && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search notifications by title or anime..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none bg-[#0d0b14] px-3 py-2 rounded-xl border border-[#2a243a]">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="rounded border-[#2a243a] text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
                <span>Unread only</span>
              </label>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-sans">
          {/* FAVORITES OPT-IN TAB */}
          {activeTab === 'favorites' ? (
            <div className="space-y-5 py-1">
              {/* Master Opt-in Card */}
              <div className="p-4 bg-gradient-to-br from-rose-950/30 via-[#161321] to-purple-950/30 rounded-2xl border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
                      <Heart className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Favorited Shows Release Alerts
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] font-mono rounded-full border border-rose-500/30">
                          {activeFavoritesAlertsCount} of {favorites.length} subscribed
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        Opt-in to get instant notifications the moment a new episode of your favorited anime is officially verified and playable.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={prefs.favoriteReleaseAlerts}
                      onChange={(e) =>
                        handleSavePrefs({ ...prefs, favoriteReleaseAlerts: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                  </label>
                </div>

                {/* Sub-actions toolbar */}
                <div className="mt-4 pt-3 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleEnableAllFavorites}
                      className="px-3 py-1 bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 border border-purple-500/30 rounded-lg font-medium transition-all flex items-center gap-1.5"
                    >
                      <BellRing className="w-3.5 h-3.5 text-purple-400" />
                      Enable All
                    </button>
                    <button
                      onClick={handleMuteAllFavorites}
                      className="px-3 py-1 bg-zinc-900/60 hover:bg-zinc-800/60 text-zinc-400 hover:text-white border border-[#2a243a] rounded-lg font-medium transition-all flex items-center gap-1.5"
                    >
                      <BellOff className="w-3.5 h-3.5" />
                      Mute All
                    </button>
                  </div>

                  <button
                    onClick={handleTriggerTestAlert}
                    className="px-3 py-1 bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:opacity-90 text-white rounded-lg font-bold transition-all flex items-center gap-1.5 shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Test Release Alert
                  </button>
                </div>
              </div>

              {/* Favorites List */}
              {favorites.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-[#0d0b14] border border-[#2a243a] space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                    <Heart className="w-6 h-6" />
                  </div>
                  <h4 className="text-white font-bold text-sm">No favorited shows yet</h4>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Click the Heart button on any anime details page to add it to your Favorites. Once favorited, you will receive real-time release alerts whenever a new episode airs!
                  </p>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold rounded-xl shadow hover:opacity-90 transition-all"
                  >
                    Browse Anime Catalogue
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                    Your Favorited Anime ({favorites.length})
                  </h4>

                  <div className="space-y-2">
                    {favorites.map((anime) => {
                      const title = anime.title.english || anime.title.romaji;
                      const isAlertActive = isFavoriteAlertEnabled(anime.id);

                      return (
                        <div
                          key={anime.id}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                            isAlertActive && prefs.favoriteReleaseAlerts
                              ? 'bg-[#0d0b14] border-purple-500/30 hover:border-purple-500/50'
                              : 'bg-[#0d0b14]/60 border-[#2a243a] opacity-75'
                          }`}
                        >
                          <div
                            className="flex items-center gap-3 min-w-0 cursor-pointer"
                            onClick={() => onSelectAnime?.(anime.id)}
                          >
                            <img
                              src={anime.coverImage.large || anime.coverImage.extraLarge}
                              alt={title}
                              className="w-10 h-14 rounded-lg object-cover border border-[#2a243a] shrink-0"
                            />
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md">
                                {title}
                              </h5>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                  {anime.format || 'TV'}
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  {anime.episodes ? `${anime.episodes} eps` : 'Airing'}
                                </span>
                                {isAlertActive && prefs.favoriteReleaseAlerts ? (
                                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Alerts Active
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-zinc-500">Muted</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleFavoriteItem(anime.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                isAlertActive && prefs.favoriteReleaseAlerts
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'
                              }`}
                              title={isAlertActive ? 'Click to mute alerts for this anime' : 'Click to enable alerts'}
                            >
                              {isAlertActive && prefs.favoriteReleaseAlerts ? (
                                <>
                                  <BellRing className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Alerts ON</span>
                                </>
                              ) : (
                                <>
                                  <BellOff className="w-3.5 h-3.5" />
                                  <span>Muted</span>
                                </>
                              )}
                            </button>

                            {onWatchAnime && (
                              <button
                                onClick={() => {
                                  onWatchAnime(anime.id, 1);
                                  onClose();
                                }}
                                className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
                                title="Stream now"
                              >
                                <Tv className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'prefs' ? (
            /* PREFERENCES TAB */
            <div className="space-y-5 max-w-lg mx-auto py-2">
              <h3 className="text-sm font-bold text-white border-b border-[#2a243a] pb-2">
                Notification & Alert Preferences
              </h3>

              <div className="space-y-4 text-xs">
                {/* FAVORITES ALERT PREFERENCE */}
                <label className="flex items-center justify-between p-3.5 bg-gradient-to-r from-rose-950/20 to-[#0d0b14] rounded-2xl border border-rose-500/30 cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <Heart className="w-4 h-4 text-rose-400 mt-0.5 fill-current shrink-0" />
                    <div>
                      <span className="font-bold text-white block">
                        Favorited Shows Release Alerts
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Receive instant alerts when new episodes of your favorited anime become available ({activeFavoritesAlertsCount} active)
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.favoriteReleaseAlerts}
                    onChange={(e) =>
                      handleSavePrefs({ ...prefs, favoriteReleaseAlerts: e.target.checked })
                    }
                    className="w-4 h-4 accent-rose-500 rounded ml-3"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">Upcoming Airing Reminders</span>
                    <span className="text-[11px] text-zinc-400">
                      Receive alerts before followed anime episodes air
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.airingReminders}
                    onChange={(e) =>
                      handleSavePrefs({ ...prefs, airingReminders: e.target.checked })
                    }
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">Official Aired Notifications</span>
                    <span className="text-[11px] text-zinc-400">
                      Notify when official broadcast time has passed
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.airedAlerts}
                    onChange={(e) => handleSavePrefs({ ...prefs, airedAlerts: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">New Anime & Movie Alerts</span>
                    <span className="text-[11px] text-zinc-400">
                      Notify about new additions to the Yorumi catalogue
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.newAnimeAlerts}
                    onChange={(e) =>
                      handleSavePrefs({ ...prefs, newAnimeAlerts: e.target.checked })
                    }
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">Announcements & System News</span>
                    <span className="text-[11px] text-zinc-400">
                      Important platform updates and announcements
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.announcements}
                    onChange={(e) =>
                      handleSavePrefs({ ...prefs, announcements: e.target.checked })
                    }
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">Browser Push Notifications</span>
                    <span className="text-[11px] text-zinc-400">
                      Send desktop push notifications using Web Push API
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.pushEnabled}
                    onChange={(e) => handleSavePrefs({ ...prefs, pushEnabled: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="text-white font-bold text-sm">No notifications found</h4>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                You are all caught up! Release alerts and schedule updates will appear here automatically.
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isFavRelease = n.type === 'favorite_release';

              return (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                    isFavRelease
                      ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                      : n.unread
                      ? 'bg-purple-950/20 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                      : 'bg-[#0d0b14] border-[#2a243a]'
                  }`}
                >
                  {n.coverImage ? (
                    <img
                      src={n.coverImage}
                      alt={n.animeTitle || 'Cover'}
                      className="w-12 h-16 rounded-xl object-cover shrink-0 border border-[#2a243a]"
                    />
                  ) : (
                    <div
                      className={`w-12 h-16 rounded-xl flex items-center justify-center shrink-0 ${
                        isFavRelease
                          ? 'bg-rose-900/30 border border-rose-500/30 text-rose-300'
                          : 'bg-purple-900/30 border border-purple-500/30 text-purple-300'
                      }`}
                    >
                      {isFavRelease ? <Heart className="w-5 h-5 fill-current" /> : <Bell className="w-5 h-5" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 truncate">
                        {n.unread && (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isFavRelease ? 'bg-rose-500' : 'bg-purple-500'
                            }`}
                          />
                        )}
                        <h4 className="text-xs font-bold text-white truncate">{n.title}</h4>
                      </div>
                      <span className="text-[10px] text-[#a1a1aa] font-mono shrink-0">{n.time}</span>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed mb-2.5">{n.message}</p>

                    <div className="flex items-center justify-between gap-2">
                      {n.animeId && n.episodeNumber && onWatchAnime ? (
                        <button
                          onClick={() => {
                            onWatchAnime(n.animeId!, n.episodeNumber!);
                            onClose();
                          }}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold shadow transition-all flex items-center gap-1.5 text-white ${
                            isFavRelease
                              ? 'bg-gradient-to-r from-rose-500 to-purple-600 hover:opacity-90'
                              : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90'
                          }`}
                        >
                          <Tv className="w-3.5 h-3.5" /> Watch Episode {n.episodeNumber}
                        </button>
                      ) : (
                        <span
                          className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded ${
                            isFavRelease
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {isFavRelease ? '⭐ Favorite Release' : n.type}
                        </span>
                      )}

                      <button
                        onClick={() => handleDelete(n.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
