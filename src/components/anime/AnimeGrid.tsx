import React from 'react';
import { Anime } from '../../types/anime';
import { AnimeCard } from './AnimeCard';

interface AnimeGridProps {
  animeList: Anime[];
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, episode?: number) => void;
  loading?: boolean;
}

export const AnimeGrid: React.FC<AnimeGridProps> = ({
  animeList,
  onSelectAnime,
  onWatchAnime,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 animate-pulse">
            <div className="aspect-[3/4] w-full rounded-2xl bg-violet-950/20 border border-violet-500/10" />
            <div className="h-4 w-3/4 rounded bg-violet-950/30" />
            <div className="h-3 w-1/2 rounded bg-violet-950/20" />
          </div>
        ))}
      </div>
    );
  }

  if (!animeList || animeList.length === 0) {
    return (
      <div className="p-12 text-center glass-panel rounded-2xl border border-violet-500/15">
        <p className="text-slate-400 text-sm">No anime entries found for this selection.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
      {animeList.map((anime) => (
        <AnimeCard
          key={anime.id}
          anime={anime}
          onSelect={onSelectAnime}
          onWatch={onWatchAnime}
        />
      ))}
    </div>
  );
};
