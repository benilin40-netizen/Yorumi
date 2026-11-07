import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getAiringSchedule } from '../../services/anilist';
import { CountdownCard } from './CountdownCard';

interface CountdownSectionProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

export const CountdownSection: React.FC<CountdownSectionProps> = ({
  onSelectAnime,
  onWatchAnime,
}) => {
  const [scheduleItems, setScheduleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'upcoming'>('today');

  useEffect(() => {
    async function loadSchedule() {
      setLoading(true);
      const now = Math.floor(Date.now() / 1000);
      const window48h = 48 * 3600;
      const items = await getAiringSchedule(now, now + window48h, 1, 10);
      setScheduleItems(items);
      setLoading(false);
    }
    loadSchedule();
  }, []);

  const filteredItems = scheduleItems.filter((item) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = item.airingAt - now;
    if (filter === 'today') return diff <= 24 * 3600;
    return diff > 24 * 3600;
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-purple-400" />
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Episode Release <span className="brand-gradient-text">Countdown</span>
          </h2>
        </div>

        {/* Filter Pill Switcher */}
        <div className="flex items-center p-1 bg-[#161321] rounded-full border border-[#2a243a] text-xs">
          <button
            onClick={() => setFilter('today')}
            className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
              filter === 'today'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            Airing Today
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
              filter === 'upcoming'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            Releasing Soon
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-[#161321] border border-[#2a243a] animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.slice(0, 6).map((item) => (
            <CountdownCard
              key={item.id}
              anime={item.media}
              episodeNumber={item.episode}
              airingAtTimestamp={item.airingAt}
              onSelect={onSelectAnime}
              onWatch={onWatchAnime}
            />
          ))}
        </div>
      )}
    </section>
  );
};
