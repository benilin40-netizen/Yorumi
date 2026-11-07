import React from 'react';
import { Wifi, AlertTriangle, Clock } from 'lucide-react';

export const ApiStatusMonitor: React.FC = () => {
  // This is a placeholder; real implementation would need to hook into AniListManager state
  // For now, it shows the UI concept
  return (
    <div className="fixed bottom-4 right-4 z-50 p-3 bg-[#161321] rounded-xl border border-[#2a243a] shadow-xl flex items-center gap-3 text-xs text-[#a1a1aa]">
      <div className="flex items-center gap-1.5">
        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
        <span>AniList: Connected</span>
      </div>
      <div className="h-3 w-px bg-[#2a243a]" />
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-purple-400" />
        <span>Quota: 90/90</span>
      </div>
    </div>
  );
};
