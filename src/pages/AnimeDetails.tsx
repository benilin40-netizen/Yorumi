import React, { useEffect, useState } from 'react';
import {
  Play,
  Star,
  Bookmark,
  Heart,
  Film,
  ArrowLeft,
  Lock,
  Calendar,
  Clock,
  CheckCircle2,
  BellRing,
  BellOff,
} from 'lucide-react';
import { Anime, WatchStatus } from '../types/anime';
import { getAnimeById } from '../services/anilist';
import { useUser } from '../contexts/UserContext';
import { AnimeCarousel } from '../components/anime/AnimeCarousel';
import { CountdownCard } from '../components/countdown/CountdownCard';
import {
  calculateAnimeEpisodeSchedule,
  isEpisodePlayable,
  syncEpisodeReleasesAndNotify,
  AnimeEpisodeSchedule,
} from '../services/episodeService';
import { isFavoriteAlertEnabled, toggleFavoriteAlert } from '../services/notificationService';

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
  const [loading, setLoading] = useState(true);
  const { updateWatchlist, getWatchlistItem, toggleFavorite, isFavorite } = useUser();

  const [alertsActive, setAlertsActive] = useState<boolean>(() => isFavoriteAlertEnabled(animeId));

  useEffect(() => {
    setAlertsActive(isFavoriteAlertEnabled(animeId));
    async function load() {
      setLoading(true);
      const data = await getAnimeById(animeId);
      setAnime(data);
      if (data) {
        syncEpisodeReleasesAndNotify(data);
      }
      setLoading(false);
    }
    load();
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
  const currentStatus = watchlistItem?.status || 'PLANNING';
  const favorited = isFavorite(anime.id);
  const studioName = anime.studios?.nodes?.[0]?.name;
  const scoreFormatted = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : '8.4';

  const schedule: AnimeEpisodeSchedule = calculateAnimeEpisodeSchedule(anime);
  const ep1Check = isEpisodePlayable(anime, 1);
  const latestEpToWatch = schedule.latestReleasedEpisode > 0 ? schedule.latestReleasedEpisode : 1;

  return (
    <div className="space-y-12 pb-16">
      {/* Banner Artwork Header with Dark Overlay */}
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

      {/* Main Content Container with Offset Overlapping Poster */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 -mt-44 relative z-20 space-y-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Poster Offset Overlapping Banner */}
          <div className="w-48 sm:w-60 shrink-0 space-y-4 mx-auto md:mx-0">
            <div className="aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#161321] shadow-2xl border border-[#2a243a]">
              <img
                src={anime.coverImage.extraLarge || anime.coverImage.large}
                alt={title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Primary CTA Button: Watch Latest / Watch Episode 1 or Upcoming */}
            {schedule.latestReleasedEpisode > 0 ? (
              <button
                onClick={() => onWatchAnime(anime.id, latestEpToWatch)}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white font-bold text-sm rounded-full shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                Watch Episode {latestEpToWatch}
              </button>
            ) : (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#161321] border border-[#2a243a] text-amber-400 font-bold text-xs rounded-full cursor-not-allowed opacity-80"
              >
                <Lock className="w-4 h-4" />
                Upcoming — Not Released
              </button>
            )}

            {/* Watch Status Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-[#a1a1aa] font-display">Watchlist Status</label>
              <select
                value={watchlistItem ? currentStatus : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    updateWatchlist(anime, e.target.value as WatchStatus);
                  }
                }}
                className="w-full bg-[#161321] border border-[#2a243a] rounded-full px-4 py-2 text-xs text-[#fafafa] outline-none font-sans"
              >
                <option value="" className="bg-[#161321]">+ Add to Watchlist</option>
                <option value="WATCHING" className="bg-[#161321]">Watching</option>
                <option value="PLANNING" className="bg-[#161321]">Plan to Watch</option>
                <option value="COMPLETED" className="bg-[#161321]">Completed</option>
                <option value="DROPPED" className="bg-[#161321]">Dropped</option>
              </select>
            </div>

            {/* Favorite Action Button */}
            <button
              onClick={() => {
                const isNowFav = toggleFavorite(anime);
                if (isNowFav) {
                  setAlertsActive(isFavoriteAlertEnabled(anime.id));
                }
              }}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-full glass-panel border border-[#2a243a] text-xs font-semibold transition-all ${
                favorited ? 'text-rose-400 border-rose-500/30' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
              {favorited ? 'In Favorites' : 'Add to Favorites'}
            </button>

            {/* Favorite Release Alerts Opt-in Toggle */}
            {favorited && (
              <button
                onClick={() => {
                  toggleFavoriteAlert(anime.id);
                  setAlertsActive(!alertsActive);
                }}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold transition-all ${
                  alertsActive
                    ? 'bg-purple-950/40 text-purple-300 border border-purple-500/40 hover:bg-purple-900/50'
                    : 'bg-[#161321] text-zinc-400 border border-[#2a243a] hover:text-white'
                }`}
                title={alertsActive ? 'Mute release alerts for this show' : 'Enable release alerts for this show'}
              >
                {alertsActive ? (
                  <>
                    <BellRing className="w-3.5 h-3.5 text-purple-400" />
                    <span>Release Alerts: ON</span>
                  </>
                ) : (
                  <>
                    <BellOff className="w-3.5 h-3.5" />
                    <span>Release Alerts: Muted</span>
                  </>
                )}
              </button>
            )}
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

              {/* Unboxed Metadata Line */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs text-[#fafafa] font-semibold pt-2">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {scoreFormatted} / 10
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-purple-300 font-semibold">{anime.format || 'TV'}</span>
                <span aria-hidden="true">·</span>
                <span>{anime.seasonYear || anime.season || 'N/A'}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {schedule.latestReleasedEpisode} / {schedule.totalEpisodes || '?'} Released
                </span>
                {studioName && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-blue-400 font-mono">{studioName}</span>
                  </>
                )}
              </div>
            </div>

            {/* Airing Countdown Widget if available */}
            {anime.nextAiringEpisode && (
              <div className="p-4 bg-[#161321] rounded-xl border border-[#2a243a]">
                <span className="text-xs font-bold text-purple-300 block mb-2 font-display">Next Episode Airing</span>
                <CountdownCard
                  anime={anime}
                  episodeNumber={anime.nextAiringEpisode.episode}
                  airingAtTimestamp={anime.nextAiringEpisode.airingAt}
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

            {/* Genre Pills */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-[#a1a1aa] uppercase tracking-wider font-display">Genres</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {anime.genres.map((g) => (
                    <span
                      key={g}
                      className="px-3.5 py-1 rounded-full bg-[#161321] border border-[#2a243a] text-xs font-semibold text-[#fafafa]"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Progressive Episode Releases Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-[#2a243a] pb-2">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-display">
                  Episode Release List ({schedule.latestReleasedEpisode} Available)
                </h3>
                <span className="text-[11px] text-purple-300 font-mono">
                  {anime.status === 'RELEASING' ? 'Progressive Release Mode Active' : 'All Episodes Released'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {schedule.episodes.slice(0, 24).map((ep) => {
                  const isReleased = ep.status === 'released' && ep.hasStreamSource;
                  return (
                    <button
                      key={ep.episodeNumber}
                      disabled={!isReleased}
                      onClick={() => onWatchAnime(anime.id, ep.episodeNumber)}
                      className={`p-2.5 rounded-xl text-xs font-mono font-bold border transition-all text-left flex items-center justify-between ${
                        isReleased
                          ? 'bg-[#161321] hover:bg-purple-900/30 text-white border-purple-500/40 hover:border-purple-500 shadow cursor-pointer'
                          : 'bg-[#0d0b14]/60 text-zinc-500 border-[#2a243a]/30 cursor-not-allowed'
                      }`}
                    >
                      <span>Ep {ep.episodeNumber}</span>
                      {isReleased ? (
                        <Play className="w-3 h-3 text-purple-400 fill-purple-400" />
                      ) : (
                        <Lock className="w-3 h-3 text-zinc-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* YouTube Trailer Embed */}
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

        {/* Characters & Voice Cast */}
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
