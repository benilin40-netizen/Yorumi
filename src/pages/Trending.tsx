import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Anime } from '../types/anime';
import { getTrendingAnime } from '../services/anilist';
import { AnimeGrid } from '../components/anime/AnimeGrid';

interface PageProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

export const Trending: React.FC<PageProps> = ({ onSelectAnime, onWatchAnime }) => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getTrendingAnime(1, 24);
      setAnimeList(res.media);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-8 h-8 text-purple-400" />
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Trending <span className="brand-gradient-text">Anime</span>
          </h1>
          <p className="text-sm text-[#a1a1aa] font-sans">Current viral and high-engagement anime series worldwide</p>
        </div>
      </div>

      <AnimeGrid animeList={animeList} onSelectAnime={onSelectAnime} onWatchAnime={onWatchAnime} loading={loading} />
    </div>
  );
};
