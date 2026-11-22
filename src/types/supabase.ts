export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WatchlistCategory = 'watching' | 'plan' | 'completed' | 'favorite';

export type ProfileRow = {
  id: string;
  username: string | null;
  preferred_provider: 'yenime' | 'aniembed' | 'kuroko' | null;
  preferred_lang: 'sub' | 'dub' | null;
  is_admin: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AnimeRow = {
  id?: number;
  anilist_id: number;
  id_mal?: number | null;
  title_english?: string | null;
  title_romaji: string;
  title_native?: string | null;
  cover_image?: string | null;
  banner_image?: string | null;
  description?: string | null;
  genres?: string[] | null;
  average_score?: number | null;
  popularity?: number | null;
  season?: string | null;
  season_year?: number | null;
  start_date?: Json | null;
  episodes?: number | null;
  aired_episodes?: number | null;
  duration?: number | null;
  status?: string | null;
  format?: string | null;
  trailer_id?: string | null;
  trailer_site?: string | null;
  trailer_override_id?: string | null;
  next_episode?: number | null;
  next_airing_at?: number | null;
  last_aired_at?: number | null;
  latest_aired_episode?: number | null;
  hidden?: boolean;
  updated_at?: string;
};

export type EpisodeRow = {
  id?: string | number;
  anilist_id: number;
  episode_number: number;
  title?: string | null;
  airing_at?: number | null;
  verified: boolean;
  confirmed_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AiringScheduleRow = {
  id?: number;
  anilist_id: number;
  episode_number: number;
  airing_at: number;
  time_until_airing?: number | null;
  updated_at?: string;
};

export type ProviderRow = {
  id: 'yenime' | 'aniembed' | 'kuroko' | string;
  name: string;
  priority: number;
  enabled: boolean;
  supports_dub?: boolean;
  updated_at?: string;
};

export type ProviderHealthRow = {
  id?: string | number;
  provider_id: string;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown' | string;
  latency_ms?: number | null;
  last_error?: string | null;
  checked_at?: string;
};

export type WatchProgressRow = {
  id?: string;
  user_id: string;
  anilist_id: number;
  episode_number: number;
  position_seconds: number;
  duration_seconds?: number | null;
  anime_title?: string | null;
  cover_image?: string | null;
  banner_image?: string | null;
  updated_at?: string;
};

export type WatchlistRow = {
  id?: string;
  user_id: string;
  anilist_id: number;
  status: WatchlistCategory | string;
  is_favorite?: boolean;
  score?: number | null;
  last_watched_episode?: number | null;
  anime_title?: string | null;
  cover_image?: string | null;
  format?: string | null;
  updated_at?: string;
};

export type AnalyticsEventRow = {
  id?: string | number;
  event_name: string;
  user_id?: string | null;
  anilist_id?: number | null;
  episode_number?: number | null;
  provider_id?: string | null;
  metadata?: Json | null;
  created_at?: string;
};

export type SiteSettingRow = {
  key: string;
  value: Json;
  updated_at?: string;
};

export type SyncRunRow = {
  id?: string | number;
  status: 'running' | 'completed' | 'failed' | string;
  items_fetched: number;
  items_playable: number;
  items_skipped: number;
  pages_fetched: number;
  error?: string | null;
  started_at?: string;
  finished_at?: string | null;
  created_at?: string;
};

export type AdminOverviewRpc = {
  series?: number;
  movies?: number;
  registered_users?: number;
  users?: number;
  verified_episodes?: number;
  [key: string]: Json | undefined;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      anime: {
        Row: AnimeRow;
        Insert: Partial<AnimeRow> & { anilist_id: number };
        Update: Partial<AnimeRow>;
        Relationships: [];
      };
      episodes: {
        Row: EpisodeRow;
        Insert: Partial<EpisodeRow> & { anilist_id: number; episode_number: number };
        Update: Partial<EpisodeRow>;
        Relationships: [];
      };
      airing_schedule: {
        Row: AiringScheduleRow;
        Insert: Partial<AiringScheduleRow> & { anilist_id: number; episode_number: number; airing_at: number };
        Update: Partial<AiringScheduleRow>;
        Relationships: [];
      };
      providers: {
        Row: ProviderRow;
        Insert: ProviderRow;
        Update: Partial<ProviderRow>;
        Relationships: [];
      };
      provider_health: {
        Row: ProviderHealthRow;
        Insert: Partial<ProviderHealthRow> & { provider_id: string; status: string };
        Update: Partial<ProviderHealthRow>;
        Relationships: [];
      };
      watch_progress: {
        Row: WatchProgressRow;
        Insert: Partial<WatchProgressRow> & {
          user_id: string;
          anilist_id: number;
          episode_number: number;
          position_seconds: number;
        };
        Update: Partial<WatchProgressRow>;
        Relationships: [];
      };
      watchlist: {
        Row: WatchlistRow;
        Insert: Partial<WatchlistRow> & {
          user_id: string;
          anilist_id: number;
          status: string;
        };
        Update: Partial<WatchlistRow>;
        Relationships: [];
      };
      analytics_events: {
        Row: AnalyticsEventRow;
        Insert: Partial<AnalyticsEventRow> & { event_name: string };
        Update: Partial<AnalyticsEventRow>;
        Relationships: [];
      };
      site_settings: {
        Row: SiteSettingRow;
        Insert: SiteSettingRow;
        Update: Partial<SiteSettingRow>;
        Relationships: [];
      };
      sync_runs: {
        Row: SyncRunRow;
        Insert: Partial<SyncRunRow>;
        Update: Partial<SyncRunRow>;
        Relationships: [];
      };
    };
    Views: {
      recently_updated: {
        Row: AnimeRow & {
          latest_aired_episode?: number | null;
          last_aired_at?: number | null;
        };
        Relationships: [];
      };
      movies_latest: {
        Row: AnimeRow;
        Relationships: [];
      };
    };
    Functions: {
      get_admin_overview: {
        Args: Record<string, never>;
        Returns: AdminOverviewRpc;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
