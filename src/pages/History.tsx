import React from 'react';
import { History as HistoryIcon, Play, Trash2 } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface HistoryProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

export const History: React.FC<HistoryProps> = ({ onSelectAnime, onWatchAnime }) => {
  const { history, clearHistory } = useUser();

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HistoryIcon className="w-8 h-8 text-purple-400" />
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Watch <span className="brand-gradient-text">History</span>
            </h1>
            <p className="text-sm text-[#a1a1aa] font-sans">Review your recently watched episodes and resume playback</p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 px-4 py-2 glass-panel border border-[#2a243a] text-[#a1a1aa] hover:text-rose-400 text-xs font-semibold rounded-full transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="p-16 text-center bg-[#161321] rounded-2xl border border-[#2a243a] space-y-3">
          <HistoryIcon className="w-12 h-12 text-purple-500/30 mx-auto" />
          <h3 className="text-base font-bold text-white font-display">No Watch History Yet</h3>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto font-sans">
            When you watch episodes on YORUMI, your progress will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((item) => {
            const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={`${item.animeId}_${item.episode}_${item.timestamp}`}
                onClick={() => onSelectAnime(item.animeId)}
                className="group p-4 bg-[#161321] rounded-xl border border-[#2a243a] hover:border-purple-500/40 transition-all cursor-pointer flex gap-4 shadow-lg"
              >
                <img
                  src={item.coverImage}
                  alt={item.animeTitle}
                  className="w-20 aspect-[3/4] object-cover rounded-xl shrink-0 group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                />

                <div className="flex-1 min-w-0 space-y-2">
                  <h4 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors font-display">
                    {item.animeTitle}
                  </h4>

                  <div className="flex items-center gap-2 text-xs text-[#a1a1aa] font-sans">
                    <span className="font-mono text-purple-300 font-bold">Episode {item.episode}</span>
                    <span>·</span>
                    <span className="text-[11px] text-[#a1a1aa]">{dateStr}</span>
                  </div>

                  <div className="w-full h-1.5 bg-[#0d0b14] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 w-3/4" />
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatchAnime(item.animeId, item.episode);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white text-xs font-bold rounded-full shadow"
                    >
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                      Resume
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
