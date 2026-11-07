import React, { useState, useEffect } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Anime } from '../types/anime';
import { searchAnime } from '../services/anilist';
import { AnimeGrid } from '../components/anime/AnimeGrid';

interface DiscoverProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Sports',
  'Supernatural',
  'Thriller',
];

const FORMATS = [
  { label: 'All Formats', value: '' },
  { label: 'TV Series', value: 'TV' },
  { label: 'Movie', value: 'MOVIE' },
  { label: 'OVA', value: 'OVA' },
  { label: 'ONA', value: 'ONA' },
  { label: 'Special', value: 'SPECIAL' },
];

const STATUSES = [
  { label: 'All Statuses', value: '' },
  { label: 'Currently Airing', value: 'RELEASING' },
  { label: 'Finished', value: 'FINISHED' },
  { label: 'Not Yet Released', value: 'NOT_YET_RELEASED' },
];

const SORTS = [
  { label: 'Most Popular', value: 'POPULARITY_DESC' },
  { label: 'Highest Rated', value: 'SCORE_DESC' },
  { label: 'Trending', value: 'TRENDING_DESC' },
  { label: 'Newest Added', value: 'START_DATE_DESC' },
];

export const Discover: React.FC<DiscoverProps> = ({ onSelectAnime, onWatchAnime }) => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSort, setSelectedSort] = useState('POPULARITY_DESC');
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);

  const fetchCatalog = async (resetPage = false) => {
    setLoading(true);
    const targetPage = resetPage ? 1 : page;
    try {
      const res = await searchAnime({
        search: searchQuery,
        genre: selectedGenre || undefined,
        format: selectedFormat || undefined,
        status: selectedStatus || undefined,
        sort: selectedSort,
        year: selectedYear,
        page: targetPage,
        perPage: 18,
      });

      if (resetPage) {
        setAnimeList(res.media);
        setPage(1);
      } else {
        setAnimeList(res.media);
      }
      setHasNextPage(res.pageInfo.hasNextPage);
    } catch (err) {
      console.error('Error fetching discovery results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog(true);
  }, [selectedGenre, selectedFormat, selectedStatus, selectedSort, selectedYear]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCatalog(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setSelectedFormat('');
    setSelectedStatus('');
    setSelectedSort('POPULARITY_DESC');
    setSelectedYear(undefined);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Anime <span className="brand-gradient-text">Discovery Hub</span>
        </h1>
        <p className="text-sm text-[#a1a1aa] font-sans">
          Filter thousands of anime titles from the AniList catalog by genre, status, format, and score.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#161321] p-4 sm:p-6 rounded-2xl border border-[#2a243a] shadow-xl space-y-5">
        {/* Search Bar & Sort */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title..."
              className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/50 font-sans"
            />
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="w-full sm:w-auto bg-[#0d0b14] border border-[#2a243a] rounded-full px-4 py-2.5 text-xs font-semibold text-[#fafafa] outline-none font-sans"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value} className="bg-[#161321]">
                  Sort: {s.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleResetFilters}
              className="p-2.5 rounded-full glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Genre Pills */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider font-display">Genres</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedGenre('')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedGenre === '' ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow' : 'bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa] hover:text-white'
              }`}
            >
              All Genres
            </button>
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g === selectedGenre ? '' : g)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selectedGenre === g ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow' : 'bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa] hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-[#2a243a]">
          <div>
            <label className="block text-[11px] text-[#a1a1aa] mb-1 font-sans">Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-full px-3 py-1.5 text-xs text-[#fafafa] outline-none font-sans"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value} className="bg-[#161321]">
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[#a1a1aa] mb-1 font-sans">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-full px-3 py-1.5 text-xs text-[#fafafa] outline-none font-sans"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value} className="bg-[#161321]">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[#a1a1aa] mb-1 font-sans">Year</label>
            <select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-full px-3 py-1.5 text-xs text-[#fafafa] outline-none font-sans"
            >
              <option value="" className="bg-[#161321]">All Years</option>
              {Array.from({ length: 30 }).map((_, i) => {
                const y = new Date().getFullYear() - i;
                return (
                  <option key={y} value={y} className="bg-[#161321]">
                    {y}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <AnimeGrid
        animeList={animeList}
        onSelectAnime={onSelectAnime}
        onWatchAnime={onWatchAnime}
        loading={loading}
      />

      {/* Pagination Controls */}
      {!loading && animeList.length > 0 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => {
              const newP = page - 1;
              setPage(newP);
              searchAnime({
                search: searchQuery,
                genre: selectedGenre || undefined,
                format: selectedFormat || undefined,
                status: selectedStatus || undefined,
                sort: selectedSort,
                year: selectedYear,
                page: newP,
                perPage: 18,
              }).then((res) => {
                setAnimeList(res.media);
                setHasNextPage(res.pageInfo.hasNextPage);
              });
            }}
            className="px-5 py-2 glass-panel border border-[#2a243a] disabled:opacity-40 text-xs font-bold text-[#fafafa] rounded-full"
          >
            Previous Page
          </button>

          <span className="text-xs font-mono text-[#a1a1aa]">Page {page}</span>

          <button
            disabled={!hasNextPage}
            onClick={() => {
              const newP = page + 1;
              setPage(newP);
              searchAnime({
                search: searchQuery,
                genre: selectedGenre || undefined,
                format: selectedFormat || undefined,
                status: selectedStatus || undefined,
                sort: selectedSort,
                year: selectedYear,
                page: newP,
                perPage: 18,
              }).then((res) => {
                setAnimeList(res.media);
                setHasNextPage(res.pageInfo.hasNextPage);
              });
            }}
            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 disabled:opacity-40 text-xs font-bold text-white rounded-full shadow"
          >
            Next Page
          </button>
        </div>
      )}
    </div>
  );
};
