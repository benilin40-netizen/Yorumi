import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimeCard } from './AnimeCard';

interface AnimeCarouselProps {
  title: string;
  subtitle?: string;
  animeList: Anime[];
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, episode?: number) => void;
  onSeeAll?: () => void;
}

export const AnimeCarousel: React.FC<AnimeCarouselProps> = ({
  title,
  subtitle,
  animeList,
  onSelectAnime,
  onWatchAnime,
  onSeeAll,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -600 : 600;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (!animeList || animeList.length === 0) return null;

  // Split title words to make last word gradient text
  const words = title.split(' ');
  const firstWords = words.slice(0, -1).join(' ');
  const lastWord = words[words.length - 1];

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {firstWords ? `${firstWords} ` : ''}
            <span className="brand-gradient-text">{lastWord}</span>
          </h2>
          {subtitle && (
            <p className="text-xs text-[#a1a1aa] mt-0.5 font-sans">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors mr-2"
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

      {/* Horizontal Sideways Rail with hidden scrollbar */}
      <div
        ref={scrollRef}
        className="flex items-center gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-2 px-2 scroll-smooth"
      >
        {animeList.map((anime) => (
          <div key={anime.id} className="w-[150px] sm:w-[175px] shrink-0">
            <AnimeCard
              anime={anime}
              onSelect={onSelectAnime}
              onWatch={onWatchAnime}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
