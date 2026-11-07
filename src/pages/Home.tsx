import React, { useEffect, useState } from 'react';
import { Play, Sparkles, TrendingUp, Calendar, Film, Clock, ArrowRight } from 'lucide-react';
import { Anime, WatchHistoryItem } from '../types/anime';
import {
  getTrendingAnime,
  getPopularAnime,
  getSeasonalAnime,
  getUpcomingAnime,
  getAnimeMovies,
} from '../services/anilist';
import { HeroBanner } from '../components/anime/HeroBanner';
import { AnimeCarousel } from '../components/anime/AnimeCarousel';
import { CountdownSection } from '../components/countdown/CountdownSection';
import { useUser } from '../contexts/UserContext';

interface HomeProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
  onNavigate: (route: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onSelectAnime, onWatchAnime, onNavigate }) => {
  const { history } = useUser();
  const [trending, setTrending] = useState<Anime[]>([]);
  const [popular, setPopular] = useState<Anime[]>([]);
  const [seasonal, setSeasonal] = useState<Anime[]>([]);
  const [upcoming, setUpcoming] = useState<Anime[]>([]);
  const [movies, setMovies] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      try {
        const [trendRes, popRes, seasRes, upRes, movRes] = await Promise.all([
          getTrendingAnime(1, 10),
          getPopularAnime(1, 10),
          getSeasonalAnime(undefined, undefined, 1, 10),
          getUpcomingAnime(1, 10),
          getAnimeMovies(1, 10),
        ]);

        setTrending(trendRes.media);
        setPopular(popRes.media);
        setSeasonal(seasRes.media);
        setUpcoming(upRes.media);
        setMovies(movRes.media);
      } catch (err) {
        console.error('Error loading homepage data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAllData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-6 sm:p-12 space-y-8 animate-pulse">
        <div className="w-full h-[60vh] rounded-3xl bg-violet-950/20 border border-violet-500/10" />
        <div className="h-8 w-48 rounded bg-violet-950/30" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-violet-950/20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero Banner */}
      <HeroBanner
        animeList={trending.slice(0, 5)}
        onSelectAnime={onSelectAnime}
        onWatchAnime={onWatchAnime}
      />

      <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-12">
        {/* 2. Continue Watching (If User History Exists) */}
        {history.length > 0 && (
          <section className="space-y-4 p-6 glass-panel rounded-3xl border border-violet-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-violet-400 fill-current" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Continue Watching
                </h2>
              </div>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
              >
                Full History
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.slice(0, 3).map((item) => (
                <div
                  key={`${item.animeId}_${item.episode}`}
                  onClick={() => onWatchAnime(item.animeId, item.episode)}
                  className="group flex items-center gap-3 p-3 bg-violet-950/30 hover:bg-violet-900/40 rounded-2xl border border-violet-500/15 cursor-pointer transition-all"
                >
                  <img
                    src={item.coverImage}
                    alt={item.animeTitle}
                    className="w-16 h-20 object-cover rounded-xl shrink-0 shadow-md group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                      {item.animeTitle}
                    </h4>
                    <span className="inline-block text-xs font-mono font-semibold text-violet-400">
                      Episode {item.episode}
                    </span>
                    <div className="w-full h-1.5 bg-violet-950 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Trending This Week */}
        <AnimeCarousel
          title="Trending This Week"
          subtitle="The most talked-about anime across the globe right now"
          animeList={trending}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('trending')}
        />

        {/* 4. Popular Anime */}
        <AnimeCarousel
          title="All-Time Popular"
          subtitle="Most watched and favorited series in the community"
          animeList={popular}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('discover')}
        />

        {/* 5. Anime Countdown Section */}
        <CountdownSection
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
        />

        {/* 6. Seasonal Anime */}
        <AnimeCarousel
          title="Current Season Highlights"
          subtitle="Fresh weekly episodes airing this season"
          animeList={seasonal}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('seasonal')}
        />

        {/* 7. Featured Anime Movies */}
        <AnimeCarousel
          title="Feature Anime Movies"
          subtitle="Cinematic masterpieces and theatrical releases"
          animeList={movies}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('movies')}
        />

        {/* 8. Upcoming Releases */}
        <AnimeCarousel
          title="Anticipated Upcoming Releases"
          subtitle="Coming soon to the anime world"
          animeList={upcoming}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('upcoming')}
        />
      </div>
    </div>
  );
};
