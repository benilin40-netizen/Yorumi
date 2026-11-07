import React, { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { Anime } from '../types/anime';
import { getAnimeMovies } from '../services/anilist';
import { AnimeGrid } from '../components/anime/AnimeGrid';

interface PageProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

export const Movies: React.FC<PageProps> = ({ onSelectAnime, onWatchAnime }) => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getAnimeMovies(1, 24);
      setAnimeList(res.media);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Film className="w-8 h-8 text-purple-400" />
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Feature <span className="brand-gradient-text">Anime Movies</span>
          </h1>
          <p className="text-sm text-[#a1a1aa] font-sans">Full length theatrical films, specials, and cinematic achievements</p>
        </div>
      </div>

      <AnimeGrid animeList={animeList} onSelectAnime={onSelectAnime} onWatchAnime={onWatchAnime} loading={loading} />
    </div>
  );
};
