import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { getAiringSchedule } from '../services/anilist';
import { CountdownCard } from '../components/countdown/CountdownCard';

interface ScheduleProps {
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const Schedule: React.FC<ScheduleProps> = ({ onSelectAnime, onWatchAnime }) => {
  const [scheduleItems, setScheduleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  useEffect(() => {
    async function loadWeekly() {
      setLoading(true);
      try {
        const now = Math.floor(Date.now() / 1000);
        const weekSeconds = 7 * 86400;
        const items = await getAiringSchedule(now - 86400, now + weekSeconds, 1, 50);
        setScheduleItems(items);
      } catch (err) {
        console.error('Failed to load schedule:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWeekly();
  }, []);

  const filteredItems = scheduleItems.filter((item) => {
    const airDate = new Date(item.airingAt * 1000);
    return airDate.getDay() === selectedDay;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-purple-400" />
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Weekly <span className="brand-gradient-text">Airing Schedule</span>
          </h1>
        </div>
        <p className="text-sm text-[#a1a1aa] font-sans">
          Track upcoming episode release timestamps automatically synced with AniList and displayed in your local timezone.
        </p>
      </div>

      {/* Day Switcher Pills */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#161321] rounded-full border border-[#2a243a]">
        {DAYS.map((dayName, index) => {
          const isToday = new Date().getDay() === index;
          const isSelected = selectedDay === index;
          return (
            <button
              key={dayName}
              onClick={() => setSelectedDay(index)}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-full text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              <span>{dayName}</span>
              {isToday && (
                <span className="block text-[10px] font-mono text-blue-400 font-normal">Today</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule Items Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-[#161321] border border-[#2a243a] animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-[#161321] rounded-xl border border-[#2a243a] text-[#a1a1aa] text-sm font-sans">
          No scheduled releases found for {DAYS[selectedDay]}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
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
    </div>
  );
};
