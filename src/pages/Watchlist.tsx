import React, { useState } from 'react';
import { Bookmark, Trash2, Play } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { WatchStatus } from '../types/anime';

interface WatchlistProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({ onSelectAnime, onWatchAnime }) => {
  const { watchlist, favorites, removeFromWatchlist, updateWatchlist } = useUser();
  const [activeTab, setActiveTab] = useState<'ALL' | WatchStatus | 'FAVORITES'>('ALL');

  const filteredItems =
    activeTab === 'FAVORITES'
      ? favorites.map((anime) => ({ anime, status: 'PLANNING' as WatchStatus, userScore: null, lastWatchedEpisode: 1, updatedAt: Date.now() }))
      : activeTab === 'ALL'
      ? watchlist
      : watchlist.filter((item) => item.status === activeTab);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Bookmark className="w-8 h-8 text-purple-400" />
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            My Anime <span className="brand-gradient-text">Collection</span>
          </h1>
        </div>
        <p className="text-sm text-[#a1a1aa] font-sans">
          Manage your personal watchlist, track episode progress, rate titles, and view favorite anime entries.
        </p>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#161321] rounded-full border border-[#2a243a] text-xs font-semibold">
        {[
          { id: 'ALL', label: `All Saved (${watchlist.length})` },
          { id: 'WATCHING', label: 'Currently Watching' },
          { id: 'PLANNING', label: 'Plan to Watch' },
          { id: 'COMPLETED', label: 'Completed' },
          { id: 'DROPPED', label: 'Dropped' },
          { id: 'FAVORITES', label: `Favorites (${favorites.length})` },
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
          <h3 className="text-base font-bold text-white font-display">No items in this collection</h3>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto font-sans">
            Browse anime titles in the Discover or Trending hubs and click the bookmark button to add them here.
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
                      onChange={(e) => updateWatchlist(anime, e.target.value as WatchStatus)}
                      className="bg-[#0d0b14] text-[#fafafa] text-xs rounded-full px-3 py-1 border border-[#2a243a] outline-none font-sans"
                    >
                      <option value="WATCHING" className="bg-[#161321]">Watching</option>
                      <option value="PLANNING" className="bg-[#161321]">Plan to Watch</option>
                      <option value="COMPLETED" className="bg-[#161321]">Completed</option>
                      <option value="DROPPED" className="bg-[#161321]">Dropped</option>
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
                      title="Remove from Watchlist"
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
