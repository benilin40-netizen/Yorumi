import React, { useState, useEffect } from 'react';
import { Calendar, Play } from 'lucide-react';
import { Anime } from '../../types/anime';

interface CountdownCardProps {
  anime: Anime;
  episodeNumber?: number;
  airingAtTimestamp?: number;
  onSelect: (id: number) => void;
  onWatch: (id: number, ep?: number) => void;
}

export const CountdownCard: React.FC<CountdownCardProps> = ({
  anime,
  episodeNumber,
  airingAtTimestamp,
  onSelect,
  onWatch,
}) => {
  const targetTime = airingAtTimestamp || anime.nextAiringEpisode?.airingAt;
  const targetEp = episodeNumber || anime.nextAiringEpisode?.episode || 1;

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isReleased: boolean;
  } | null>(null);

  useEffect(() => {
    if (!targetTime) return;

    const calculateTime = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isReleased: true });
        return;
      }

      const days = Math.floor(diff / (3600 * 24));
      const hours = Math.floor((diff % (3600 * 24)) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setTimeLeft({ days, hours, minutes, seconds, isReleased: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  const title = anime.title.english || anime.title.romaji;
  const localFormattedTime = targetTime
    ? new Date(targetTime * 1000).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      onClick={() => onSelect(anime.id)}
      className="group flex flex-col sm:flex-row items-center gap-4 p-4 bg-[#161321] rounded-xl border border-[#2a243a] hover:border-purple-500/40 transition-all cursor-pointer shadow-lg"
    >
      {/* Poster */}
      <div className="relative aspect-[3/4] w-full sm:w-24 shrink-0 rounded-xl overflow-hidden bg-[#0d0b14]">
        <img
          src={anime.coverImage.large || anime.coverImage.medium}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-purple-600/90 backdrop-blur-md text-[10px] font-mono font-bold text-white">
          Ep {targetEp}
        </div>
      </div>

      {/* Info & Timer */}
      <div className="flex-1 min-w-0 space-y-2 w-full">
        <div>
          <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors font-display">
            {title}
          </h4>
          <div className="flex items-center gap-2 text-xs text-[#a1a1aa] mt-0.5 font-sans">
            <Calendar className="w-3 h-3 text-purple-400" />
            <span>{localFormattedTime || 'Release time unavailable'}</span>
          </div>
        </div>

        {/* Live Timer Unit Box */}
        {timeLeft ? (
          timeLeft.isReleased ? (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Airing Now!
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onWatch(anime.id, targetEp);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-full shadow"
              >
                <Play className="w-3 h-3 fill-current ml-0.5" />
                Watch
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <div className="p-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-center">
                <span className="block font-mono text-sm font-bold text-purple-300">{timeLeft.days}</span>
                <span className="text-[9px] uppercase font-mono text-[#a1a1aa]">Days</span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-center">
                <span className="block font-mono text-sm font-bold text-purple-300">{timeLeft.hours}</span>
                <span className="text-[9px] uppercase font-mono text-[#a1a1aa]">Hours</span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-center">
                <span className="block font-mono text-sm font-bold text-purple-300">{timeLeft.minutes}</span>
                <span className="text-[9px] uppercase font-mono text-[#a1a1aa]">Mins</span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#0d0b14] border border-[#2a243a] text-center">
                <span className="block font-mono text-sm font-bold text-blue-400">{timeLeft.seconds}</span>
                <span className="text-[9px] uppercase font-mono text-[#a1a1aa]">Secs</span>
              </div>
            </div>
          )
        ) : (
          <div className="text-xs text-[#a1a1aa] italic">Release time unavailable</div>
        )}
      </div>
    </div>
  );
};
