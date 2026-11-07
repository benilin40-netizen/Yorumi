export interface AnimeTitle {
  english: string | null;
  romaji: string;
  native: string | null;
}

export interface AnimeCoverImage {
  extraLarge: string;
  large: string;
  medium: string;
  color: string | null;
}

export interface AnimeStudio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}

export interface AnimeCharacter {
  id: number;
  name: {
    full: string;
    native?: string | null;
  };
  image: {
    large: string;
  };
  role: 'MAIN' | 'SUPPORTING' | string;
}

export interface AnimeStaff {
  id: number;
  name: {
    full: string;
  };
  role: string;
}

export interface AnimeTrailer {
  id: string;
  site: string;
  thumbnail?: string | null;
}

export interface AiringEpisode {
  id: number;
  episode: number;
  airingAt: number; // Unix timestamp
  timeUntilAiring: number; // seconds
}

export interface AnimeRelation {
  relationType: string;
  node: Anime;
}

export interface AnimeRecommendation {
  mediaRecommendation: Anime;
}

export interface Anime {
  id: number; // AniList ID
  idMal: number | null; // MyAnimeList ID
  title: AnimeTitle;
  coverImage: AnimeCoverImage;
  bannerImage: string | null;
  description: string | null;
  genres: string[];
  averageScore: number | null; // 0-100
  popularity: number | null;
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' | null;
  seasonYear: number | null;
  episodes: number | null;
  duration: number | null; // minutes per ep
  status: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS' | string;
  format: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC' | string;
  isAdult?: boolean;
  studios?: {
    nodes: AnimeStudio[];
  };
  characters?: {
    edges: {
      role: string;
      node: AnimeCharacter;
    }[];
  };
  staff?: {
    edges: {
      role: string;
      node: AnimeStaff;
    }[];
  };
  trailer?: AnimeTrailer | null;
  nextAiringEpisode?: AiringEpisode | null;
  relations?: {
    edges: AnimeRelation[];
  };
  recommendations?: {
    nodes: AnimeRecommendation[];
  };
}


export type WatchStatus = 'WATCHING' | 'PLANNING' | 'COMPLETED' | 'DROPPED';

export interface WatchlistItem {
  anime: Anime;
  status: WatchStatus;
  userScore: number | null; // 1-10
  lastWatchedEpisode: number;
  updatedAt: number; // timestamp
}

export interface WatchHistoryItem {
  animeId: number;
  idMal: number | null;
  animeTitle: string;
  coverImage: string;
  bannerImage: string | null;
  episode: number;
  progressSeconds: number;
  totalDurationSeconds: number;
  timestamp: number;
}

export interface ProviderHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  lastChecked: number;
  enabled: boolean;
  notes?: string;
}

export type AudioOption = 'sub' | 'dub';

export interface StreamEmbedConfig {
  providerId: 'jutsu';
  url: string;
  isIframe: boolean;
  isHls?: boolean;
}

export type UserRole = 'admin' | 'moderator' | 'vip' | 'member' | 'USER';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface UserAccount {
  id: string;
  uid?: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  accountStatus?: UserStatus;
  avatarUrl?: string;
  bio?: string;
  createdAt: number;
  updatedAt?: number;
  lastLoginAt?: number;
  watchlistCount?: number;
  passwordHash?: string;
}

