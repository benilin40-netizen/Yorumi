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
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const loadSeason = async (targetSeason: string, targetPage: number) => {
    setLoading(true);
    setErrorNotice(null);
    try {
      const res = await getSeasonalAnime(targetSeason, year, targetPage, 24);
      setAnimeList(res.media);
      setHasNextPage(res.pageInfo.hasNextPage);
      setPage(targetPage);
      if (res.isFallback) {
        setErrorNotice('Showing cached seasonal lineup while reconnecting to AniList gateway.');
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to load seasonal anime');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeason(selectedSeason, 1);
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

      {errorNotice && (
        <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl text-xs text-purple-300">
          ℹ {errorNotice}
        </div>
      )}

      <AnimeGrid animeList={animeList} onSelectAnime={onSelectAnime} onWatchAnime={onWatchAnime} loading={loading} />

      {!loading && animeList.length > 0 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => loadSeason(selectedSeason, page - 1)}
            className="px-5 py-2 glass-panel border border-[#2a243a] disabled:opacity-40 text-xs font-bold text-[#fafafa] rounded-full hover:border-purple-500/40"
          >
            Previous Page
          </button>
          <span className="text-xs font-mono text-[#a1a1aa]">Page {page}</span>
          <button
            disabled={!hasNextPage}
            onClick={() => loadSeason(selectedSeason, page + 1)}
            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 disabled:opacity-40 text-xs font-bold text-white rounded-full shadow"
          >
            Next Page
          </button>
        </div>
      )}
    </div>
  );
};
