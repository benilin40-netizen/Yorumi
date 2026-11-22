import React, { useState } from 'react';
import { Star, Play, Bookmark, Check, Clock, Trash2, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { Anime, WatchStatus } from '../../types/anime';
import { useUser } from '../../contexts/UserContext';

interface AnimeCardProps {
  anime: Anime;
  onSelect: (animeId: number) => void;
  onWatch: (animeId: number, episode?: number) => void;
  showEpisodeBadge?: boolean;
  hideWatchButton?: boolean;
  showRelativeTime?: boolean;
  showCountdown?: boolean;
}

const CARD_WATCHLIST_OPTIONS: { status: WatchStatus; label: string }[] = [
  { status: 'WATCHING', label: 'Watching' },
  { status: 'PLANNING', label: 'Plan' },
  { status: 'COMPLETED', label: 'Completed' },
  { status: 'FAVORITE', label: 'Favorite' },
];

function formatRelativeTime(timestampSec?: number | null): string | null {
  if (!timestampSec) return null;
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - timestampSec);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function formatUpcomingCountdown(airingAt?: number | null): string | null {
  if (!airingAt) return null;
  const diff = airingAt - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'Soon';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  onSelect,
  onWatch,
  showEpisodeBadge = false,
  hideWatchButton = false,
  showRelativeTime = false,
  showCountdown = false,
}) => {
  const { updateWatchlist, removeFromWatchlist, getWatchlistItem, isFavorite } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const watchlistItem = getWatchlistItem(anime.id);
  const favorited = isFavorite(anime.id);
  const isBookmarked = Boolean(watchlistItem || favorited);

  const title = anime.title.english || anime.title.romaji;
  const scoreFormatted = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const isUnreleased =
    anime.status === 'NOT_YET_RELEASED' || Boolean(anime.isUnreleased);
  const epNum = anime.latestAiredEpisode || anime.airedEpisodes || 1;
  const relativeTime = showRelativeTime ? formatRelativeTime(anime.lastAiredAt) : null;
  const upcomingCountdown = showCountdown
    ? formatUpcomingCountdown(anime.nextAiringEpisode?.airingAt)
    : null;
  const canWatch = !hideWatchButton && !isUnreleased;

  return (
    <motion.div
      whileHover={{ y: -6, rotateY: -2, scale: 1.02 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(anime.id)}
      onMouseLeave={() => setMenuOpen(false)}
      className="group relative flex flex-col cursor-pointer"
    >
      {/* Poster Cover Container */}
      <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#161321] border border-[#2a243a] shadow-lg group-hover:border-purple-500/60 group-hover:shadow-[0_12px_30px_rgba(168,85,247,0.3)] transition-all">
        <img
          src={anime.coverImage.extraLarge || anime.coverImage.large}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Top Floating Controls */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-20 gap-1">
          {showEpisodeBadge && epNum > 0 ? (
            <div className="px-2 py-0.5 rounded-md bg-purple-600/95 backdrop-blur-md text-[11px] font-mono font-bold text-white shadow tabular-nums">
              EP {epNum}
            </div>
          ) : isUnreleased ? (
            <div className="px-2 py-0.5 rounded-md bg-[#0d0b14]/90 border border-amber-400/40 text-[10px] font-bold text-amber-300">
              Coming soon
            </div>
          ) : scoreFormatted ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0d0b14]/85 backdrop-blur-md text-[11px] font-bold text-amber-400 border border-amber-400/20 tabular-nums">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{scoreFormatted}</span>
            </div>
          ) : (
            <div />
          )}

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className={`p-1.5 rounded-full backdrop-blur-md transition-all ${
                isBookmarked
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                  : 'bg-[#0d0b14]/80 text-[#a1a1aa] hover:text-white hover:bg-black'
              }`}
              title={isBookmarked ? 'Manage My List' : 'Add to My List'}
              aria-label={isBookmarked ? 'Manage My List' : 'Add to My List'}
            >
              {isBookmarked ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1.5 w-36 bg-[#161321]/95 backdrop-blur-xl border border-[#2a243a] rounded-xl p-1.5 shadow-2xl z-30 space-y-0.5 text-[11px]">
                {CARD_WATCHLIST_OPTIONS.map((opt) => {
                  const active = watchlistItem?.status === opt.status;
                  return (
                    <button
                      key={opt.status}
                      onClick={() => {
                        updateWatchlist(anime, opt.status, watchlistItem?.userScore ?? null, epNum);
                        setMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-semibold transition-colors ${
                        active
                          ? 'bg-purple-600/30 text-purple-200'
                          : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {opt.status === 'FAVORITE' ? (
                        <Heart className={`w-3 h-3 ${active || favorited ? 'fill-rose-400 text-rose-400' : ''}`} />
                      ) : active ? (
                        <Check className="w-3 h-3 text-purple-300" />
                      ) : null}
                    </button>
                  );
                })}
                {isBookmarked && (
                  <button
                    onClick={() => {
                      removeFromWatchlist(anime.id);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-semibold text-rose-300 hover:bg-rose-950/40 border-t border-[#2a243a]/60 mt-1 pt-1.5"
                  >
                    <span>Remove</span>
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Countdown Pill at Bottom if Unreleased */}
        {showCountdown && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 px-2.5 py-1 rounded-md bg-[#0d0b14]/90 border border-[#2a243a] text-[11px] font-mono text-purple-300 flex items-center justify-center gap-1.5 tabular-nums">
            <Clock className="w-3 h-3 text-purple-400" />
            <span>
              {upcomingCountdown
                ? `Starts in ${upcomingCountdown}`
                : anime.startDate?.year
                ? `Premieres ${anime.startDate.year}`
                : 'Coming soon'}
            </span>
          </div>
        )}

        {/* Hover Overlay Watch Button (Never shown on Upcoming / Unreleased) */}
        {canWatch && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0b14]/90 via-[#0d0b14]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWatch(anime.id, epNum);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-transform active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              {showEpisodeBadge ? `Watch EP ${epNum}` : 'Watch Now'}
            </button>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="mt-2.5 space-y-1">
        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors font-display">
          {title}
        </h3>

        <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa] truncate">
          {relativeTime ? (
            <>
              <span className="text-purple-300 font-semibold">{relativeTime}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>{anime.format || 'TV'}</span>
          <span aria-hidden="true">·</span>
          <span>
            {anime.startDate?.year || anime.seasonYear || (isUnreleased ? 'TBA' : 'Anime')}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
