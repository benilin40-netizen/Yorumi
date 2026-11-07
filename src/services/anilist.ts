import { Anime } from '../types/anime';
import { aniListManager } from './anilistManager';

const MEDIA_FIELDS = `
  id
  idMal
  title {
    english
    romaji
    native
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  description(asHtml: false)
  genres
  averageScore
  popularity
  season
  seasonYear
  episodes
  duration
  status
  format
  isAdult
  nextAiringEpisode {
    id
    episode
    airingAt
    timeUntilAiring
  }
  trailer {
    id
    site
    thumbnail
  }
  studios(isMain: true) {
    nodes {
      id
      name
      isAnimationStudio
    }
  }
`;

const MEDIA_FIELDS_FULL = `
  ${MEDIA_FIELDS}
  characters(sort: ROLE, perPage: 12) {
    edges {
      role
      node {
        id
        name {
          full
          native
        }
        image {
          large
        }
      }
    }
  }
  staff(perPage: 8) {
    edges {
      role
      node {
        id
        name {
          full
        }
      }
    }
  }
  relations {
    edges {
      relationType
      node {
        ${MEDIA_FIELDS}
      }
    }
  }
  recommendations(perPage: 10, sort: RATING_DESC) {
    nodes {
      mediaRecommendation {
        ${MEDIA_FIELDS}
      }
    }
  }
`;



// ... fields definitions ...
// (Retain MEDIA_FIELDS and MEDIA_FIELDS_FULL)

async function fetchGraphQL<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  return aniListManager.request<T>(query, variables);
}

export async function getTrendingAnime(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchGraphQL<any>(query, { page, perPage });
  return {
    media: data.Page.media,
    pageInfo: data.Page.pageInfo,
  };
}

export async function getPopularAnime(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchGraphQL<any>(query, { page, perPage });
  return {
    media: data.Page.media,
    pageInfo: data.Page.pageInfo,
  };
}

export async function getTopRatedAnime(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchGraphQL<any>(query, { page, perPage });
  return {
    media: data.Page.media,
    pageInfo: data.Page.pageInfo,
  };
}

export async function getSeasonalAnime(season?: string, year?: number, page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  let currentSeason = season;
  if (!currentSeason) {
    const month = now.getMonth() + 1; // 1-12
    if (month >= 1 && month <= 3) currentSeason = 'WINTER';
    else if (month >= 4 && month <= 6) currentSeason = 'SPRING';
    else if (month >= 7 && month <= 9) currentSeason = 'SUMMER';
    else currentSeason = 'FALL';
  }

  const query = `
    query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchGraphQL<any>(query, { season: currentSeason, seasonYear: currentYear, page, perPage });
  return {
    media: data.Page.media,
    pageInfo: data.Page.pageInfo,
  };
}

export async function getUpcomingAnime(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(status: NOT_YET_RELEASED, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchGraphQL<any>(query, { page, perPage });
  return {
    media: data.Page.media,
    pageInfo: data.Page.pageInfo,
  };
}

export async function getAnimeMovies(page = 1, perPage = 12): Promise<{ media: Anime[]; pageInfo: any }> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(format: MOVIE, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchGraphQL<any>(query, { page, perPage });
  return {
    media: data.Page.media,
    pageInfo: data.Page.pageInfo,
  };
}

export async function getAnimeById(id: number): Promise<Anime | null> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS_FULL}
      }
    }
  `;
  try {
    const data = await fetchGraphQL<any>(query, { id });
    return data.Media || null;
  } catch (err) {
    console.error(`Error fetching anime by ID ${id}:`, err);
    return null;
  }
}

export async function getAiringSchedule(airingAtGreater: number, airingAtLesser: number, page = 1, perPage = 50): Promise<any[]> {
  const query = `
    query ($airingAtGreater: Int, $airingAtLesser: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
          id
          airingAt
          timeUntilAiring
          episode
          media {
            ${MEDIA_FIELDS}
          }
        }
      }
    }
  `;
  try {
    const data = await aniListManager.request<any>(query, { airingAtGreater, airingAtLesser, page, perPage }, 900000);
    return data.Page.airingSchedules || [];
  } catch (err) {
    console.error('Error fetching airing schedule:', err);
    return [];
  }
}

export interface DiscoverFilters {
  search?: string;
  genre?: string;
  year?: number;
  season?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export async function searchAnime(filters: DiscoverFilters = {}): Promise<{ media: Anime[]; pageInfo: any }> {
  const {
    search,
    genre,
    year,
    season,
    format,
    status,
    sort = 'POPULARITY_DESC',
    page = 1,
    perPage = 18,
  } = filters;

  const variables: Record<string, any> = {
    page,
    perPage,
    type: 'ANIME',
    isAdult: false,
    sort: [sort],
  };

  if (search && search.trim() !== '') variables.search = search.trim();
  if (genre) variables.genre = genre;
  if (year) variables.seasonYear = year;
  if (season) variables.season = season;
  if (format) variables.format = format;
  if (status) variables.status = status;

  const query = `
    query (
      $page: Int,
      $perPage: Int,
      $search: String,
      $genre: String,
      $seasonYear: Int,
      $season: MediaSeason,
      $format: MediaFormat,
      $status: MediaStatus,
      $sort: [MediaSort]
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(
          search: $search,
          genre: $genre,
          seasonYear: $seasonYear,
          season: $season,
          format: $format,
          status: $status,
          sort: $sort,
          type: ANIME,
          isAdult: false
        ) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await fetchGraphQL<any>(query, variables);
  return {
    media: data.Page.media || [],
    pageInfo: data.Page.pageInfo,
  };
}


