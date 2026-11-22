import React, { useEffect, useState } from 'react';
import { ArrowLeft, Star, Clock, AlertCircle } from 'lucide-react';
import { Anime, ConfirmedEpisodesResponse } from '../types/anime';
import { getAnimeById, getAnimeEpisodes } from '../services/anilist';
import { VideoPlayer } from '../components/player/VideoPlayer';
import { AnimeCarousel } from '../components/anime/AnimeCarousel';

interface WatchProps {
  animeId: number;
  initialEpisode?: number;
  onSelectAnime: (id: number) => void;
  onNavigateBack: () => void;
}

function formatNextCountdown(airingAt: number): string {
  const diff = airingAt - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'airing now';
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
  return `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
}

export const Watch: React.FC<WatchProps> = ({
  animeId,
  initialEpisode = 1,
  onSelectAnime,
  onNavigateBack,
}) => {
  const [anime, setAnime] = useState<Anime | null>(null);
  const [epInfo, setEpInfo] = useState<ConfirmedEpisodesResponse | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<number>(initialEpisode);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [data, episodesData] = await Promise.all([
        getAnimeById(animeId),
        getAnimeEpisodes(animeId),
      ]);
      if (!active) return;
      setAnime(data);
      setEpInfo(episodesData);

      const airedCount = episodesData?.airedEpisodes?.length || 0;
      if (airedCount > 0) {
        const clamped = Math.min(Math.max(1, initialEpisode), airedCount);
        setCurrentEpisode(clamped);
      } else {
        setCurrentEpisode(1);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [animeId, initialEpisode]);

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
        <p className="text-[#a1a1aa] text-sm">Could not load catalog details for AniList ID {animeId}.</p>
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
  const airedEpisodes = epInfo?.airedEpisodes || [];
  const airedCount = airedEpisodes.length;
  const totalKnown = epInfo?.totalEpisodes ?? anime.episodes ?? null;
  const nextEp = epInfo?.nextAiringEpisode || null;

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

      {/* Unified Streaming Video Player or Unaired Notice */}
      {airedCount > 0 ? (
        <VideoPlayer
          anime={anime}
          currentEpisode={currentEpisode}
          airedEpisodeCount={airedCount}
          nextAiringEpisode={nextEp}
          onEpisodeChange={(ep) => setCurrentEpisode(ep)}
        />
      ) : (
        <div className="p-10 rounded-2xl bg-[#161321] border border-[#2a243a] text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="font-display text-xl font-bold text-white">{title} — Coming Soon</h2>
          <p className="text-xs text-[#a1a1aa] max-w-md mx-auto">
            No episodes have aired yet for this title. Unaired episodes cannot be streamed until their release time.
          </p>
          {nextEp && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0d0b14] border border-purple-500/30 text-xs font-mono text-purple-300 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>
                Next: EP {nextEp.episode} in {formatNextCountdown(nextEp.airingAt)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Episode Selection Grid (Strictly Confirmed Aired Episodes Only — Never Padded) */}
      <section className="space-y-4 p-6 bg-[#161321] rounded-2xl border border-[#2a243a] shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              Aired Episodes ({airedCount}
              {totalKnown ? ` / ${totalKnown}` : ' aired'})
            </h3>
            <p className="text-[11px] text-[#a1a1aa]">
              Showing only episodes confirmed as aired by AniList schedule or streaming providers.
            </p>
          </div>
          {airedCount > 0 && (
            <span className="text-xs font-mono font-bold text-purple-400 tabular-nums">
              Playing EP {currentEpisode}
            </span>
          )}
        </div>

        {airedCount > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 max-h-60 overflow-y-auto pr-1">
            {airedEpisodes.map((epItem) => {
              const isActive = epItem.episode === currentEpisode;
              return (
                <button
                  key={epItem.episode}
                  onClick={() => setCurrentEpisode(epItem.episode)}
                  className={`py-2 rounded-lg text-xs font-mono font-bold transition-all tabular-nums ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                      : 'bg-[#0d0b14] text-[#a1a1aa] hover:text-white hover:bg-[#201c2e] border border-[#2a243a]'
                  }`}
                >
                  {epItem.episode}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[#a1a1aa]">No aired episodes available yet.</p>
        )}

        {/* Unaired Next Episode Countdown Only (Never Playable) */}
        {nextEp && (
          <div className="pt-3 border-t border-[#2a243a] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-purple-300 font-mono tabular-nums">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>
                Next: EP {nextEp.episode} in {formatNextCountdown(nextEp.airingAt)}
              </span>
            </div>
            <span className="text-[11px] text-[#a1a1aa] font-mono">
              {new Date(nextEp.airingAt * 1000).toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
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
            <span>{anime.seasonYear || anime.startDate?.year || 'N/A'}</span>
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
          onWatchAnime={(id) => onSelectAnime(id)}
        />
      )}
    </div>
  );
};
