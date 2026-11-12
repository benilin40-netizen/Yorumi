import { Anime } from '../types/anime';
import * as aniListService from './anilist';
import { safeFetchJson } from '../utils/apiClient';

// -------------------------------------------------------------
// CURATED FALLBACK ANIME CATALOG (Ensures UI never crashes or breaks)
// -------------------------------------------------------------
export const FALLBACK_ANIME_CATALOG: Anime[] = [
  {
    id: 16498,
    idMal: 52034,
    title: { english: 'Solo Leveling', romaji: 'Ore dake Level Up na Ken', native: '俺だけレベルアップな件' },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3W4P74i0.png',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx151807-m1gX3W4P74i0.png',
      medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx151807-m1gX3W4P74i0.png',
      color: '#e4405f',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-5nL2T2d1Mv20.jpg',
    description: '10 years ago, after the "Gate" that connected the real world with the monster world opened, some of the ordinary, everyday people received the power to hunt monsters within the Gate. They are known as Hunters.',
    genres: ['Action', 'Adventure', 'Fantasy'],
    averageScore: 86,
    popularity: 145000,
    season: 'WINTER',
    seasonYear: 2024,
    episodes: 12,
    duration: 24,
    status: 'FINISHED',
    format: 'TV',
  },
  {
    id: 145139,
    idMal: 5114,
    title: { english: 'Frieren: Beyond Journey\'s End', romaji: 'Sousou no Frieren', native: '葬送のフリーレン' },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n6244M6a8Gq4.png',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587-n6244M6a8Gq4.png',
      medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx154587-n6244M6a8Gq4.png',
      color: '#3498db',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-1oR6YgY8Xm88.jpg',
    description: 'After the party of heroes defeated the Demon King, they restored peace to the land and returned to their lives of solitude. Decades pass, and elf mage Frieren faces humanity’s mortality.',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    averageScore: 91,
    popularity: 180000,
    season: 'FALL',
    seasonYear: 2023,
    episodes: 28,
    duration: 24,
    status: 'FINISHED',
    format: 'TV',
  },
  {
    id: 113415,
    idMal: 40748,
    title: { english: 'Jujutsu Kaisen Season 2', romaji: 'Jujutsu Kaisen 2nd Season', native: '呪術廻戦' },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx142838-89cM8F8tP8wL.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx142838-89cM8F8tP8wL.jpg',
      medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx142838-89cM8F8tP8wL.jpg',
      color: '#9b59b6',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/142838-5j1aP4n2T2b2.jpg',
    description: 'The past comes back to haunt Satoru Gojo and Suguru Geto as sorcery students assigned to protect the Star Plasma Vessel.',
    genres: ['Action', 'Supernatural'],
    averageScore: 88,
    popularity: 210000,
    season: 'SUMMER',
    seasonYear: 2023,
    episodes: 23,
    duration: 24,
    status: 'FINISHED',
    format: 'TV',
  },
  {
    id: 101922,
    idMal: 38000,
    title: { english: 'Demon Slayer: Kimetsu no Yaiba', romaji: 'Kimetsu no Yaiba', native: '鬼滅の刃' },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1rB9R9wEZ.png',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx101922-PEn1rB9R9wEZ.png',
      medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx101922-PEn1rB9R9wEZ.png',
      color: '#e74c3c',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-YfZT271gM9x0.jpg',
    description: 'It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon.',
    genres: ['Action', 'Fantasy', 'Supernatural'],
    averageScore: 85,
    popularity: 290000,
    season: 'SPRING',
    seasonYear: 2019,
    episodes: 26,
    duration: 24,
    status: 'FINISHED',
    format: 'TV',
  },
  {
    id: 16498,
    idMal: 21,
    title: { english: 'One Piece', romaji: 'One Piece', native: 'ONE PIECE' },
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/nx21-tX2soL5aRoA2.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/nx21-tX2soL5aRoA2.jpg',
      medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/nx21-tX2soL5aRoA2.jpg',
      color: '#f39c12',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf6yrPtx0xL5.jpg',
    description: 'Monkey D. Luffy sets off to sea to find the ultimate treasure, the One Piece, and become King of the Pirates.',
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    averageScore: 87,
    popularity: 350000,
    season: 'FALL',
    seasonYear: 1999,
    episodes: 1100,
    duration: 24,
    status: 'RELEASING',
    format: 'TV',
  },
];

// Helper to normalize Jikan response to Anime model
function normalizeJikanItem(item: any): Anime {
  const images = item.images?.jpg || item.images?.webp || {};
  return {
    id: item.mal_id,
    idMal: item.mal_id,
    title: {
      english: item.title_english || item.title || null,
      romaji: item.title || item.title_japanese || 'Anime Title',
      native: item.title_japanese || null,
    },
    coverImage: {
      extraLarge: images.large_image_url || images.image_url || '',
      large: images.image_url || images.small_image_url || '',
      medium: images.small_image_url || images.image_url || '',
      color: '#8b5cf6',
    },
    bannerImage: images.large_image_url || null,
    description: item.synopsis || 'No description available.',
    genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.name) : ['Anime'],
    averageScore: item.score ? Math.round(item.score * 10) : 80,
    popularity: item.members || 50000,
    season: item.season ? item.season.toUpperCase() : 'WINTER',
    seasonYear: item.year || new Date().getFullYear(),
    episodes: item.episodes || 12,
    duration: item.duration ? parseInt(item.duration) || 24 : 24,
    status: item.airing ? 'RELEASING' : 'FINISHED',
    format: item.type ? item.type.toUpperCase() : 'TV',
  };
}

