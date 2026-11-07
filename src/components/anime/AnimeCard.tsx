import React from 'react';
import { Star, Play, Bookmark, Check } from 'lucide-react';
import { Anime } from '../../types/anime';
import { useUser } from '../../contexts/UserContext';

interface AnimeCardProps {
  anime: Anime;
  onSelect: (animeId: number) => void;
  onWatch: (animeId: number, episode?: number) => void;
  showEpisodeBadge?: boolean;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  onSelect,
  onWatch,
}) => {
  const { updateWatchlist, getWatchlistItem } = useUser();
  const watchlistItem = getWatchlistItem(anime.id);
  const isBookmarked = !!watchlistItem;

  const title = anime.title.english || anime.title.romaji;
  const scoreFormatted = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

  return (
    <div
      onClick={() => onSelect(anime.id)}
      className="group relative flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1.5"
    >
      {/* Poster Cover Container */}
      <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#161321] border border-[#2a243a] shadow-lg group-hover:border-purple-500/50 group-hover:shadow-[0_10px_25px_rgba(168,85,247,0.25)] transition-all">
        <img
          src={anime.coverImage.extraLarge || anime.coverImage.large}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Top Floating Controls */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
          {scoreFormatted ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0d0b14]/80 backdrop-blur-md text-[11px] font-bold text-amber-400 border border-amber-400/20">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{scoreFormatted}</span>
            </div>
          ) : (
            <div />
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              updateWatchlist(anime, isBookmarked ? 'WATCHING' : 'PLANNING');
            }}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all ${
              isBookmarked
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                : 'bg-[#0d0b14]/80 text-[#a1a1aa] hover:text-white hover:bg-black'
            }`}
            title={isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}
          >
            {isBookmarked ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Hover Overlay Play Button */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0b14]/90 via-[#0d0b14]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWatch(anime.id, 1);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-transform active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            Watch Now
          </button>
        </div>
      </div>

      {/* Card Info */}
      <div className="mt-2.5 space-y-1">
        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors font-display">
          {title}
        </h3>

        {/* Unboxed Metadata Line */}
        <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
          <span>{anime.format || 'TV'}</span>
          <span aria-hidden="true">·</span>
          <span>{anime.seasonYear || anime.season || 'Anime'}</span>
          {anime.episodes && (
            <>
              <span aria-hidden="true">·</span>
              <span>{anime.episodes} Ep</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
