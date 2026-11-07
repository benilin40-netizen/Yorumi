import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, Play, Loader2 } from 'lucide-react';
import { Anime } from '../../types/anime';
import { searchAnime } from '../../services/anilist';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnime: (animeId: number) => void;
  onWatchAnime: (animeId: number, episode?: number) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectAnime,
  onWatchAnime,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { media } = await searchAnime({ search: query, perPage: 8 });
        setResults(media);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md">
      <div
        className="w-full max-w-2xl bg-[#161321] rounded-2xl overflow-hidden border border-[#2a243a] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-[#2a243a] bg-[#0d0b14]/90">
          <Search className="w-5 h-5 text-purple-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anime by English, Romaji, or Japanese title..."
            className="w-full bg-transparent text-white placeholder-[#a1a1aa] text-sm sm:text-base outline-none focus:ring-0 font-sans"
          />
          {loading ? (
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0 ml-2" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#a1a1aa] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={onClose}
            className="ml-3 px-2 py-1 text-xs text-[#a1a1aa] border border-[#2a243a] rounded-full hover:text-white hover:border-purple-500/40 font-mono"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-[#2a243a]/40">
          {!query.trim() ? (
            <div className="p-8 text-center text-[#a1a1aa] text-sm font-sans">
              <Search className="w-8 h-8 text-purple-400/40 mx-auto mb-2" />
              Start typing to search AniList catalog...
            </div>
          ) : loading && results.length === 0 ? (
            <div className="p-8 text-center text-[#a1a1aa] text-sm flex items-center justify-center gap-2 font-sans">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              Searching anime catalog...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-[#a1a1aa] text-sm font-sans">
              No anime found for "{query}"
            </div>
          ) : (
            results.map((anime) => {
              const title = anime.title.english || anime.title.romaji;
              return (
                <div
                  key={anime.id}
                  onClick={() => {
                    onSelectAnime(anime.id);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-purple-600/10 transition-colors cursor-pointer group"
                >
                  <img
                    src={anime.coverImage.medium || anime.coverImage.large}
                    alt={title}
                    className="w-12 h-16 object-cover rounded-lg shrink-0 shadow-md group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors font-display">
                      {title}
                    </h4>
                    {anime.title.native && (
                      <p className="text-xs text-[#a1a1aa] truncate font-sans">
                        {anime.title.native}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#a1a1aa]">
                      <span>{anime.format || 'TV'}</span>
                      <span>·</span>
                      <span>{anime.seasonYear || 'N/A'}</span>
                      {anime.averageScore && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-amber-400 font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {(anime.averageScore / 10).toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatchAnime(anime.id, 1);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-full shadow transition-all"
                    >
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                      Watch
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#0d0b14] text-[11px] text-[#a1a1aa] border-t border-[#2a243a] flex items-center justify-between font-sans">
          <span>Powered by AniList GraphQL</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
