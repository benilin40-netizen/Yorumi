import React, { useEffect, useState } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { Anime } from '../types/anime';
import { getAnimeById } from '../services/anilist';
import { VideoPlayer } from '../components/player/VideoPlayer';
import { AnimeCarousel } from '../components/anime/AnimeCarousel';

interface WatchProps {
  animeId: number;
  initialEpisode?: number;
  onSelectAnime: (id: number) => void;
  onNavigateBack: () => void;
}

export const Watch: React.FC<WatchProps> = ({
  animeId,
  initialEpisode = 1,
  onSelectAnime,
  onNavigateBack,
}) => {
  const [anime, setAnime] = useState<Anime | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<number>(initialEpisode);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getAnimeById(animeId);
      setAnime(data);
      setLoading(false);
    }
    load();
  }, [animeId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6 animate-pulse">
        <div className="h-8 w-40 rounded-full bg-[#161321]" />
        <div className="aspect-video w-full rounded-2xl bg-[#161321] border border-[#2a243a]" />
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-white font-display">Anime Not Found</h2>
        <p className="text-[#a1a1aa] text-sm">Could not load streaming catalog details for ID {animeId}.</p>
        <button
          onClick={onNavigateBack}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold rounded-full shadow"
        >
          Back to Browse
        </button>
      </div>
    );
  }

  const title = anime.title.english || anime.title.romaji;
  const totalEpisodes = anime.episodes || 24;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-8">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onNavigateBack}
          className="flex items-center gap-2 text-xs font-bold text-white glass-panel border border-[#2a243a] px-4 py-2 rounded-full transition-colors hover:bg-purple-600/20"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={() => onSelectAnime(anime.id)}
          className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"
        >
          View Full Anime Details →
        </button>
      </div>

      {/* Unified Streaming Video Player */}
      <VideoPlayer
        anime={anime}
        currentEpisode={currentEpisode}
        onEpisodeChange={(ep) => setCurrentEpisode(ep)}
      />

      {/* Episode Selection Grid */}
      <section className="space-y-4 p-6 bg-[#161321] rounded-2xl border border-[#2a243a] shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white">
            Episode Selection ({totalEpisodes} Episodes)
          </h3>
          <span className="text-xs font-mono font-bold text-purple-400">Currently Ep {currentEpisode}</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 max-h-60 overflow-y-auto pr-1">
          {Array.from({ length: totalEpisodes }).map((_, i) => {
            const epNum = i + 1;
            const isActive = epNum === currentEpisode;
            return (
              <button
                key={epNum}
                onClick={() => setCurrentEpisode(epNum)}
                className={`py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                    : 'bg-[#0d0b14] text-[#a1a1aa] hover:text-white hover:bg-[#201c2e] border border-[#2a243a]'
                }`}
              >
                {epNum}
              </button>
            );
          })}
        </div>
      </section>

      {/* Anime Overview Box */}
      <div className="p-6 bg-[#161321] rounded-2xl border border-[#2a243a] flex flex-col md:flex-row gap-6 shadow-xl">
        <img
          src={anime.coverImage.extraLarge || anime.coverImage.large}
          alt={title}
          className="w-28 sm:w-36 aspect-[3/4] object-cover rounded-xl shrink-0 shadow-lg"
          referrerPolicy="no-referrer"
        />
        <div className="space-y-3 flex-1">
          <h2 className="text-xl font-bold text-white font-display">{title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#a1a1aa]">
            <span>{anime.format || 'TV'}</span>
            <span>·</span>
            <span>{anime.seasonYear || 'N/A'}</span>
            {anime.averageScore && (
              <>
                <span>·</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {(anime.averageScore / 10).toFixed(1)}
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-[#a1a1aa] leading-relaxed line-clamp-4 font-sans">
            {anime.description?.replace(/<[^>]*>?/gm, '')}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      {anime.recommendations?.nodes && anime.recommendations.nodes.length > 0 && (
        <AnimeCarousel
          title="Recommended If You Like This"
          animeList={anime.recommendations.nodes
            .map((n) => n.mediaRecommendation)
            .filter(Boolean)}
          onSelectAnime={onSelectAnime}
          onWatchAnime={(id) => {
            onSelectAnime(id);
          }}
        />
      )}
    </div>
  );
};
