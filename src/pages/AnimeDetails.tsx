import React, { useEffect, useState } from 'react';
import {
  Play,
  Star,
  Heart,
  Film,
  ArrowLeft,
  Clock,
  Trash2,
  Check,
} from 'lucide-react';
import { Anime, ConfirmedEpisodesResponse, WatchStatus } from '../types/anime';
import { getAnimeById, getAnimeEpisodes } from '../services/anilist';
import { useUser } from '../contexts/UserContext';
import { AnimeCarousel } from '../components/anime/AnimeCarousel';
import { CountdownCard } from '../components/countdown/CountdownCard';

interface AnimeDetailsProps {
  animeId: number;
  onWatchAnime: (id: number, episode?: number) => void;
  onSelectAnime: (id: number) => void;
  onNavigateBack: () => void;
}

export const AnimeDetails: React.FC<AnimeDetailsProps> = ({
  animeId,
  onWatchAnime,
  onSelectAnime,
  onNavigateBack,
}) => {
  const [anime, setAnime] = useState<Anime | null>(null);
  const [epInfo, setEpInfo] = useState<ConfirmedEpisodesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { updateWatchlist, removeFromWatchlist, getWatchlistItem, toggleFavorite, isFavorite } = useUser();

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
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [animeId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 space-y-8 animate-pulse">
        <div className="h-96 rounded-2xl bg-[#161321] border border-[#2a243a]" />
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-white font-display">Anime Not Found</h2>
        <button
          onClick={onNavigateBack}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold rounded-full shadow"
        >
          Go Back
        </button>
      </div>
    );
  }

  const title = anime.title.english || anime.title.romaji;
  const watchlistItem = getWatchlistItem(anime.id);
  const favorited = isFavorite(anime.id);
  const studioName = anime.studios?.nodes?.[0]?.name;
  const scoreFormatted = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const airedEpisodes = epInfo?.airedEpisodes || [];
  const airedCount = airedEpisodes.length;
  const isUnreleased =
    anime.status === 'NOT_YET_RELEASED' || Boolean(anime.isUnreleased) || airedCount === 0;
  const latestEp = airedCount > 0 ? airedEpisodes[airedCount - 1].episode : 1;

  return (
    <div className="space-y-12 pb-16">
      {/* Banner Artwork Header */}
      <div className="relative w-full h-[55vh] min-h-[400px] max-h-[520px] bg-[#0d0b14] overflow-hidden">
        <img
          src={anime.bannerImage || anime.coverImage.extraLarge}
          alt={title}
          className="w-full h-full object-cover object-center filter brightness-75 scale-105 opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0b14] via-[#0d0b14]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0b14] via-[#0d0b14]/60 to-transparent" />

        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={onNavigateBack}
            className="flex items-center gap-2 text-xs font-bold text-white glass-panel border border-[#2a243a] px-4 py-2 rounded-full transition-colors hover:bg-purple-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 -mt-44 relative z-20 space-y-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Poster Column */}
          <div className="w-48 sm:w-60 shrink-0 space-y-4 mx-auto md:mx-0">
            <div className="aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#161321] shadow-2xl border border-[#2a243a]">
              <img
                src={anime.coverImage.extraLarge || anime.coverImage.large}
                alt={title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {isUnreleased ? (
              <div className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#161321] border border-amber-400/30 text-amber-300 font-bold text-sm rounded-full">
                <Clock className="w-4 h-4" />
                Coming soon
              </div>
            ) : (
              <button
                onClick={() => onWatchAnime(anime.id, latestEp)}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white font-bold text-sm rounded-full shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                {airedCount > 1 ? `Watch EP ${latestEp}` : 'Watch Episode 1'}
              </button>
            )}

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-[#a1a1aa] font-display">My List</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'WATCHING', label: 'Watching' },
                    { id: 'PLANNING', label: 'Plan' },
                    { id: 'COMPLETED', label: 'Completed' },
                    { id: 'FAVORITE', label: 'Favorite' },
                  ] as { id: WatchStatus; label: string }[]
                ).map((item) => {
                  const active = watchlistItem?.status === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => updateWatchlist(anime, item.id, watchlistItem?.userScore ?? null, latestEp)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white border-transparent shadow'
                          : 'bg-[#161321] border-[#2a243a] text-[#a1a1aa] hover:text-white'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {watchlistItem && (
                <button
                  onClick={() => removeFromWatchlist(anime.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove from My List
                </button>
              )}
            </div>

            <button
              onClick={() => toggleFavorite(anime)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-full glass-panel border border-[#2a243a] text-xs font-semibold transition-all ${
                favorited ? 'text-rose-400 border-rose-500/30' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
              {favorited ? 'Favorited' : 'Add to Favorites'}
            </button>
          </div>

          {/* Details Column */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2.5 text-center md:text-left">
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                {title}
              </h1>
              {anime.title.native && (
                <p className="text-sm font-sans text-[#a1a1aa]">{anime.title.native}</p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs text-[#fafafa] font-semibold pt-2">
                {scoreFormatted && (
                  <>
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {scoreFormatted} / 10
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="text-purple-300 font-semibold">{anime.format || 'TV'}</span>
                <span aria-hidden="true">·</span>
                <span>{anime.startDate?.year || anime.seasonYear || 'TBA'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-purple-300">
                  {airedCount > 0
                    ? anime.episodes
                      ? `${airedCount} / ${anime.episodes} Episodes`
                      : `${airedCount} Aired`
                    : 'Not Yet Aired'}
                </span>
                {studioName && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-blue-400 font-mono">{studioName}</span>
                  </>
                )}
              </div>
            </div>

            {/* Airing Countdown Widget (Never Playable) */}
            {epInfo?.nextAiringEpisode && (
              <div className="p-4 bg-[#161321] rounded-xl border border-[#2a243a]">
                <span className="text-xs font-bold text-purple-300 block mb-2 font-display">
                  Next: EP {epInfo.nextAiringEpisode.episode} Airing Countdown
                </span>
                <CountdownCard
                  anime={anime}
                  episodeNumber={epInfo.nextAiringEpisode.episode}
                  airingAtTimestamp={epInfo.nextAiringEpisode.airingAt}
                  onSelect={onSelectAnime}
                  onWatch={onWatchAnime}
                />
              </div>
            )}

            {/* Synopsis */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-display">Synopsis</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed font-sans">
                {anime.description?.replace(/<[^>]*>?/gm, '') || 'No description available for this title.'}
              </p>
            </div>

            {/* Confirmed Aired Episodes Quick Selector */}
            {airedCount > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-display">
                  Aired Episodes ({airedCount})
                </h3>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {airedEpisodes.map((ep) => (
                    <button
                      key={ep.episode}
                      onClick={() => onWatchAnime(anime.id, ep.episode)}
                      className="px-3 py-1.5 rounded-lg bg-[#161321] border border-[#2a243a] hover:border-purple-500/50 hover:text-white text-xs font-mono text-[#a1a1aa] transition-colors tabular-nums"
                    >
                      EP {ep.episode}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Genre Chips */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-[#a1a1aa] uppercase tracking-wider font-display">Genres</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {anime.genres.map((g) => (
                    <span
                      key={g}
                      className="px-3 py-1 rounded-md bg-[#161321] border border-[#2a243a] text-xs font-semibold text-[#fafafa]"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Trailer */}
            {anime.trailer && anime.trailer.site === 'youtube' && (
              <div className="space-y-2 pt-4">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2 font-display">
                  <Film className="w-4 h-4 text-purple-400" />
                  Official Trailer
                </h3>
                <div className="aspect-video w-full max-w-2xl rounded-xl overflow-hidden bg-[#161321] border border-[#2a243a]">
                  <iframe
                    src={`https://www.youtube.com/embed/${anime.trailer.id}`}
                    title={`${title} Trailer`}
                    className="w-full h-full border-0"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Characters */}
        {anime.characters?.edges && anime.characters.edges.length > 0 && (
          <section className="space-y-4">
            <h3 className="font-display text-xl font-extrabold text-white">Characters & Voice Cast</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {anime.characters.edges.map((edge) => (
                <div key={edge.node.id} className="p-3 bg-[#161321] rounded-xl border border-[#2a243a] flex items-center gap-3">
                  <img
                    src={edge.node.image.large}
                    alt={edge.node.name.full}
                    className="w-12 h-14 object-cover rounded-lg shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate font-display">{edge.node.name.full}</h4>
                    <span className="text-[10px] text-purple-400 font-mono block">{edge.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {anime.recommendations?.nodes && anime.recommendations.nodes.length > 0 && (
          <AnimeCarousel
            title="More Like This"
            animeList={anime.recommendations.nodes.map((n) => n.mediaRecommendation).filter(Boolean)}
            onSelectAnime={onSelectAnime}
            onWatchAnime={onWatchAnime}
          />
        )}
      </div>
    </div>
  );
};
