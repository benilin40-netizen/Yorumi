import React, { useEffect, useState } from 'react';
import { ArrowLeft, Star, Lock, AlertTriangle, Play, Calendar, Tv, Clock, Search, CheckCircle2 } from 'lucide-react';
import { Anime } from '../types/anime';
import { getAnimeById } from '../services/anilist';
import { VideoPlayer } from '../components/player/VideoPlayer';
import { AnimeCarousel } from '../components/anime/AnimeCarousel';
import {
  calculateAnimeEpisodeSchedule,
  isEpisodePlayable,
  syncEpisodeReleasesAndNotify,
  fetchOfficialEpisodeTitles,
  AnimeEpisodeSchedule,
  EpisodeInfo,
} from '../services/episodeService';
import { CountdownCard } from '../components/countdown/CountdownCard';
import { useUser } from '../contexts/UserContext';

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
  const { history } = useUser();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<number>(initialEpisode);
  const [loading, setLoading] = useState(true);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');
  const [officialTitlesMap, setOfficialTitlesMap] = useState<Record<number, { title: string; synopsis?: string }>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getAnimeById(animeId);
      setAnime(data);
      if (data) {
        syncEpisodeReleasesAndNotify(data);
        const schedule = calculateAnimeEpisodeSchedule(data);
        if (initialEpisode > schedule.latestReleasedEpisode && schedule.latestReleasedEpisode > 0) {
          setCurrentEpisode(schedule.latestReleasedEpisode);
        } else {
          setCurrentEpisode(initialEpisode);
        }

        // Fetch official titles from Jikan
        const titles = await fetchOfficialEpisodeTitles(data.id, data.idMal);
        setOfficialTitlesMap(titles);
      }
      setLoading(false);
    }
    load();
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
  const schedule: AnimeEpisodeSchedule = calculateAnimeEpisodeSchedule(anime);
  const playableCheck = isEpisodePlayable(anime, currentEpisode);

  // Check watched episodes from history
  const watchedEpSet = new Set(
    history.filter((h) => h.animeId === anime.id).map((h) => h.episode)
  );

  // Filter episodes by search query
  const filteredEpisodes = schedule.episodes.filter((ep) => {
    if (!episodeSearchQuery.trim()) return true;
    const q = episodeSearchQuery.toLowerCase();
    const epTitle = (ep.officialTitle || ep.title).toLowerCase();
    return epTitle.includes(q) || ep.episodeNumber.toString().includes(q);
  });

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

      {/* Progressive Release Verification Notice if Episode Not Playable */}
      {!playableCheck.playable ? (
        <div className="p-8 bg-[#161321] rounded-2xl border border-amber-500/30 text-center space-y-4 shadow-2xl font-sans">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-display">
              Episode {currentEpisode} Is Not Available
            </h3>
            <p className="text-xs text-[#a1a1aa] mt-1 max-w-md mx-auto leading-relaxed">
              {playableCheck.reason}
            </p>
          </div>

          {schedule.latestReleasedEpisode > 0 && (
            <button
              onClick={() => setCurrentEpisode(schedule.latestReleasedEpisode)}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-full shadow-lg transition-all"
            >
              Watch Latest Released Episode (Ep {schedule.latestReleasedEpisode})
            </button>
          )}
        </div>
      ) : (
        /* Unified Streaming Video Player */
        <VideoPlayer
          anime={anime}
          currentEpisode={currentEpisode}
          onEpisodeChange={(ep) => setCurrentEpisode(ep)}
        />
      )}

      {/* Premium Episode List & Search Interface */}
      <section className="space-y-4 p-6 bg-[#161321] rounded-2xl border border-[#2a243a] shadow-xl font-sans">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a243a] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-purple-400" />
              <h3 className="font-display text-lg font-bold text-white">
                Episodes Catalogue ({schedule.latestReleasedEpisode} Available)
              </h3>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Official release schedule, episode titles, and playback status.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Episode Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search episode title or number..."
                value={episodeSearchQuery}
                onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                className="bg-[#0d0b14] border border-[#2a243a] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60 w-48 sm:w-64"
              />
            </div>
            <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-full text-[11px] font-mono font-bold">
              {anime.status === 'RELEASING' ? 'AIRING' : 'FINISHED'}
            </span>
          </div>
        </div>

        {/* Detailed Episode List Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[500px] overflow-y-auto pr-1">
          {filteredEpisodes.map((ep) => {
            const isActive = ep.episodeNumber === currentEpisode;
            const isReleased = ep.status === 'released' && ep.hasStreamSource;
            const isWatched = watchedEpSet.has(ep.episodeNumber);
            const officialInfo = officialTitlesMap[ep.episodeNumber];
            const epDisplayTitle = officialInfo?.title
              ? `Ep ${ep.episodeNumber} — ${officialInfo.title}`
              : ep.officialTitle
              ? `Ep ${ep.episodeNumber} — ${ep.officialTitle}`
              : `Episode ${ep.episodeNumber < 10 ? '0' + ep.episodeNumber : ep.episodeNumber}`;

            return (
              <div
                key={ep.episodeNumber}
                onClick={() => {
                  if (isReleased) setCurrentEpisode(ep.episodeNumber);
                }}
                className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-950/70 to-blue-950/70 border-purple-500 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/50'
                    : isReleased
                    ? 'bg-[#0d0b14] hover:bg-[#201c2e] border-[#2a243a] cursor-pointer'
                    : 'bg-[#0d0b14]/40 border-[#2a243a]/30 text-zinc-500 cursor-not-allowed opacity-75'
                }`}
              >
                {/* Thumbnail / Cover */}
                <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-[#161321] border border-[#2a243a] shrink-0">
                  <img
                    src={ep.thumbnail || anime.coverImage.large}
                    alt={epDisplayTitle}
                    className="w-full h-full object-cover"
                  />
                  {isWatched && (
                    <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 bg-purple-600/40 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono font-bold text-purple-400">
                      EPISODE {ep.episodeNumber}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded ${
                        isReleased
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : ep.status === 'upcoming'
                          ? 'bg-zinc-800 text-zinc-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {ep.statusLabel}
                    </span>
                  </div>

                  <h4 className={`text-xs font-bold truncate ${isActive ? 'text-white font-display' : 'text-zinc-200'}`}>
                    {epDisplayTitle}
                  </h4>

                  <p className="text-[11px] text-[#a1a1aa] line-clamp-1">
                    {officialInfo?.synopsis || ep.releaseDateFormatted || 'Official Episode Broadcast'}
                  </p>

                  <div className="pt-1 flex items-center justify-between">
                    {isReleased ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentEpisode(ep.episodeNumber);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                          isActive
                            ? 'bg-purple-600 text-white shadow'
                            : 'bg-[#161321] hover:bg-purple-600/30 text-purple-300 border border-[#2a243a]'
                        }`}
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        {isActive ? 'Playing Now' : isWatched ? 'Watch Again' : 'Watch Ep'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Unreleased
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Next Airing Countdown Card if Airing */}
      {anime.nextAiringEpisode && (
        <div className="p-6 bg-[#161321] rounded-2xl border border-purple-500/30 space-y-3 shadow-xl font-sans">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <h3 className="font-display text-sm font-bold text-white">Next Upcoming Episode Airing Schedule</h3>
          </div>
          <CountdownCard
            anime={anime}
            episodeNumber={anime.nextAiringEpisode.episode}
            airingAtTimestamp={anime.nextAiringEpisode.airingAt}
            onSelect={onSelectAnime}
            onWatch={(id, ep) => {
              if (ep) setCurrentEpisode(ep);
            }}
          />
        </div>
      )}

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
