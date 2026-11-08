import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Maximize2,
  Minimize2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Tv,
  Radio,
  Moon,
  RotateCcw,
  Sliders,
  Activity,
  Check,
  RefreshCw,
  Info,
  X,
  FastForward,
  Sparkles,
} from 'lucide-react';
import Hls from 'hls.js';
import { Anime, AudioOption } from '../../types/anime';
import {
  PROVIDERS,
  ProviderId,
  getPreferredProvider,
  setPreferredProvider,
  getProviderConfig,
} from '../../services/streaming/providerManager';
import { useUser } from '../../contexts/UserContext';
import { getNextPlayableEpisode, EpisodeInfo } from '../../services/episodeService';

interface VideoPlayerProps {
  anime: Anime;
  currentEpisode: number;
  onEpisodeChange: (ep: number) => void;
  onClosePlayer?: () => void;
}

interface StreamDiagnosticLog {
  id: string;
  time: string;
  type: 'info' | 'warn' | 'error' | 'recovery';
  message: string;
}

const AUTOPLAY_STORAGE_KEY = 'yorumi_autoplay_next_v1';

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  anime,
  currentEpisode,
  onEpisodeChange,
}) => {
  const { addHistoryRecord } = useUser();
  const [activeProvider, setActiveProvider] = useState<ProviderId>(getPreferredProvider());
  const [audio, setAudio] = useState<AudioOption>('sub');
  const [mirrorIndex, setMirrorIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-Play Next & Preview Overlay State
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [showNextOverlay, setShowNextOverlay] = useState<boolean>(false);
  const [nextCountdown, setNextCountdown] = useState<number>(10);
  const [nextEpInfo, setNextEpInfo] = useState<EpisodeInfo | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronization & Diagnostics State
  const [audioDelayMs, setAudioDelayMs] = useState<number>(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<StreamDiagnosticLog[]>([]);
  const [bufferHealth, setBufferHealth] = useState<string>('Normal');
  const [recoveryCount, setRecoveryCount] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const title = anime.title.english || anime.title.romaji;
  const totalEpisodes = anime.episodes || 24;

  const config = getProviderConfig(activeProvider, {
    anilistId: anime.id,
    malId: anime.idMal,
    episode: currentEpisode,
    audio,
    mirrorIndex,
  });

  const addLog = (message: string, type: StreamDiagnosticLog['type'] = 'info') => {
    setDiagnosticLogs((prev) => [
      {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        time: new Date().toLocaleTimeString(),
        type,
        message,
      },
      ...prev.slice(0, 49),
    ]);
  };

  // Toggle Auto-Play Preference
  const handleToggleAutoPlay = (enabled: boolean) => {
    setAutoPlayNext(enabled);
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, JSON.stringify(enabled));
    if (!enabled && countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
  };

  // Check next episode availability & reset overlays when episode changes
  useEffect(() => {
    addHistoryRecord(anime, currentEpisode, 120);
    setHasError(false);
    setIsLoading(true);
    setShowNextOverlay(false);
    setNextCountdown(10);

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    const nextPlayable = getNextPlayableEpisode(anime, currentEpisode);
    setNextEpInfo(nextPlayable);

    addLog(`Initialized player for "${title}" Ep ${currentEpisode} [${activeProvider.toUpperCase()} - ${audio.toUpperCase()}]`);
  }, [anime.id, currentEpisode, activeProvider, audio, mirrorIndex]);

  // HLS.js initialization & thorough cleanup
  useEffect(() => {
    if (!config.isHls || !config.url) return;

    let currentHls: Hls | null = null;
    const videoElement = videoRef.current;

    if (videoElement) {
      if (Hls.isSupported()) {
        currentHls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
        });
        hlsRef.current = currentHls;

        currentHls.loadSource(config.url);
        currentHls.attachMedia(videoElement);

        currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          addLog('HLS manifest parsed successfully. Audio/Video tracks aligned.');
          setBufferHealth('Optimal (Buffered)');
        });

        currentHls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            addLog(`Fatal HLS error: ${data.details} (type: ${data.type})`, 'error');
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                addLog('Attempting network error recovery...', 'recovery');
                currentHls?.startLoad();
                setRecoveryCount((c) => c + 1);
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                addLog('Attempting media decoding recovery...', 'recovery');
                currentHls?.recoverMediaError();
                setRecoveryCount((c) => c + 1);
                break;
              default:
                setHasError(true);
                setIsLoading(false);
                currentHls?.destroy();
                break;
            }
          } else {
            addLog(`Non-fatal HLS warning: ${data.details}`, 'warn');
          }
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = config.url;
        setIsLoading(false);
        addLog('Using native Safari HLS player support.');
      }
    }

    return () => {
      if (currentHls) {
        currentHls.detachMedia();
        currentHls.destroy();
        hlsRef.current = null;
        addLog('HLS player instance destroyed and media detached.');
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.load();
      }
    };
  }, [config.url, config.isHls]);

  // Handle Video Time Update & Ended Event for Auto-Play Countdown
  const triggerAutoPlayCountdown = () => {
    if (showNextOverlay || !nextEpInfo) return;

    setShowNextOverlay(true);
    setNextCountdown(10);

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(() => {
      setNextCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!);
          countdownTimerRef.current = null;
          if (autoPlayNext && nextEpInfo) {
            onEpisodeChange(nextEpInfo.episodeNumber);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelAutoPlay = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setShowNextOverlay(false);
  };

  const handlePlayNow = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (nextEpInfo) {
      onEpisodeChange(nextEpInfo.episodeNumber);
    }
  };

  const handleProviderSelect = (providerId: ProviderId) => {
    setActiveProvider(providerId);
    setPreferredProvider(providerId);
    setMirrorIndex(0);
    setHasError(false);
    setIsLoading(true);
    addLog(`Switched streaming provider to ${providerId.toUpperCase()}`);
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

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-[#161321] border border-[#2a243a] shadow-2xl transition-all duration-300 ${
        theaterMode ? 'ring-4 ring-purple-600/50 shadow-purple-900/50' : ''
      }`}
    >
      {/* Player Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#0d0b14] border-b border-[#2a243a]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
          <h2 className="text-sm sm:text-base font-bold text-white truncate font-display">
            {title} <span className="text-purple-400 font-mono font-medium ml-1">· Ep {currentEpisode}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-Play Next Toggle Pill */}
          <button
            onClick={() => handleToggleAutoPlay(!autoPlayNext)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              autoPlayNext
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700'
            }`}
            title="Toggle Auto-Play Next Episode"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Auto-Play: {autoPlayNext ? 'ON' : 'OFF'}</span>
          </button>

          {/* Audio Selector (SUB / DUB) */}
          <div className="flex items-center p-0.5 bg-[#161321] rounded-full border border-[#2a243a] text-xs">
            <button
              onClick={() => setAudio('sub')}
              className={`px-3 py-1 rounded-full font-bold transition-all ${
                audio === 'sub' ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              SUB
            </button>
            <button
              onClick={() => setAudio('dub')}
              className={`px-3 py-1 rounded-full font-bold transition-all ${
                audio === 'dub' ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              DUB
            </button>
          </div>

          {/* Diagnostics Toggle */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`p-2 rounded-full text-xs transition-colors ${
              showDiagnostics ? 'bg-purple-600 text-white' : 'glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white'
            }`}
            title="Toggle Sync Diagnostics"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Theater Mode Toggle */}
          <button
            onClick={() => setTheaterMode(!theaterMode)}
            className={`p-2 rounded-full text-xs transition-colors ${
              theaterMode ? 'bg-purple-600 text-white' : 'glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white'
            }`}
            title="Toggle Theater Mode"
          >
            <Moon className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-full glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Video Viewport & Overlay Panels */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-20 bg-black/75 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#a1a1aa] font-semibold">Loading {PROVIDERS.find((p) => p.id === activeProvider)?.name} stream...</p>
          </div>
        )}

        {hasError ? (
          <div className="absolute inset-0 z-30 bg-[#0d0b14]/95 p-6 flex flex-col items-center justify-center text-center gap-4">
            <AlertTriangle className="w-12 h-12 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white font-display">Streaming Route Unavailable</h3>
              <p className="text-xs text-[#a1a1aa] mt-1 max-w-md font-sans">
                The current stream route encountered an issue or rate limit. Switch to an alternate Jutsu server mirror below:
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setMirrorIndex((prev) => (prev + 1) % 3);
                  setHasError(false);
                  setIsLoading(true);
                  addLog('Switched to alternate mirror server index.');
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-full shadow-lg transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Switch to Next Server Mirror
              </button>
            </div>
          </div>
        ) : config.isHls ? (
          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
            onPlay={() => setIsLoading(false)}
            onEnded={triggerAutoPlayCountdown}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              if (el.duration && el.duration - el.currentTime <= 10 && !showNextOverlay && nextEpInfo) {
                triggerAutoPlayCountdown();
              }
            }}
            onWaiting={() => {
              setBufferHealth('Stalled / Buffering');
              addLog('Playback buffering stalled', 'warn');
            }}
            onPlaying={() => {
              setBufferHealth('Optimal (Playing)');
              setIsLoading(false);
            }}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
              addLog('HTML5 video element emitted decode/network error', 'error');
            }}
          />
        ) : (
          <iframe
            src={config.url}
            title={`${title} - Episode ${currentEpisode}`}
            className="w-full h-full border-0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
              addLog('Embed iframe failed to load stream URL', 'error');
            }}
          />
        )}

        {/* Next Episode Auto-Play Preview Overlay */}
        {showNextOverlay && nextEpInfo && (
          <div className="absolute bottom-6 right-6 z-40 bg-[#0d0b14]/95 border border-purple-500/50 p-4 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm w-full animate-in slide-in-from-bottom font-sans">
            <div className="flex items-center justify-between border-b border-[#2a243a] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <FastForward className="w-4 h-4 text-purple-400" />
                <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                  Up Next · Ep {nextEpInfo.episodeNumber}
                </span>
              </div>
              <button
                onClick={handleCancelAutoPlay}
                className="text-[#a1a1aa] hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-start gap-3">
              <img
                src={nextEpInfo.thumbnail || anime.coverImage.large}
                alt={nextEpInfo.title}
                className="w-16 h-20 rounded-xl object-cover border border-[#2a243a] shrink-0"
              />
              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white line-clamp-2">{nextEpInfo.title}</h4>
                <p className="text-[11px] text-purple-300 font-mono">
                  Starting in <strong className="text-white font-bold">{nextCountdown}s</strong>
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handlePlayNow}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white font-bold text-xs rounded-full shadow flex items-center gap-1 transition-all"
                  >
                    <Play className="w-3 h-3 fill-current" /> Play Now
                  </button>
                  <button
                    onClick={handleCancelAutoPlay}
                    className="px-3 py-1.5 bg-[#161321] hover:bg-[#201c2e] border border-[#2a243a] text-[#a1a1aa] hover:text-white text-xs font-semibold rounded-full transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Diagnostics Modal / Overlay Panel */}
        {showDiagnostics && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-96 bg-[#0d0b14]/95 backdrop-blur-md border-l border-[#2a243a] p-5 z-40 flex flex-col shadow-2xl animate-in slide-in-from-right font-sans">
            <div className="flex items-center justify-between border-b border-[#2a243a] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <h3 className="font-display font-bold text-white text-xs uppercase tracking-wider">
                  Sync & Stream Diagnostics
                </h3>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="text-[#a1a1aa] hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-[11px] font-mono text-[#a1a1aa] flex-1 overflow-y-auto pr-1">
              <div className="p-2.5 bg-[#161321] rounded-xl border border-[#2a243a] space-y-1">
                <div className="flex justify-between">
                  <span>Provider:</span>
                  <span className="text-white font-bold">{activeProvider.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Audio Mode:</span>
                  <span className="text-purple-300 font-bold">{audio.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Buffer Health:</span>
                  <span className="text-emerald-400">{bufferHealth}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recovery Count:</span>
                  <span className="text-amber-300">{recoveryCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Play Next:</span>
                  <span className={autoPlayNext ? 'text-purple-400 font-bold' : 'text-zinc-500'}>
                    {autoPlayNext ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
              </div>

              {/* Audio Delay Control */}
              <div className="p-3 bg-[#161321] rounded-xl border border-[#2a243a] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-display text-xs">Audio Lip-Sync Offset</span>
                  <span className="text-purple-400 text-xs font-bold">{audioDelayMs} ms</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="range"
                    min={-500}
                    max={500}
                    step={50}
                    value={audioDelayMs}
                    onChange={(e) => setAudioDelayMs(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <button
                    onClick={() => setAudioDelayMs(0)}
                    className="px-2.5 py-1 bg-[#0d0b14] border border-[#2a243a] hover:border-purple-500 text-white text-[10px] font-bold rounded-lg shrink-0"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Event Log Stream */}
              <div className="space-y-1 pt-1">
                <span className="font-display font-bold text-white text-xs block mb-1">Live Sync Event Log</span>
                {diagnosticLogs.map((log) => (
                  <div key={log.id} className="p-2 bg-[#161321] rounded border border-[#2a243a]/50 flex items-start gap-2">
                    <span className="text-zinc-500 shrink-0">{log.time}</span>
                    <span
                      className={`truncate ${
                        log.type === 'error'
                          ? 'text-rose-400'
                          : log.type === 'warn'
                          ? 'text-amber-400'
                          : log.type === 'recovery'
                          ? 'text-blue-400'
                          : 'text-zinc-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Selector & Episode Controls Bar */}
      <div className="p-4 sm:p-6 bg-[#161321] space-y-4">
        {/* Provider Switcher Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#2a243a]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-[#fafafa]">Streaming Engine:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PROVIDERS.map((provider) => {
              const isActive = activeProvider === provider.id;
              return (
                <button
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                      : 'glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-white hover:bg-[#201c2e]'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>{provider.name}</span>
                </button>
              );
            })}
          </div>

          {/* Mirror Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#a1a1aa]">Server:</span>
            <select
              value={mirrorIndex}
              onChange={(e) => {
                setMirrorIndex(parseInt(e.target.value, 10));
                setHasError(false);
                setIsLoading(true);
                addLog(`Switched server mirror to index ${e.target.value}`);
              }}
              className="bg-[#0d0b14] text-[#fafafa] text-xs rounded-full px-3 py-1 border border-[#2a243a] outline-none"
            >
              {PROVIDERS.find((p) => p.id === activeProvider)?.mirrors.map((m, idx) => (
                <option key={idx} value={idx} className="bg-[#161321]">
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Episode Navigation Row */}
        <div className="flex items-center justify-between gap-4">
          <button
            disabled={currentEpisode <= 1}
            onClick={() => onEpisodeChange(currentEpisode - 1)}
            className="flex items-center gap-2 px-4 py-2 glass-panel border border-[#2a243a] disabled:opacity-40 text-[#fafafa] hover:text-white text-xs font-bold rounded-full transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Ep
          </button>

          <span className="text-xs font-mono font-bold text-purple-300">
            Episode {currentEpisode} of {totalEpisodes}
          </span>

          <button
            disabled={!nextEpInfo}
            onClick={() => {
              if (nextEpInfo) onEpisodeChange(nextEpInfo.episodeNumber);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 disabled:opacity-40 text-white text-xs font-bold rounded-full shadow transition-all"
          >
            Next Ep
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
