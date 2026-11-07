import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  Search,
  Filter,
  Radio,
  Tv,
  CheckCircle2,
  Megaphone,
  AlertCircle,
  Clock,
  Shield,
  Sliders,
} from 'lucide-react';
import {
  YorumiNotification,
  NotificationPreference,
  getNotifications,
  saveNotifications,
  getNotificationPreferences,
  saveNotificationPreferences,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from '../../services/notificationService';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWatchAnime?: (animeId: number, episode: number) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onWatchAnime,
}) => {
  const [notifications, setNotifications] = useState<YorumiNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreference>(getNotificationPreferences());
  const [activeTab, setActiveTab] = useState<'all' | 'airing' | 'aired' | 'available' | 'news' | 'system' | 'prefs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNotifications(getNotifications());
      setPrefs(getNotificationPreferences());
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

  const filteredNotifications = notifications.filter((n) => {
    if (unreadOnly && !n.unread) return false;
    if (activeTab === 'airing' && n.type !== 'airing') return false;
    if (activeTab === 'aired' && n.type !== 'aired') return false;
    if (activeTab === 'available' && n.type !== 'available') return false;
    if (activeTab === 'news' && n.type !== 'news' && n.type !== 'announcement') return false;
    if (activeTab === 'system' && n.type !== 'system') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q) || (n.animeTitle && n.animeTitle.toLowerCase().includes(q));
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

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
                Real-time airing alerts, release schedules, and system announcements
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

        {/* Toolbar & Category Tabs */}
        <div className="px-6 pt-4 pb-3 border-b border-[#2a243a] space-y-3 bg-[#0d0b14]/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-[#0d0b14] p-1 rounded-2xl border border-[#2a243a] text-xs font-semibold">
              {[
                { id: 'all', label: 'All' },
                { id: 'airing', label: 'Airing' },
                { id: 'aired', label: 'Aired' },
                { id: 'available', label: 'Available' },
                { id: 'news', label: 'News' },
                { id: 'system', label: 'System' },
                { id: 'prefs', label: 'Preferences', icon: Sliders },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow font-bold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            {activeTab !== 'prefs' && (
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
          {activeTab !== 'prefs' && (
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
          {activeTab === 'prefs' ? (
            /* PREFERENCES TAB */
            <div className="space-y-5 max-w-lg mx-auto py-2">
              <h3 className="text-sm font-bold text-white border-b border-[#2a243a] pb-2">
                Notification & Alert Preferences
              </h3>

              <div className="space-y-4 text-xs">
                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">Upcoming Airing Reminders</span>
                    <span className="text-[11px] text-zinc-400">Receive alerts before followed anime episodes air</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.airingReminders}
                    onChange={(e) => handleSavePrefs({ ...prefs, airingReminders: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">Official Aired Notifications</span>
                    <span className="text-[11px] text-zinc-400">Notify when official broadcast time has passed</span>
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
                    <span className="font-bold text-white block">Available on Yorumi Alerts</span>
                    <span className="text-[11px] text-zinc-400">Notify when playable episodes are verified & available</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.availableAlerts}
                    onChange={(e) => handleSavePrefs({ ...prefs, availableAlerts: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">New Anime & Movie Alerts</span>
                    <span className="text-[11px] text-zinc-400">Notify about new additions to the Yorumi catalogue</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.newAnimeAlerts}
                    onChange={(e) => handleSavePrefs({ ...prefs, newAnimeAlerts: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">Announcements & System News</span>
                    <span className="text-[11px] text-zinc-400">Important platform updates and admin announcements</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.announcements}
                    onChange={(e) => handleSavePrefs({ ...prefs, announcements: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#0d0b14] rounded-2xl border border-[#2a243a] cursor-pointer">
                  <div>
                    <span className="font-bold text-white block">Browser Push Notifications</span>
                    <span className="text-[11px] text-zinc-400">Send desktop push notifications using Web Push API</span>
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
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  n.unread
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
                  <div className="w-12 h-16 rounded-xl bg-purple-900/30 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-300">
                    <Bell className="w-5 h-5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 truncate">
                      {n.unread && <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />}
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
                        className="px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 text-white rounded-lg text-[11px] font-bold shadow transition-all flex items-center gap-1.5"
                      >
                        <Tv className="w-3.5 h-3.5" /> Watch Episode {n.episodeNumber}
                      </button>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {n.type}
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};
