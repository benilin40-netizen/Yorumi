import React, { useState, useEffect } from 'react';
import { Play, Info, Star, ChevronLeft, ChevronRight, Bookmark, Check } from 'lucide-react';
import { Anime } from '../../types/anime';
import { useUser } from '../../contexts/UserContext';

interface HeroBannerProps {
  animeList: Anime[];
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, episode?: number) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  animeList,
  onSelectAnime,
  onWatchAnime,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { updateWatchlist, getWatchlistItem } = useUser();

  useEffect(() => {
    if (animeList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % animeList.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [animeList.length]);

  if (!animeList || animeList.length === 0) return null;

  const currentAnime = animeList[currentIndex] || animeList[0];
  const title = currentAnime.title.english || currentAnime.title.romaji;
  const watchlistItem = getWatchlistItem(currentAnime.id);
  const isBookmarked = !!watchlistItem;

  const studioName = currentAnime.studios?.nodes?.[0]?.name;
  const scoreFormatted = currentAnime.averageScore ? (currentAnime.averageScore / 10).toFixed(1) : '8.5';

  return (
    <div className="relative w-full min-h-[70vh] max-h-[750px] overflow-hidden bg-[#0d0b14] flex flex-col justify-end">
      {/* Background Banner Image with 50% opacity */}
      <div className="absolute inset-0">
        <img
          src={currentAnime.bannerImage || currentAnime.coverImage.extraLarge}
          alt={title}
          className="w-full h-full object-cover object-center opacity-50 scale-105 transition-all duration-700 filter brightness-90"
          referrerPolicy="no-referrer"
        />

        {/* Gradient Overlay: Left dark gradient & bottom fade into page background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0b14] via-[#0d0b14]/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0b14] via-[#0d0b14]/40 to-transparent" />
      </div>

      {/* Floating Particle Dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        <div className="particle w-2 h-2 top-[20%] left-[15%]" style={{ animationDelay: '0s' }} />
        <div className="particle w-3 h-3 top-[40%] left-[65%]" style={{ animationDelay: '2.5s' }} />
        <div className="particle w-1.5 h-1.5 top-[70%] left-[35%]" style={{ animationDelay: '5s' }} />
        <div className="particle w-2.5 h-2.5 top-[30%] left-[80%]" style={{ animationDelay: '1.2s' }} />
      </div>

      {/* Content Container */}
      <div className="relative max-w-7xl w-full mx-auto px-6 lg:px-12 pb-14 pt-28 z-20 space-y-5">
        {/* Tagline: Small uppercase in electric blue with wide letter-spacing */}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] font-extrabold text-[#3b82f6] font-display">
            FEATURED STREAMING SELECTION
          </span>
          <span className="text-[#2a243a]">·</span>
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#161321]/90 border border-[#2a243a] text-xs font-bold text-amber-400">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{scoreFormatted}</span>
          </div>
        </div>

        {/* Huge Extra-Bold Display Title */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none drop-shadow-lg max-w-3xl">
          {title}
        </h1>

        {/* 3-Line Description */}
        <p className="text-sm sm:text-base text-[#a1a1aa] line-clamp-3 leading-relaxed max-w-2xl font-sans">
          {currentAnime.description?.replace(/<[^>]*>?/gm, '') || 'Dive into this groundbreaking anime series streaming now in full HD on YORUMI.'}
        </p>

        {/* Genre Pills (Rounded-Full, Bordered) */}
        {currentAnime.genres && currentAnime.genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {currentAnime.genres.slice(0, 4).map((g) => (
              <span
                key={g}
                className="px-3 py-1 rounded-full bg-[#161321]/80 border border-[#2a243a] text-[11px] font-semibold text-[#fafafa]"
              >
                {g}
              </span>
            ))}
            {studioName && (
              <span className="px-3 py-1 rounded-full bg-purple-950/40 border border-purple-500/20 text-[11px] font-mono font-semibold text-purple-300">
                {studioName}
              </span>
            )}
          </div>
        )}

        {/* Two Buttons: Gradient Pill CTA & Outlined Pill Secondary */}
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <button
            onClick={() => onWatchAnime(currentAnime.id, 1)}
            className="flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white font-bold text-sm rounded-full shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all active:scale-95"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
            Watch Now
          </button>

          <button
            onClick={() => onSelectAnime(currentAnime.id)}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full glass-panel border border-[#2a243a] hover:bg-purple-600/20 text-white font-semibold text-sm transition-all"
          >
            <Info className="w-4 h-4 text-purple-400" />
            View Details
          </button>

          <button
            onClick={() => updateWatchlist(currentAnime, isBookmarked ? 'WATCHING' : 'PLANNING')}
            className={`p-3.5 rounded-full glass-panel border transition-all ${
              isBookmarked ? 'text-purple-400 border-purple-500/50' : 'text-[#a1a1aa] hover:text-white border-[#2a243a]'
            }`}
            title={isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}
          >
            {isBookmarked ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Slider Controls */}
      <div className="absolute bottom-8 right-6 lg:right-12 z-20 flex items-center gap-3">
        <button
          onClick={() => setCurrentIndex((prev) => (prev - 1 + animeList.length) % animeList.length)}
          className="p-2.5 rounded-full glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 px-2">
          {animeList.slice(0, 5).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex ? 'w-6 bg-gradient-to-r from-purple-500 to-blue-500' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIndex((prev) => (prev + 1) % animeList.length)}
          className="p-2.5 rounded-full glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
