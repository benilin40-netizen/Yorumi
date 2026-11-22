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
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const loadPage = async (targetPage: number) => {
    setLoading(true);
    setErrorNotice(null);
    try {
      const res = await getTrendingAnime(targetPage, 24);
      setAnimeList(res.media);
      setHasNextPage(res.pageInfo.hasNextPage);
      setPage(targetPage);
      if (res.isFallback) {
        setErrorNotice('Showing cached trending lineup while reconnecting to AniList gateway.');
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to load trending anime');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(1);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-purple-400" />
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Trending <span className="brand-gradient-text">Anime</span>
            </h1>
            <p className="text-sm text-[#a1a1aa] font-sans">Current viral and high-engagement anime series worldwide</p>
          </div>
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
            onClick={() => loadPage(page - 1)}
            className="px-5 py-2 glass-panel border border-[#2a243a] disabled:opacity-40 text-xs font-bold text-[#fafafa] rounded-full hover:border-purple-500/40"
          >
            Previous Page
          </button>
          <span className="text-xs font-mono text-[#a1a1aa]">Page {page}</span>
          <button
            disabled={!hasNextPage}
            onClick={() => loadPage(page + 1)}
            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 disabled:opacity-40 text-xs font-bold text-white rounded-full shadow"
          >
            Next Page
          </button>
        </div>
      )}
    </div>
  );
};
