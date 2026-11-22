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

export interface AnimeFuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
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
  startDate?: AnimeFuzzyDate | null;
  episodes: number | null;
  airedEpisodes?: number;
  lastAiredAt?: number | null;
  latestAiredEpisode?: number;
  isUnreleased?: boolean;
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
  airingSchedule?: {
    nodes: { id: number; episode: number; airingAt: number }[];
  };
  relations?: {
    edges: AnimeRelation[];
  };
  recommendations?: {
    nodes: AnimeRecommendation[];
  };
}

export interface ConfirmedEpisodeItem {
  episode: number;
  airingAt: number | null;
  confirmedBy: 'anilist' | 'provider';
}

export interface ConfirmedEpisodesResponse {
  anilistId: number;
  status: string;
  totalEpisodes: number | null;
  airedEpisodes: ConfirmedEpisodeItem[];
  nextAiringEpisode: {
    episode: number;
    airingAt: number;
    timeUntilAiring: number;
  } | null;
}

export type EpisodeStatus = 'released' | 'airing' | 'upcoming' | 'delayed' | 'unavailable';

export type WatchStatus = 'WATCHING' | 'PLANNING' | 'COMPLETED' | 'FAVORITE' | 'DROPPED';

export interface WatchlistItem {
  anime: Anime;
  status: WatchStatus;
  isFavorite?: boolean;
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

export type ProviderId = 'yenime' | 'aniembed' | 'kuroko';
export type ProviderMode = 'auto' | 'manual';

export interface ProviderHealth {
  id: ProviderId;
  name: string;
  priority: number;
  enabled: boolean;
  supportsDub: boolean;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  latencyMs: number | null;
  lastChecked: number | null;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  successCount: number;
  failureCount: number;
}

export type AudioOption = 'sub' | 'dub';

export interface ResolvedSource {
  id: ProviderId;
  name: string;
  priority: number;
  url: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

export interface SourcesResolutionResponse {
  mode: 'auto' | ProviderId;
  kurokoEnabled: boolean;
  selected: ResolvedSource | null;
  fallbacks: ResolvedSource[];
  allEnabled: ResolvedSource[];
  failedChecks: { id: ProviderId; name: string; reason: string }[];
}

export type UserRole = 'admin' | 'moderator' | 'vip' | 'member';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  bio?: string;
  preferredProvider?: ProviderId;
  providerMode?: ProviderMode;
  createdAt: number;
  lastLoginAt?: number;
  watchlistCount?: number;
}
