import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Tv,
  Radio,
  Moon,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Pause,
  Play,
} from 'lucide-react';
import {
  Anime,
  AudioOption,
  ProviderId,
  ProviderMode,
  ResolvedSource,
} from '../../types/anime';
import {
  resolveEpisodeSources,
  reportProviderFailure,
} from '../../services/streaming/providerManager';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';

interface VideoPlayerProps {
  anime: Anime;
  currentEpisode: number;
  airedEpisodeCount: number;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  onEpisodeChange: (ep: number) => void;
}

const IFRAME_LOAD_TIMEOUT_MS = 8000;
const PROGRESS_SAVE_INTERVAL_MS = 15000;

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  anime,
  currentEpisode,
  airedEpisodeCount,
  nextAiringEpisode,
  onEpisodeChange,
}) => {
  const {
    saveWatchProgress,
    getResumePosition,
    preferredProvider,
    providerMode,
    preferredLang,
    setProviderPreference,
    setPreferredLang,
  } = useUser();
  const { trackEvent } = useAuth();

  const [mode, setMode] = useState<ProviderMode>(providerMode);
  const [manualProvider, setManualProvider] = useState<ProviderId>(preferredProvider);
  const [audio, setAudio] = useState<AudioOption>(preferredLang);
  const [isPausedTracker, setIsPausedTracker] = useState(false);

  const [kurokoEnabled, setKurokoEnabled] = useState<boolean>(true);
  const [activeSource, setActiveSource] = useState<ResolvedSource | null>(null);
  const [fallbackQueue, setFallbackQueue] = useState<ResolvedSource[]>([]);
  const [allEnabledSources, setAllEnabledSources] = useState<ResolvedSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resumedFromSec, setResumedFromSec] = useState<number>(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const elapsedRef = useRef<number>(0);
  const lastEpisodeKeyRef = useRef<string>('');
  const durationSeconds = Math.max(60, (anime.duration || 24) * 60);

  const title = anime.title.english || anime.title.romaji;

  // Keep audio synced with profile preferredLang if updated on login
  useEffect(() => {
    setAudio(preferredLang);
  }, [preferredLang]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 5500);
  }, []);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flushProgress = useCallback(
    (forceSec?: number) => {
      const pos = forceSec ?? elapsedRef.current;
      saveWatchProgress({
        anime,
        episode: currentEpisode,
        positionSeconds: pos,
        durationSeconds,
      }).catch(() => {});
    },
    [anime, currentEpisode, durationSeconds, saveWatchProgress]
  );

  const triggerFailover = useCallback(
    (failedSource: ResolvedSource | null, reason: string) => {
      clearLoadTimeout();
      if (failedSource) {
        reportProviderFailure(failedSource.id, reason);
      }

      if (fallbackQueue.length > 0) {
        const [nextSource, ...rest] = fallbackQueue;
        const failedLabel = failedSource?.name || 'Provider';
        showToast(`${failedLabel} failed, switching to ${nextSource.name}`);
        trackEvent('provider_switch', {
          anilist_id: anime.id,
          episode_number: currentEpisode,
          provider_id: nextSource.id,
          metadata: { from: failedSource?.id || null, reason },
        });
        setActiveSource(nextSource);
        setFallbackQueue(rest);
        setHasError(false);
        setIsLoading(true);
        setIframeKey((k) => k + 1);
      } else {
        setHasError(true);
        setIsLoading(false);
      }
    },
    [anime.id, clearLoadTimeout, currentEpisode, fallbackQueue, showToast, trackEvent]
  );

  // Resolve sources via backend /api/sources/:anilistId/:episode
  const fetchAndLoadSources = useCallback(
    async (
      targetMode: ProviderMode,
      targetProvider: ProviderId,
      targetAudio: AudioOption,
      startSeconds: number
    ) => {
      clearLoadTimeout();
      setIsLoading(true);
      setHasError(false);

      try {
        const res = await resolveEpisodeSources({
          anilistId: anime.id,
          episode: currentEpisode,
          lang: targetAudio,
          autoplay: 1,
          startSeconds,
          mode: targetMode === 'auto' ? 'auto' : targetProvider,
        });

        setKurokoEnabled(res.kurokoEnabled);
        setAllEnabledSources(res.allEnabled);

        if (!res.selected) {
          setActiveSource(null);
          setFallbackQueue([]);
          setHasError(true);
          setIsLoading(false);
          return;
        }

        if (
          targetMode === 'auto' &&
          res.failedChecks.length > 0 &&
          res.selected.id !== res.failedChecks[0].id
        ) {
          showToast(`${res.failedChecks[0].name} failed, switching to ${res.selected.name}`);
        }

        setActiveSource(res.selected);
        setFallbackQueue(res.fallbacks);
        setIframeKey((k) => k + 1);
        setProviderPreference(targetMode, res.selected.id);
        trackEvent('episode_watch', {
          anilist_id: anime.id,
          episode_number: currentEpisode,
          provider_id: res.selected.id,
          metadata: { lang: targetAudio, mode: targetMode, startSeconds },
        });
      } catch (err) {
        console.error('Failed to resolve episode sources:', err);
        setHasError(true);
        setIsLoading(false);
      }
    },
    [anime.id, currentEpisode, clearLoadTimeout, setProviderPreference, showToast, trackEvent]
  );

  useEffect(() => {
    const epKey = `${anime.id}:${currentEpisode}`;
    let startAt = elapsedRef.current;

    if (lastEpisodeKeyRef.current !== epKey) {
      lastEpisodeKeyRef.current = epKey;
      const savedPos = getResumePosition(anime.id, currentEpisode);
      startAt = savedPos;
      elapsedRef.current = savedPos;
      setResumedFromSec(savedPos > 5 ? savedPos : 0);
      setIsPausedTracker(false);
      // Record initial episode watch immediately so it enters history / Continue watching
      saveWatchProgress({
        anime,
        episode: currentEpisode,
        positionSeconds: savedPos,
        durationSeconds,
      }).catch(() => {});
    }

    fetchAndLoadSources(mode, manualProvider, audio, startAt);

    return () => {
      clearLoadTimeout();
    };
  }, [anime.id, currentEpisode, mode, manualProvider, audio]);

  // Playback progress tracker: increment elapsed seconds, auto-save every 15s, save on pause/visibilitychange/exit
  useEffect(() => {
    if (hasError || !activeSource) return;

    const secTimer = window.setInterval(() => {
      if (!isLoading && !isPausedTracker && document.visibilityState === 'visible') {
        elapsedRef.current = Math.min(durationSeconds, elapsedRef.current + 1);
      }
    }, 1000);

    const saveTimer = window.setInterval(() => {
      if (!isLoading && !isPausedTracker) {
        flushProgress();
      }
    }, PROGRESS_SAVE_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushProgress();
      }
    };

    const handleExit = () => {
      flushProgress();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);

    return () => {
      window.clearInterval(secTimer);
      window.clearInterval(saveTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleExit);
      window.removeEventListener('beforeunload', handleExit);
      flushProgress();
    };
  }, [hasError, activeSource, isLoading, isPausedTracker, durationSeconds, flushProgress]);

  // 8-second iframe load timeout for cross-origin embed failover
  useEffect(() => {
    if (!activeSource || !isLoading || hasError) return;

    clearLoadTimeout();
    timeoutRef.current = window.setTimeout(() => {
      triggerFailover(activeSource, 'Iframe load timeout (8s)');
    }, IFRAME_LOAD_TIMEOUT_MS);

    return () => clearLoadTimeout();
  }, [activeSource, iframeKey, isLoading, hasError, clearLoadTimeout, triggerFailover]);

  const handleSelectAuto = () => {
    setMode('auto');
    setProviderPreference('auto', activeSource?.id || manualProvider);
  };

  const handleSelectManualProvider = (id: ProviderId) => {
    setMode('manual');
    setManualProvider(id);
    setProviderPreference('manual', id);
    trackEvent('provider_switch', {
      anilist_id: anime.id,
      episode_number: currentEpisode,
      provider_id: id,
      metadata: { manual: true },
    });
  };

  const handleSelectAudio = (nextLang: AudioOption) => {
    setAudio(nextLang);
    setPreferredLang(nextLang);
  };

  const handleTogglePauseTracker = () => {
    const nextPaused = !isPausedTracker;
    setIsPausedTracker(nextPaused);
    if (nextPaused) {
      flushProgress();
      showToast(`Progress saved at ${formatMmSs(elapsedRef.current)}`);
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  const providerButtons: { id: ProviderId; label: string }[] = [
    { id: 'yenime', label: 'Yenime' },
    { id: 'aniembed', label: 'AniEmbed' },
    ...(kurokoEnabled ? [{ id: 'kuroko' as ProviderId, label: 'Kuroko' }] : []),
  ];

  const formatCountdown = (airingAt: number) => {
    const diff = airingAt - Math.floor(Date.now() / 1000);
    if (diff <= 0) return 'airing soon';
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-[#161321] border border-[#2a243a] shadow-2xl transition-all duration-300 ${
        theaterMode ? 'ring-4 ring-purple-600/50 shadow-purple-900/50' : ''
      }`}
    >
      {/* Failover / Progress Toast Banner */}
      {toastMessage && (
        <div
          role="status"
          className="absolute top-16 right-4 z-40 px-4 py-2.5 rounded-xl bg-[#0d0b14]/95 border border-amber-400/40 text-amber-200 text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Player Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#0d0b14] border-b border-[#2a243a]">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-white truncate font-display">
            {title}{' '}
            <span className="text-purple-400 font-mono font-medium ml-1 tabular-nums">
              · EP {currentEpisode}
            </span>
          </h2>
          {activeSource && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {mode === 'auto' ? `Auto (${activeSource.name})` : activeSource.name}
            </span>
          )}
          {resumedFromSec > 5 && (
            <span className="hidden lg:inline-block px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[10px] font-mono text-purple-300 tabular-nums">
              Resumed {formatMmSs(resumedFromSec)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sub / Dub Toggle */}
          <div className="flex items-center p-0.5 bg-[#161321] rounded-lg border border-[#2a243a] text-xs">
            <button
              onClick={() => handleSelectAudio('sub')}
              className={`px-3 py-1 rounded-md font-bold transition-all whitespace-nowrap ${
                audio === 'sub'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              SUB
            </button>
            <button
              onClick={() => handleSelectAudio('dub')}
              className={`px-3 py-1 rounded-md font-bold transition-all whitespace-nowrap ${
                audio === 'dub'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              DUB
            </button>
          </div>

          <button
            onClick={handleTogglePauseTracker}
            className={`p-2 rounded-lg text-xs transition-colors ${
              isPausedTracker
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                : 'bg-[#161321] border border-[#2a243a] text-[#a1a1aa] hover:text-white'
            }`}
            title={isPausedTracker ? 'Resume Progress Sync' : 'Pause & Save Progress'}
          >
            {isPausedTracker ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setTheaterMode(!theaterMode)}
            className={`p-2 rounded-lg text-xs transition-colors ${
              theaterMode
                ? 'bg-purple-600 text-white'
                : 'bg-[#161321] border border-[#2a243a] text-[#a1a1aa] hover:text-white'
            }`}
            title="Toggle Theater Mode"
          >
            <Moon className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-lg bg-[#161321] border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#a1a1aa] font-semibold">
              Connecting to {activeSource?.name || 'stream provider'}...
            </p>
          </div>
        )}

        {hasError || !activeSource ? (
          <div className="absolute inset-0 z-30 bg-[#0d0b14]/95 p-6 flex flex-col items-center justify-center text-center gap-4">
            <AlertTriangle className="w-12 h-12 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white font-display">
                All Enabled Providers Unavailable
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-1 max-w-md font-sans">
                The selected stream failed to respond. Retry or manually switch providers below.
              </p>
            </div>
            <button
              onClick={() => fetchAndLoadSources('auto', manualProvider, audio, elapsedRef.current)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-lg shadow-lg transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Auto-Select
            </button>
          </div>
        ) : (
          <iframe
            key={`${activeSource.id}-${iframeKey}`}
            src={activeSource.url}
            title={`${title} - Episode ${currentEpisode} (${activeSource.name})`}
            className="w-full h-full border-0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="no-referrer"
            onLoad={() => {
              clearLoadTimeout();
              setIsLoading(false);
              setProviderPreference(mode, activeSource.id);
            }}
            onError={() => {
              triggerFailover(activeSource, 'Iframe error event');
            }}
          />
        )}
      </div>

      {/* Visible Provider Switcher & Episode Controls Bar */}
      <div className="p-4 sm:p-6 bg-[#161321] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#2a243a]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-[#fafafa]">Provider:</span>
          </div>

          {/* [Auto] [Yenime] [AniEmbed] [Kuroko] */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSelectAuto}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                mode === 'auto'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                  : 'bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa] hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto</span>
            </button>

            {providerButtons.map((pb) => {
              const isSelectedManual = mode === 'manual' && manualProvider === pb.id;
              const isActiveInAuto = mode === 'auto' && activeSource?.id === pb.id;
              const serverEnabled =
                allEnabledSources.length === 0 || allEnabledSources.some((s) => s.id === pb.id);

              return (
                <button
                  key={pb.id}
                  disabled={!serverEnabled}
                  onClick={() => handleSelectManualProvider(pb.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap disabled:opacity-40 ${
                    isSelectedManual
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                      : isActiveInAuto
                      ? 'bg-purple-500/20 border border-purple-500/50 text-purple-200'
                      : 'bg-[#0d0b14] border border-[#2a243a] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>{pb.label}</span>
                </button>
              );
            })}
          </div>

          {fallbackQueue.length > 0 && activeSource && (
            <button
              onClick={() => triggerFailover(activeSource, 'Manual failover requested by viewer')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-[11px] font-semibold text-[#a1a1aa] hover:text-white transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              Switch to Next ({fallbackQueue[0].name})
            </button>
          )}
        </div>

        {/* Episode Navigation Row (Strictly Confirmed Aired Episodes Only) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            disabled={currentEpisode <= 1}
            onClick={() => onEpisodeChange(currentEpisode - 1)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0d0b14] border border-[#2a243a] disabled:opacity-40 text-[#fafafa] hover:text-white text-xs font-bold rounded-lg transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Ep
          </button>

          <div className="text-center">
            <span className="text-xs font-mono font-bold text-purple-300 tabular-nums">
              Episode {currentEpisode}
              {anime.episodes ? ` of ${anime.episodes}` : ` (${airedEpisodeCount} aired)`}
            </span>
            {nextAiringEpisode && (
              <span className="block text-[11px] font-mono text-[#a1a1aa] mt-0.5 tabular-nums">
                Next: EP {nextAiringEpisode.episode} in {formatCountdown(nextAiringEpisode.airingAt)}
              </span>
            )}
          </div>

          <button
            disabled={currentEpisode >= airedEpisodeCount}
            onClick={() => onEpisodeChange(currentEpisode + 1)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow transition-all"
          >
            Next Ep
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
