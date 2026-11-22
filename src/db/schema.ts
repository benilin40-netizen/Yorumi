import { pgTable, serial, text, timestamp, boolean, integer, jsonb, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('member'), // 'admin' | 'moderator' | 'member'
  status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'pending'
  emailVerified: boolean('email_verified').notNull().default(false),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  lastLoginAt: bigint('last_login_at', { mode: 'number' }).notNull(),
});

import { bigint } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // opaque token hash
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const watchlists = pgTable('watchlists', {
  id: text('id').primaryKey(), // `${userId}_${animeId}`
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  animeId: integer('anime_id').notNull(),
  animeJson: jsonb('anime_json').notNull(),
  status: text('status').notNull().default('WATCHING'), // WATCHING, PLAN_TO_WATCH, COMPLETED, DROPPED
  userScore: integer('user_score'),
  lastWatchedEpisode: integer('last_watched_episode').notNull().default(1),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const favorites = pgTable('favorites', {
  id: text('id').primaryKey(), // `${userId}_${animeId}`
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  animeId: integer('anime_id').notNull(),
  animeJson: jsonb('anime_json').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const watchHistory = pgTable('watch_history', {
  id: text('id').primaryKey(), // `${userId}_${animeId}`
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  animeId: integer('anime_id').notNull(),
  idMal: integer('id_mal'),
  animeTitle: text('anime_title').notNull(),
  coverImage: text('cover_image'),
  bannerImage: text('banner_image'),
  episode: integer('episode').notNull().default(1),
  progressSeconds: integer('progress_seconds').notNull().default(0),
  totalDurationSeconds: integer('total_duration_seconds').notNull().default(0),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('system'), // system, release, feature, alert
  read: boolean('read').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const notificationPreferences = pgTable('notification_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  emailAlertsEnabled: boolean('email_alerts_enabled').notNull().default(true),
  reminderIntervalMinutes: integer('reminder_interval_minutes').notNull().default(30),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  adminUserId: text('admin_user_id').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});
