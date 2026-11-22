import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAnimeEpisodeSchedule,
  isEpisodePlayable,
  getNextPlayableEpisode,
} from '../src/services/episodeService.js';
import { Anime } from '../src/types/anime.js';

test('Milestone 3 & 4: Progressive episode availability does NOT expose future episodes as playable', () => {
  // Scenario: Ongoing anime (RELEASING) scheduled for 12 episodes, next airing is Episode 3
  const ongoingAnime: Anime = {
    id: 151807,
    idMal: 52299,
    title: { english: 'Solo Leveling', romaji: 'Ore dake Level Up na Ken', native: '俺だけレベルアップな件' },
    coverImage: {
      large: 'https://example.com/cover.jpg',
      extraLarge: 'https://example.com/cover.jpg',
      medium: 'https://example.com/cover-m.jpg',
      color: '#6366f1',
    },
    bannerImage: null,
    format: 'TV',
    status: 'RELEASING',
    episodes: 12, // Season scheduled for 12 total episodes
    duration: 24,
    genres: ['Action', 'Fantasy'],
    averageScore: 84,
    popularity: 250000,
    description: 'Solo Leveling anime series',
    season: 'WINTER',
    seasonYear: 2024,
    nextAiringEpisode: {
      id: 991,
      episode: 3,
      airingAt: Math.floor(Date.now() / 1000) + 86400 * 3, // 3 days in future
      timeUntilAiring: 86400 * 3,
    },
  };

  const schedule = calculateAnimeEpisodeSchedule(ongoingAnime);

  // Core requirement: exactly episodes 1 and 2 are released
  assert.equal(schedule.latestReleasedEpisode, 2, 'Latest released episode must be episode 2 (next - 1)');

  const ep1 = schedule.episodes.find((e) => e.episodeNumber === 1);
  const ep2 = schedule.episodes.find((e) => e.episodeNumber === 2);
  const ep3 = schedule.episodes.find((e) => e.episodeNumber === 3);
  const ep4 = schedule.episodes.find((e) => e.episodeNumber === 4);

  assert.ok(ep1 && ep1.status === 'released' && ep1.hasStreamSource, 'Episode 1 must be released and playable');
  assert.ok(ep2 && ep2.status === 'released' && ep2.hasStreamSource, 'Episode 2 must be released and playable');
  assert.ok(ep3 && ep3.status === 'upcoming' && !ep3.hasStreamSource, 'Episode 3 must be upcoming and NOT playable');
  assert.ok(ep4 && ep4.status === 'upcoming' && !ep4.hasStreamSource, 'Episode 4 must be upcoming and NOT playable');

  // Verify isEpisodePlayable gate
  const play1 = isEpisodePlayable(ongoingAnime, 1);
  assert.equal(play1.playable, true, 'Episode 1 must be playable');

  const play2 = isEpisodePlayable(ongoingAnime, 2);
  assert.equal(play2.playable, true, 'Episode 2 must be playable');

  const play3 = isEpisodePlayable(ongoingAnime, 3);
  assert.equal(play3.playable, false, 'Episode 3 must NOT be playable');
  assert.match(play3.reason || '', /scheduled/i, 'Reason must state episode is scheduled/not yet released');

  const play12 = isEpisodePlayable(ongoingAnime, 12);
  assert.equal(play12.playable, false, 'Future Episode 12 must NOT be playable even though total episodes is 12');

  // Test getNextPlayableEpisode auto-play behavior
  const nextFrom1 = getNextPlayableEpisode(ongoingAnime, 1);
  assert.ok(nextFrom1 && nextFrom1.episodeNumber === 2, 'Next episode after 1 must be 2');

  const nextFrom2 = getNextPlayableEpisode(ongoingAnime, 2);
  assert.equal(nextFrom2, null, 'Next episode after 2 must be null because 3 is unreleased');
});

test('Milestone 3: Never fabricates 12 or 24 episodes when episodes count is unknown (null)', () => {
  const unknownTotalAnime: Anime = {
    id: 99999,
    idMal: 99999,
    title: { english: 'Mysterious Ongoing Series', romaji: 'Mysterious Series', native: '謎のアニメ' },
    coverImage: {
      large: 'https://example.com/cover.jpg',
      extraLarge: 'https://example.com/cover.jpg',
      medium: 'https://example.com/cover-m.jpg',
      color: '#6366f1',
    },
    bannerImage: null,
    format: 'TV',
    status: 'NOT_YET_RELEASED',
    episodes: null,
    duration: 24,
    genres: ['Mystery'],
    averageScore: null,
    popularity: 1000,
    description: 'Unknown episodes series',
    season: 'SPRING',
    seasonYear: 2025,
  };

  const schedule = calculateAnimeEpisodeSchedule(unknownTotalAnime);
  assert.equal(schedule.totalEpisodes, null, 'Total episodes must remain null, never fabricated to 12 or 24');
  assert.equal(schedule.latestReleasedEpisode, 0, 'No episodes should be released');
  assert.equal(schedule.episodes.length, 0, 'No fake episode entries should be generated');
});

test('Milestone 3: Finished anime releases all confirmed episodes', () => {
  const finishedAnime: Anime = {
    id: 154587,
    idMal: 52991,
    title: { english: 'Frieren: Beyond Journey\'s End', romaji: 'Sousou no Frieren', native: '葬送のフリーレン' },
    coverImage: {
      large: 'https://example.com/frieren.jpg',
      extraLarge: 'https://example.com/frieren.jpg',
      medium: 'https://example.com/frieren-m.jpg',
      color: '#a855f7',
    },
    bannerImage: null,
    format: 'TV',
    status: 'FINISHED',
    episodes: 28,
    duration: 24,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    averageScore: 93,
    popularity: 350000,
    description: 'Frieren journeys across the land',
    season: 'FALL',
    seasonYear: 2023,
  };

  const schedule = calculateAnimeEpisodeSchedule(finishedAnime);
  assert.equal(schedule.latestReleasedEpisode, 28, 'All 28 episodes of finished anime must be released');
  assert.equal(schedule.episodes.length, 28, 'Schedule must contain all 28 episodes');
  assert.ok(schedule.episodes.every((e) => e.status === 'released' && e.hasStreamSource), 'Every finished episode must be released and playable');
});
