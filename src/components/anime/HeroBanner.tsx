import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Info,
  Star,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Check,
  Film,
  Clock,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime } from '../../types/anime';
import { useUser } from '../../contexts/UserContext';

interface HeroBannerProps {
  animeList: Anime[];
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, episode?: number) => void;
}

const SLIDE_DURATION_MS = 8000;
const TRAILER_DELAY_MS = 1500;

function formatNextEpisodeCountdown(airingAt?: number | null): string | null {
  if (!airingAt) return null;
  const diff = airingAt - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'New episode airing now';
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) {
    return `Next episode in ${days}d ${String(hours).padStart(2, '0')}h`;
  }
  return `Next episode in ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  animeList,
  onSelectAnime,
  onWatchAnime,
}) => {
  // Strictly enforce: ONLY currently airing (RELEASING) with at least one aired episode
  const airingSlides = (animeList || []).filter(
    (a) => a.status === 'RELEASING' && (a.airedEpisodes ?? 0) >= 1
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [trailerReady, setTrailerReady] = useState(false);
  const [trailerModalAnime, setTrailerModalAnime] = useState<Anime | null>(null);
  const [progress, setProgress] = useState(0);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [, setTick] = useState(0);

  const touchStartX = useRef<number | null>(null);
  const safeIndex = airingSlides.length > 0 ? currentIndex % airingSlides.length : 0;
  const currentAnime = airingSlides[safeIndex];

  // Live countdown ticker every 30s
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  // Fade in muted trailer 1.5s after slide becomes active (airing titles only, 1 trailer at a time)
  useEffect(() => {
    setTrailerReady(false);
    if (!currentAnime?.trailer?.id || currentAnime.trailer.site !== 'youtube' || currentAnime.status !== 'RELEASING') {
      return;
    }
    const timer = window.setTimeout(() => {
      setTrailerReady(true);
    }, TRAILER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [safeIndex, currentAnime?.id, currentAnime?.trailer?.id]);

  // 8s auto-advance + glowing progress bar (pauses on hover or when trailer modal is open)
  useEffect(() => {
    if (airingSlides.length <= 1 || isHovered || trailerModalAnime) return;

    const stepMs = 100;
    const increment = (stepMs / SLIDE_DURATION_MS) * 100;

    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev + increment >= 100) {
          setCurrentIndex((idx) => (idx + 1) % airingSlides.length);
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => window.clearInterval(interval);
  }, [airingSlides.length, isHovered, trailerModalAnime]);

  // Reset progress on slide change
  useEffect(() => {
    setProgress(0);
  }, [safeIndex]);

  const { updateWatchlist, getWatchlistItem } = useUser();

  if (!currentAnime) return null;

  const title = currentAnime.title.english || currentAnime.title.romaji;
  const watchlistItem = getWatchlistItem(currentAnime.id);
  const isBookmarked = !!watchlistItem;
  const studioName = currentAnime.studios?.nodes?.[0]?.name;
  const scoreFormatted = currentAnime.averageScore
    ? (currentAnime.averageScore / 10).toFixed(1)
    : null;
  const latestEp = currentAnime.airedEpisodes || 1;
  const countdownText = formatNextEpisodeCountdown(currentAnime.nextAiringEpisode?.airingAt);
  const hasYouTubeTrailer =
    currentAnime.status === 'RELEASING' &&
    currentAnime.trailer?.site === 'youtube' &&
    Boolean(currentAnime.trailer?.id);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 10;
    setMouseOffset({ x: nx, y: ny });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || airingSlides.length <= 1) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 45) {
      if (delta < 0) {
        setCurrentIndex((prev) => (prev + 1) % airingSlides.length);
      } else {
        setCurrentIndex((prev) => (prev - 1 + airingSlides.length) % airingSlides.length);
      }
    }
    touchStartX.current = null;
  };

  return (
    <>
      <section
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setMouseOffset({ x: 0, y: 0 });
        }}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full min-h-[72vh] max-h-[760px] overflow-hidden bg-[#0d0b14] flex flex-col justify-end select-none"
      >
        {/* Background Banner with Ken Burns Zoom + Muted Trailer Fade-In */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAnime.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            <img
              src={currentAnime.bannerImage || currentAnime.coverImage.extraLarge}
              alt={title}
              className="w-full h-full object-cover object-center opacity-55 ken-burns filter brightness-90"
              referrerPolicy="no-referrer"
            />

            {/* Single Active Muted Trailer Layer (fades in after 1.5s) */}
            {hasYouTubeTrailer && trailerReady && !trailerModalAnime && (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-1000 opacity-65 overflow-hidden"
                aria-hidden="true"
              >
                <iframe
                  key={`hero-trailer-${currentAnime.id}`}
                  src={`https://www.youtube.com/embed/${currentAnime.trailer!.id}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${currentAnime.trailer!.id}&modestbranding=1&playsinline=1`}
                  title={`${title} muted trailer`}
                  className="w-full h-[135%] -top-[17.5%] relative border-0 scale-110"
                  allow="autoplay; encrypted-media"
                  tabIndex={-1}
                />
              </div>
            )}

            {/* Contrast Scrims */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0d0b14] via-[#0d0b14]/85 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0b14] via-[#0d0b14]/45 to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Content Grid: Left Details + Right Parallax Poster */}
        <div className="relative max-w-7xl w-full mx-auto px-6 lg:px-12 pb-14 pt-24 z-20 flex items-end justify-between gap-10">
          <div className="flex-1 max-w-2xl space-y-4">
            {/* Airing Meta & Countdown Line */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="uppercase tracking-[0.18em] font-extrabold text-[#3b82f6] font-display">
                AIRING NOW · EP {latestEp}
              </span>
              {countdownText && (
                <>
                  <span className="text-[#2a243a]">·</span>
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-purple-300 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    {countdownText}
                  </span>
                </>
              )}
              {scoreFormatted && (
                <>
                  <span className="text-[#2a243a]">·</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-400 tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {scoreFormatted}
                  </span>
                </>
              )}
            </div>

            {/* Title Sliding In From Left */}
            <AnimatePresence mode="wait">
              <motion.h1
                key={`title-${currentAnime.id}`}
                initial={{ opacity: 0, x: -48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="font-display text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.06] drop-shadow-lg"
                style={{ textWrap: 'balance' } as React.CSSProperties}
              >
                {title}
              </motion.h1>
            </AnimatePresence>

            {/* Description */}
            <p className="text-sm sm:text-base text-[#a1a1aa] line-clamp-3 leading-relaxed font-sans">
              {currentAnime.description?.replace(/<[^>]*>?/gm, '') ||
                'Catch every episode as it airs on YORUMI.'}
            </p>

            {/* Genre Chips */}
            {currentAnime.genres && currentAnime.genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {currentAnime.genres.slice(0, 4).map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-md bg-[#161321]/85 border border-[#2a243a] text-[11px] font-semibold text-[#fafafa]"
                  >
                    {g}
                  </span>
                ))}
                {studioName && (
                  <span className="px-3 py-1 rounded-md bg-purple-950/50 border border-purple-500/30 text-[11px] font-mono font-semibold text-purple-300">
                    {studioName}
                  </span>
                )}
              </div>
            )}

            {/* Watch + Trailer + Details + Bookmark Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onWatchAnime(currentAnime.id, latestEp)}
                className="flex items-center gap-2.5 px-7 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white font-bold text-sm rounded-full shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                Watch EP {latestEp}
              </button>

              {hasYouTubeTrailer && (
                <button
                  onClick={() => setTrailerModalAnime(currentAnime)}
                  className="flex items-center gap-2 px-5 py-3 rounded-full glass-panel border border-[#2a243a] hover:border-purple-500/50 text-white font-semibold text-sm transition-all"
                >
                  <Film className="w-4 h-4 text-purple-400" />
                  Trailer
                </button>
              )}

              <button
                onClick={() => onSelectAnime(currentAnime.id)}
                className="flex items-center gap-2 px-5 py-3 rounded-full glass-panel border border-[#2a243a] hover:bg-purple-600/20 text-white font-semibold text-sm transition-all"
              >
                <Info className="w-4 h-4 text-purple-400" />
                Details
              </button>

              <button
                onClick={() =>
                  updateWatchlist(currentAnime, isBookmarked ? 'WATCHING' : 'PLANNING')
                }
                className={`p-3 rounded-full glass-panel border transition-all ${
                  isBookmarked
                    ? 'text-purple-400 border-purple-500/50'
                    : 'text-[#a1a1aa] hover:text-white border-[#2a243a]'
                }`}
                title={isBookmarked ? 'In Watchlist' : 'Add to Watchlist'}
              >
                {isBookmarked ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Parallax Poster */}
          <motion.div
            key={`poster-${currentAnime.id}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{
              opacity: 1,
              y: 0,
              x: -mouseOffset.x,
              rotateY: mouseOffset.x * 0.4,
              rotateX: -mouseOffset.y * 0.4,
            }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            onClick={() => onSelectAnime(currentAnime.id)}
            className="hidden lg:block w-52 xl:w-60 shrink-0 aspect-[3/4] rounded-2xl overflow-hidden border border-purple-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.75)] cursor-pointer group"
          >
            <img
              src={currentAnime.coverImage.extraLarge || currentAnime.coverImage.large}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>

        {/* Slider Controls */}
        {airingSlides.length > 1 && (
          <div className="absolute bottom-8 right-6 lg:right-12 z-20 flex items-center gap-3">
            <button
              onClick={() =>
                setCurrentIndex((prev) => (prev - 1 + airingSlides.length) % airingSlides.length)
              }
              className="p-2.5 rounded-full glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              {airingSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === safeIndex
                      ? 'w-7 bg-gradient-to-r from-purple-500 to-blue-500'
                      : 'w-1.5 bg-white/25 hover:bg-white/40'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % airingSlides.length)}
              className="p-2.5 rounded-full glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Glowing Auto-Advance Progress Bar */}
        {airingSlides.length > 1 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10 z-30">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-blue-500 shadow-[0_0_12px_rgba(168,85,247,0.8)] transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </section>

      {/* Trailer Modal */}
      {trailerModalAnime && trailerModalAnime.trailer?.id && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setTrailerModalAnime(null)}
        >
          <div
            className="w-full max-w-4xl bg-[#161321] rounded-2xl border border-[#2a243a] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a243a] bg-[#0d0b14]">
              <h3 className="font-display font-bold text-white text-sm">
                {trailerModalAnime.title.english || trailerModalAnime.title.romaji} — Official Trailer
              </h3>
              <button
                onClick={() => setTrailerModalAnime(null)}
                className="p-1.5 text-[#a1a1aa] hover:text-white rounded-lg"
                aria-label="Close Trailer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${trailerModalAnime.trailer.id}?autoplay=1`}
                title="Anime Trailer"
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
