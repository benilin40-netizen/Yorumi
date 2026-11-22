import React, { useState } from 'react';
import { Bookmark, Trash2, Play, RefreshCw } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { WatchStatus } from '../types/anime';

interface WatchlistProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({ onSelectAnime, onWatchAnime }) => {
  const {
    watchlist,
    favorites,
    removeFromWatchlist,
    updateWatchlist,
    refreshSupabaseUserData,
  } = useUser();
  const { user: supabaseUser, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'WATCHING' | 'PLANNING' | 'COMPLETED' | 'FAVORITE'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const filteredItems =
    activeTab === 'FAVORITE'
      ? watchlist.filter((item) => item.status === 'FAVORITE' || item.isFavorite)
      : activeTab === 'ALL'
      ? watchlist
      : watchlist.filter((item) => item.status === activeTab);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSupabaseUserData();
    setRefreshing(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-purple-400" />
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              My <span className="brand-gradient-text">List</span>
            </h1>
          </div>
          <p className="text-sm text-[#a1a1aa] font-sans">
            Organize titles across Watching, Plan, Completed, and Favorite categories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {supabaseUser ? (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#161321] border border-[#2a243a] text-xs font-semibold text-white hover:border-purple-500/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${refreshing ? 'animate-spin' : ''}`} />
              Sync My List
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('signin')}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-xs font-bold text-white shadow"
            >
              Sign In to Sync
            </button>
          )}
        </div>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#161321] rounded-full border border-[#2a243a] text-xs font-semibold">
        {[
          { id: 'ALL', label: `All (${watchlist.length})` },
          { id: 'WATCHING', label: 'Watching' },
          { id: 'PLANNING', label: 'Plan' },
          { id: 'COMPLETED', label: 'Completed' },
          {
            id: 'FAVORITE',
            label: `Favorite (${Math.max(
              favorites.length,
              watchlist.filter((w) => w.status === 'FAVORITE' || w.isFavorite).length
            )})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-full transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Watchlist Grid */}
      {filteredItems.length === 0 ? (
        <div className="p-16 text-center bg-[#161321] rounded-2xl border border-[#2a243a] space-y-3">
          <Bookmark className="w-12 h-12 text-purple-500/30 mx-auto" />
          <h3 className="text-base font-bold text-white font-display">No items in this list</h3>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto font-sans">
            Click the bookmark icon on any anime card or open an anime details page to add titles to your list.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const anime = item.anime;
            const title = anime.title.english || anime.title.romaji;
            return (
              <div
                key={anime.id}
                onClick={() => onSelectAnime(anime.id)}
                className="group p-4 bg-[#161321] rounded-xl border border-[#2a243a] hover:border-purple-500/40 transition-all cursor-pointer flex gap-4 shadow-lg"
              >
                <img
                  src={anime.coverImage.large || anime.coverImage.medium}
                  alt={title}
                  className="w-20 aspect-[3/4] object-cover rounded-xl shrink-0 group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                />

                <div className="flex-1 min-w-0 space-y-2">
                  <h4 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors font-display">
                    {title}
                  </h4>

                  <div className="flex items-center gap-2 text-xs text-[#a1a1aa] font-sans">
                    <span>{anime.format || 'TV'}</span>
                    <span>·</span>
                    <span className="font-mono text-purple-300 font-bold">Ep {item.lastWatchedEpisode || 1}</span>
                  </div>

                  {/* Status Change Selector */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={item.status}
                      onChange={(e) =>
                        updateWatchlist(
                          anime,
                          e.target.value as WatchStatus,
                          item.userScore,
                          item.lastWatchedEpisode
                        )
                      }
                      className="bg-[#0d0b14] text-[#fafafa] text-xs rounded-full px-3 py-1 border border-[#2a243a] outline-none font-sans"
                    >
                      <option value="WATCHING" className="bg-[#161321]">Watching</option>
                      <option value="PLANNING" className="bg-[#161321]">Plan</option>
                      <option value="COMPLETED" className="bg-[#161321]">Completed</option>
                      <option value="FAVORITE" className="bg-[#161321]">Favorite</option>
                    </select>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatchAnime(anime.id, item.lastWatchedEpisode || 1);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-full shadow"
                    >
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                      Watch
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWatchlist(anime.id);
                      }}
                      className="p-1.5 text-[#a1a1aa] hover:text-rose-400 transition-colors"
                      title="Remove from My List"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
