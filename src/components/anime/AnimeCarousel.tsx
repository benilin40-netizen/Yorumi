import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Anime } from '../../types/anime';
import { AnimeCard } from './AnimeCard';

interface AnimeCarouselProps {
  title: string;
  subtitle?: string;
  animeList: Anime[];
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, episode?: number) => void;
  onSeeAll?: () => void;
  showEpisodeBadge?: boolean;
  showRelativeTime?: boolean;
  hideWatchButton?: boolean;
  showCountdown?: boolean;
}

export const AnimeCarousel: React.FC<AnimeCarouselProps> = ({
  title,
  subtitle,
  animeList,
  onSelectAnime,
  onWatchAnime,
  onSeeAll,
  showEpisodeBadge = false,
  showRelativeTime = false,
  hideWatchButton = false,
  showCountdown = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -600 : 600;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (!animeList || animeList.length === 0) return null;

  const words = title.split(' ');
  const firstWords = words.slice(0, -1).join(' ');
  const lastWord = words[words.length - 1];

  return (
    <motion.section
      initial={{ opacity: 0, x: 60 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {firstWords ? `${firstWords} ` : ''}
            <span className="brand-gradient-text">{lastWord}</span>
          </h2>
          {subtitle && (
            <p className="text-xs text-[#a1a1aa] mt-0.5 font-sans">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors mr-2 whitespace-nowrap"
            >
              See All
            </button>
          )}

          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Staggered Horizontal Sideways Rail */}
      <div
        ref={scrollRef}
        className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-2 px-2 scroll-smooth"
      >
        {animeList.map((anime, index) => (
          <motion.div
            key={anime.id}
            initial={{ opacity: 0, x: 36 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{
              duration: 0.35,
              delay: Math.min(index * 0.04, 0.35),
              ease: [0.16, 1, 0.3, 1],
            }}
            className="w-[150px] sm:w-[175px] shrink-0"
          >
            <AnimeCard
              anime={anime}
              onSelect={onSelectAnime}
              onWatch={onWatchAnime}
              showEpisodeBadge={showEpisodeBadge}
              showRelativeTime={showRelativeTime}
              hideWatchButton={hideWatchButton}
              showCountdown={showCountdown}
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};
