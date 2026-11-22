import 'dotenv/config';

export const SERVER_CONFIG = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,

  // Streaming Providers (Backend Only)
  yenime: {
    apiBaseUrl: process.env.YENIME_API_BASE_URL || 'https://api.yenime.net',
    embedTemplate:
      process.env.YENIME_EMBED_TEMPLATE ||
      'https://player.yenime.net/anime/ani/{ANILIST_ID}/{EPISODE}',
  },
  aniembed: {
    baseUrl: process.env.ANIEMBED_BASE_URL || 'https://aniembed.se/e',
    embedTemplate:
      process.env.ANIEMBED_TEMPLATE ||
      'https://aniembed.se/e/{ANILIST_ID}/{EPISODE}?lang={LANG}&autoplay={AUTOPLAY}&t={START}',
  },
  kuroko: {
    apiBaseUrl: process.env.KUROKO_API_BASE_URL || 'https://kuroko.cc/api/v1',
    embedBaseUrl: process.env.KUROKO_EMBED_BASE_URL || 'https://kuroko.cc/embed',
    embedTemplate:
      process.env.KUROKO_EMBED_TEMPLATE ||
      'https://kuroko.cc/embed/ani/{anilist_id}/{episode}/{language}',
    enabled: (process.env.KUROKO_ENABLED ?? 'true').toLowerCase() !== 'false',
  },

  // External Metadata APIs (Backend Only)
  anilistApiUrl: (process.env.ANILIST_API_URL || 'https://graphql.anilist.co').trim().replace(/^['"]|['"]$/g, ''),
  jikanApiUrl: (process.env.JIKAN_API_URL || 'https://api.jikan.moe/v4').trim().replace(/^['"]|['"]$/g, ''),

  // Supabase (Server Only)
  supabaseUrl: (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://cnmswpzbjdrjyapfnygo.supabase.co'
  )
    .trim()
    .replace(/^['"]|['"]$/g, ''),
  supabasePublishableKey: (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim().replace(/^['"]|['"]$/g, ''),
  get supabaseServiceRoleKey(): string {
    return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  },

  // Admin Auth (never hardcoded)
  get adminPassword(): string {
    return (process.env.ADMIN_PASSWORD || '').trim().replace(/^['"]|['"]$/g, '');
  },
};
