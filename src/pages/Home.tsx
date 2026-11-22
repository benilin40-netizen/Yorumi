import React, { useEffect, useState, useCallback } from 'react';
import { Play, ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { getHomeFeed, HomeFeedResponse } from '../services/anilist';
import { HeroBanner } from '../components/anime/HeroBanner';
import { AnimeCarousel } from '../components/anime/AnimeCarousel';
import { CountdownSection } from '../components/countdown/CountdownSection';
import { useUser } from '../contexts/UserContext';

interface HomeProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
  onNavigate: (route: string) => void;
}

function formatPositionMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const Home: React.FC<HomeProps> = ({ onSelectAnime, onWatchAnime, onNavigate }) => {
  const { continueWatching, history } = useUser();
  const [feed, setFeed] = useState<HomeFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getHomeFeed();
      setFeed(data);
    } catch (err: any) {
      console.error('Error loading homepage data:', err);
      setLoadError(err?.message || 'Unable to load catalog data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  if (loading) {
    return (
      <div className="min-h-screen p-6 sm:p-12 space-y-8 animate-pulse">
        <div className="w-full h-[65vh] rounded-3xl bg-[#161321] border border-[#2a243a]" />
        <div className="h-8 w-56 rounded bg-[#161321]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-[#161321] border border-[#2a243a]" />
          ))}
        </div>
      </div>
    );
  }

  const resumeList = continueWatching.length > 0 ? continueWatching : history;

  return (
    <div className="space-y-12 pb-16">
      {loadError && (
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-6">
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-4 text-xs text-rose-100">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              onClick={loadAllData}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 1. Hero Preview Bar (ONLY currently airing anime with >= 1 aired episode) */}
      <HeroBanner
        animeList={feed?.hero || []}
        onSelectAnime={onSelectAnime}
        onWatchAnime={onWatchAnime}
      />

      <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-14">
        {/* 2. Recently Updated Row Directly Below Hero (Airing only, EP N badge + relative time) */}
        <AnimeCarousel
          title="Recently Updated"
          subtitle="Latest episodes aired from currently airing series"
          animeList={feed?.recentlyUpdated || []}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('schedule')}
          showEpisodeBadge
          showRelativeTime
        />

        {/* Continue Watching (Powered by watch_progress or local guest progress) */}
        {resumeList.length > 0 && (
          <motion.section
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4 p-6 glass-panel rounded-2xl border border-purple-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-purple-400 fill-current" />
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Continue Watching
                </h2>
              </div>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
              >
                Full History
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumeList.slice(0, 3).map((item) => {
                const dur = Math.max(60, item.totalDurationSeconds || 1440);
                const pct = Math.min(100, Math.round(((item.progressSeconds || 0) / dur) * 100));
                return (
                  <div
                    key={`${item.animeId}_${item.episode}`}
                    onClick={() => onWatchAnime(item.animeId, item.episode)}
                    className="group flex items-center gap-3 p-3 bg-[#0d0b14]/70 hover:bg-purple-950/30 rounded-xl border border-[#2a243a] cursor-pointer transition-all"
                  >
                    <img
                      src={item.coverImage}
                      alt={item.animeTitle}
                      className="w-16 h-20 object-cover rounded-lg shrink-0 shadow-md group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                        {item.animeTitle}
                      </h4>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-purple-400">EP {item.episode}</span>
                        {item.progressSeconds > 0 && (
                          <span className="text-[11px] text-[#a1a1aa] tabular-nums">
                            {formatPositionMmSs(item.progressSeconds)}
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#161321] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* 3. Airing This Week (Timezone-aware tabs) */}
        <CountdownSection
          initialSchedules={feed?.schedule}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
        />

        {/* 4. Trending Airing */}
        <AnimeCarousel
          title="Trending Airing"
          subtitle="Most watched currently airing series right now"
          animeList={feed?.trendingAiring || []}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('trending')}
        />

        {/* 5. Upcoming (Countdown, NO Watch button) */}
        <AnimeCarousel
          title="Upcoming Releases"
          subtitle="Premieres on the horizon — countdowns only until episode 1 airs"
          animeList={feed?.upcoming || []}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('upcoming')}
          hideWatchButton
          showCountdown
        />

        {/* 6. Top Rated Airing */}
        <AnimeCarousel
          title="Top Rated Airing"
          subtitle="Highest-scored ongoing anime this season"
          animeList={feed?.topRatedAiring || []}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('discover')}
        />

        {/* 7. Anime Movies (Released movies only, strictly newest first, nulls last) */}
        <AnimeCarousel
          title="Anime Movies"
          subtitle="Released theatrical anime films ordered newest first"
          animeList={feed?.movies || []}
          onSelectAnime={onSelectAnime}
          onWatchAnime={onWatchAnime}
          onSeeAll={() => onNavigate('movies')}
        />
      </div>
    </div>
  );
};
