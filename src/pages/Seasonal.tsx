import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Anime } from '../types/anime';
import { getSeasonalAnime } from '../services/anilist';
import { AnimeGrid } from '../components/anime/AnimeGrid';

interface PageProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

export const Seasonal: React.FC<PageProps> = ({ onSelectAnime, onWatchAnime }) => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<string>('WINTER');
  const [year] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getSeasonalAnime(selectedSeason, year, 1, 24);
      setAnimeList(res.media);
      setLoading(false);
    }
    load();
  }, [selectedSeason, year]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-purple-400" />
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Seasonal <span className="brand-gradient-text">Lineup</span>
            </h1>
            <p className="text-sm text-[#a1a1aa] font-sans">Track seasonal lineups from Winter, Spring, Summer, and Fall</p>
          </div>
        </div>

        {/* Season Pill Switcher */}
        <div className="flex items-center p-1 bg-[#161321] rounded-full border border-[#2a243a] text-xs">
          {['WINTER', 'SPRING', 'SUMMER', 'FALL'].map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSeason(s)}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
                selectedSeason === s ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <AnimeGrid animeList={animeList} onSelectAnime={onSelectAnime} onWatchAnime={onWatchAnime} loading={loading} />
    </div>
  );
};
