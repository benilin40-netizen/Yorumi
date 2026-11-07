import React from 'react';
import { Users, Film, Tv, Play, Activity } from 'lucide-react';

interface StatsProps {
  userCount: number;
  animeCount: number;
  episodeCount: number;
  watchActivity: number;
}

export const DashboardStats: React.FC<StatsProps> = ({ userCount, animeCount, episodeCount, watchActivity }) => {
  const stats = [
    { label: 'Total Users', value: userCount.toLocaleString(), icon: Users, color: 'text-purple-400' },
    { label: 'Total Anime', value: animeCount.toLocaleString(), icon: Film, color: 'text-blue-400' },
    { label: 'Total Episodes', value: episodeCount.toLocaleString(), icon: Tv, color: 'text-pink-400' },
    { label: 'Watch Events', value: watchActivity.toLocaleString(), icon: Play, color: 'text-emerald-400' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <div key={i} className="bg-[#161321] p-5 rounded-xl border border-[#2a243a] flex items-center gap-4 shadow-lg">
          <div className={`p-3 rounded-lg bg-[#0d0b14] ${stat.color} bg-opacity-10`}>
            <stat.icon className={`w-6 h-6 ${stat.color}`} />
          </div>
          <div>
            <p className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-bold">{stat.label}</p>
            <p className="text-xl font-bold text-white font-mono">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