// -------------------------------------------------------------
// UNIFIED ANIME PROVIDER SERVICE
// -------------------------------------------------------------
export async function getTrendingAnime(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  try {
    const res = await aniListService.getTrendingAnime(page, perPage);
    if (res.media && res.media.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn('AniList getTrendingAnime failed, falling back to Jikan proxy:', err);
  }

  // Jikan Fallback
  const jikanRes = await safeFetchJson<{ data?: any[] }>('/api/jikan/search?q=top', { timeoutMs: 5000 });
  if (jikanRes.ok && jikanRes.data?.data && jikanRes.data.data.length > 0) {
    const media = jikanRes.data.data.map(normalizeJikanItem);
    return {
      media,
      pageInfo: { total: media.length, currentPage: page, lastPage: 1, hasNextPage: false },
    };
  }

  // Local Catalog Fallback
  return {
    media: FALLBACK_ANIME_CATALOG,
    pageInfo: { total: FALLBACK_ANIME_CATALOG.length, currentPage: 1, lastPage: 1, hasNextPage: false },
  };
}

export async function getPopularAnime(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  try {
    const res = await aniListService.getPopularAnime(page, perPage);
    if (res.media && res.media.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn('AniList getPopularAnime failed, falling back to Jikan:', err);
  }

  const jikanRes = await safeFetchJson<{ data?: any[] }>('/api/jikan/search?q=popular', { timeoutMs: 5000 });
  if (jikanRes.ok && jikanRes.data?.data && jikanRes.data.data.length > 0) {
    const media = jikanRes.data.data.map(normalizeJikanItem);
    return {
      media,
      pageInfo: { total: media.length, currentPage: page, lastPage: 1, hasNextPage: false },
    };
  }

  return {
    media: FALLBACK_ANIME_CATALOG,
    pageInfo: { total: FALLBACK_ANIME_CATALOG.length, currentPage: 1, lastPage: 1, hasNextPage: false },
  };
}

export async function getTopRatedAnime(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  try {
    const res = await aniListService.getTopRatedAnime(page, perPage);
    if (res.media && res.media.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn('AniList getTopRatedAnime failed:', err);
  }

  return {
    media: FALLBACK_ANIME_CATALOG,
    pageInfo: { total: FALLBACK_ANIME_CATALOG.length, currentPage: 1, lastPage: 1, hasNextPage: false },
  };
}

export async function getSeasonalAnime(season?: string, year?: number, page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  try {
    const res = await aniListService.getSeasonalAnime(season, year, page, perPage);
    if (res.media && res.media.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn('AniList getSeasonalAnime failed:', err);
  }

  return {
    media: FALLBACK_ANIME_CATALOG,
    pageInfo: { total: FALLBACK_ANIME_CATALOG.length, currentPage: 1, lastPage: 1, hasNextPage: false },
  };
}

export async function getUpcomingAnime(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  try {
    const res = await aniListService.getUpcomingAnime(page, perPage);
    if (res.media && res.media.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn('AniList getUpcomingAnime failed:', err);
  }

  return {
    media: FALLBACK_ANIME_CATALOG,
    pageInfo: { total: FALLBACK_ANIME_CATALOG.length, currentPage: 1, lastPage: 1, hasNextPage: false },
  };
}

export async function getAnimeMovies(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  try {
    const res = await aniListService.getAnimeMovies(page, perPage);
    if (res.media && res.media.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn('AniList getAnimeMovies failed:', err);
  }

  return {
    media: FALLBACK_ANIME_CATALOG.filter((a) => a.format === 'MOVIE' || a.id === 145139),
    pageInfo: { total: FALLBACK_ANIME_CATALOG.length, currentPage: 1, lastPage: 1, hasNextPage: false },
  };
}

export async function getAnimeById(id: number): Promise<Anime | null> {
  try {
    const res = await aniListService.getAnimeById(id);
    if (res) return res;
  } catch (err) {
    console.warn(`AniList getAnimeById(${id}) failed, trying Jikan:`, err);
  }

  // Jikan Fallback
  const jikanRes = await safeFetchJson<{ data?: any }>(`/api/jikan/anime/${id}`, { timeoutMs: 5000 });
  if (jikanRes.ok && jikanRes.data?.data) {
    return normalizeJikanItem(jikanRes.data.data);
  }

  // Check fallback catalog
  const found = FALLBACK_ANIME_CATALOG.find((a) => a.id === id || a.idMal === id);
  return found || FALLBACK_ANIME_CATALOG[0];
}

export async function searchAnime(filters: aniListService.DiscoverFilters = {}): Promise<{ media: Anime[]; pageInfo: any }> {
  try {
    const res = await aniListService.searchAnime(filters);
    if (res.media && res.media.length > 0) {
      return res;
    }
  } catch (err) {
    console.warn('AniList searchAnime failed:', err);
  }

  const query = filters.search || '';
  if (query) {
    const jikanRes = await safeFetchJson<{ data?: any[] }>(`/api/jikan/search?q=${encodeURIComponent(query)}`, { timeoutMs: 5000 });
    if (jikanRes.ok && jikanRes.data?.data && jikanRes.data.data.length > 0) {
      const media = jikanRes.data.data.map(normalizeJikanItem);
      return {
        media,
        pageInfo: { total: media.length, currentPage: 1, lastPage: 1, hasNextPage: false },
      };
    }
  }

  return {
    media: FALLBACK_ANIME_CATALOG,
    pageInfo: { total: FALLBACK_ANIME_CATALOG.length, currentPage: 1, lastPage: 1, hasNextPage: false },
  };
}
