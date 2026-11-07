import React from 'react';
import { Lock } from 'lucide-react';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="w-full bg-[#120f1b] border-t border-[#2a243a] pt-12 pb-8 px-6 lg:px-12 text-[#a1a1aa] text-xs">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Column 1: Brand & Tagline */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                <div className="w-full h-full bg-[#0d0b14] rounded-[6px] flex items-center justify-center">
                  <span className="font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 text-xs">
                    Y
                  </span>
                </div>
              </div>
              <span className="font-display font-extrabold text-base tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                YORUMI
              </span>
            </div>
            <p className="text-[#a1a1aa] leading-relaxed text-xs font-sans">
              Your World. Your Anime. Premium discovery and streaming platform built with AniList GraphQL, live episode countdowns, and modular playback providers.
            </p>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="space-y-2.5">
            <h4 className="font-display font-extrabold text-[#fafafa] uppercase tracking-wider text-[11px]">Navigation</h4>
            <ul className="space-y-1.5 font-sans">
              <li><button onClick={() => onNavigate('discover')} className="hover:text-white transition-colors">Discover Catalog</button></li>
              <li><button onClick={() => onNavigate('trending')} className="hover:text-white transition-colors">Trending Anime</button></li>
              <li><button onClick={() => onNavigate('seasonal')} className="hover:text-white transition-colors">Current Season</button></li>
              <li><button onClick={() => onNavigate('movies')} className="hover:text-white transition-colors">Anime Movies</button></li>
              <li><button onClick={() => onNavigate('schedule')} className="hover:text-white transition-colors">Episode Schedule</button></li>
            </ul>
          </div>

          {/* Column 3: User Hub */}
          <div className="space-y-2.5">
            <h4 className="font-display font-extrabold text-[#fafafa] uppercase tracking-wider text-[11px]">Personal Hub</h4>
            <ul className="space-y-1.5 font-sans">
              <li><button onClick={() => onNavigate('watchlist')} className="hover:text-white transition-colors">My Watchlist</button></li>
              <li><button onClick={() => onNavigate('history')} className="hover:text-white transition-colors">Watch History</button></li>
            </ul>
          </div>

          {/* Column 4: Platform & Data Attribution */}
          <div className="space-y-2.5">
            <h4 className="font-display font-extrabold text-[#fafafa] uppercase tracking-wider text-[11px]">Data & Integrations</h4>
            <p className="text-[#a1a1aa] leading-relaxed text-xs font-sans">
              Anime metadata, seasonal schedules, and character information provided through AniList GraphQL.
            </p>
            <ul className="space-y-1.5 font-sans pt-1">
              <li>
                <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  AniList Documentation ↗
                </a>
              </li>
              <li>
                <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  MyAnimeList Catalog ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Attribution Line */}
        <div className="pt-6 border-t border-[#2a243a] flex flex-col sm:flex-row items-center justify-between gap-4 text-[#a1a1aa] text-[11px] font-sans">
          <p>© {new Date().getFullYear()} YORUMI. Premium Anime Streaming. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('admin')}
              className="flex items-center gap-1.5 text-[#a1a1aa]/70 hover:text-white transition-colors"
              title="Restricted Staff Area"
            >
              <Lock className="w-3 h-3 text-purple-400/80" />
              <span>Admin Console</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
