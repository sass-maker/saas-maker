import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar_url: text('avatar_url'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  api_key: text('api_key').notNull().unique(),
  owner_id: text('owner_id').notNull().references(() => users.id),
  embedding_model: text('embedding_model'),
  ai_base_url: text('ai_base_url'),
  ai_api_key: text('ai_api_key'),
  ai_model: text('ai_model'),
  rate_limit_rpm: integer('rate_limit_rpm').notNull().default(60),
  rate_limit_enabled: integer('rate_limit_enabled').notNull().default(1),
  readme: text('readme'),
  source: text('source').notNull().default('dashboard'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references(() => projects.id),
  type: text('type').notNull(),
  status: text('status').notNull().default('new'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  image_url: text('image_url'),
  submitter_email: text('submitter_email').notNull(),
  submitter_name: text('submitter_name'),
  upvote_count: integer('upvote_count').notNull().default(0),
  downvote_count: integer('downvote_count').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const analytics_events = sqliteTable('analytics_events', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull().default('page_view'),
  url: text('url'),
  referrer: text('referrer'),
  utm_source: text('utm_source'),
  utm_medium: text('utm_medium'),
  utm_campaign: text('utm_campaign'),
  country: text('country'),
  device: text('device'),
  browser: text('browser'),
  screen_width: integer('screen_width'),
  properties: text('properties').default('{}'),
  os: text('os'),
  is_bot: integer('is_bot').notNull().default(0),
  session_id: text('session_id'),
  pathname: text('pathname'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const foundry_secrets = sqliteTable('foundry_secrets', {
  id: text('id').primaryKey(),
  project_id: text('project_id'), // Null for global secrets
  key: text('key').notNull(),
  value: text('value').notNull(),
  is_encrypted: integer('is_encrypted').notNull().default(1),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
});
