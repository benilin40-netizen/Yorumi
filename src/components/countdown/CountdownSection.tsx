import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { getAiringSchedule } from '../../services/anilist';
import { CountdownCard } from './CountdownCard';

interface CountdownSectionProps {
  initialSchedules?: any[];
  onSelectAnime: (id: number) => void;
  onWatchAnime: (id: number, ep?: number) => void;
}

export const CountdownSection: React.FC<CountdownSectionProps> = ({
  initialSchedules,
  onSelectAnime,
  onWatchAnime,
}) => {
  const [scheduleItems, setScheduleItems] = useState<any[]>(initialSchedules || []);
  const [loading, setLoading] = useState(!initialSchedules);

  const userTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Local Time';
    }
  }, []);

  // Build 7 timezone-aware day tabs starting from today
  const dayTabs = useMemo(() => {
    const tabs: { key: string; label: string; subLabel: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const label =
        i === 0
          ? 'Today'
          : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString(undefined, { weekday: 'short' });
      const subLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      tabs.push({ key, label, subLabel });
    }
    return tabs;
  }, []);

  const [selectedDayKey, setSelectedDayKey] = useState<string>(dayTabs[0].key);

  useEffect(() => {
    if (initialSchedules && initialSchedules.length > 0) {
      setScheduleItems(initialSchedules);
      setLoading(false);
      return;
    }
    async function loadSchedule() {
      setLoading(true);
      const now = Math.floor(Date.now() / 1000);
      const items = await getAiringSchedule(now - 3600, now + 7 * 86400, 1, 50);
      setScheduleItems(items);
      setLoading(false);
    }
    loadSchedule();
  }, [initialSchedules]);

  const filteredItems = useMemo(() => {
    return scheduleItems.filter((item) => {
      const d = new Date(item.airingAt * 1000);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      return key === selectedDayKey;
    });
  }, [scheduleItems, selectedDayKey]);

  return (
    <motion.section
      initial={{ opacity: 0, x: 60 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-purple-400" />
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Airing This <span className="brand-gradient-text">Week</span>
            </h2>
          </div>
          <p className="text-xs text-[#a1a1aa] mt-0.5 flex items-center gap-1.5 font-sans">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span>Timezone: {userTimeZone}</span>
          </p>
        </div>

        {/* Timezone-Aware 7-Day Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-[#161321] rounded-xl border border-[#2a243a] text-xs">
          {dayTabs.map((tab) => {
            const active = selectedDayKey === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedDayKey(tab.key)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                    : 'text-[#a1a1aa] hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1 text-[10px] opacity-80 font-mono">{tab.subLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-[#161321] border border-[#2a243a] animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center bg-[#161321] rounded-xl border border-[#2a243a] text-xs text-[#a1a1aa]">
          No episodes scheduled for this day in {userTimeZone}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.slice(0, 9).map((item) => (
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
    </motion.section>
  );
};
