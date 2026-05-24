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

export const ai_requests = sqliteTable('ai_requests', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references(() => projects.id),
  endpoint: text('endpoint').notNull(),
  model: text('model').notNull(),
  status: text('status').notNull(),
  latency_ms: integer('latency_ms'),
  input_tokens: integer('input_tokens'),
  output_tokens: integer('output_tokens'),
  error_message: text('error_message'),
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

export const foundry_jobs = sqliteTable('foundry_jobs', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull(),
  type: text('type').notNull(), // 'debug', 'migration', 'forge'
  status: text('status').notNull(), // 'pending', 'running', 'completed', 'failed'
  message: text('message'),
  logs: text('logs').default(''),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const symphony_memory = sqliteTable('symphony_memory', {
  owner_id: text('owner_id').primaryKey().references(() => users.id),
  content: text('content').notNull().default(''),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const symphony_audit_log = sqliteTable('symphony_audit_log', {
  id: text('id').primaryKey(),
  owner_id: text('owner_id').notNull().references(() => users.id),
  task_id: text('task_id'),
  action: text('action').notNull(),
  actor_source: text('actor_source').notNull().default('api'),
  agent_profile: text('agent_profile'),
  project_slug: text('project_slug'),
  metadata: text('metadata').notNull().default('{}'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const symphony_runs = sqliteTable('symphony_runs', {
  id: text('id').primaryKey(),
  owner_id: text('owner_id').notNull().references(() => users.id),
  task_id: text('task_id'),
  project_slug: text('project_slug'),
  agent_profile: text('agent_profile'),
  model_profile: text('model_profile'),
  command_template: text('command_template').notNull(),
  pid: integer('pid'),
  status: text('status').notNull().default('started'),
  workspace_path: text('workspace_path'),
  prompt_path: text('prompt_path'),
  terminal_hint: text('terminal_hint'),
  log_hint: text('log_hint'),
  cost_note: text('cost_note'),
  token_note: text('token_note'),
  metadata: text('metadata').notNull().default('{}'),
  started_at: text('started_at').notNull().default(sql`(datetime('now'))`),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const droid_runs = sqliteTable('droid_runs', {
  id: text('id').primaryKey(),
  task_id: text('task_id'),
  project_slug: text('project_slug'),
  repo_url: text('repo_url'),
  branch: text('branch'),
  command: text('command').notNull(),
  cwd: text('cwd'),
  sandbox_id: text('sandbox_id').notNull(),
  status: text('status').notNull().default('queued'),
  exit_code: integer('exit_code'),
  duration_ms: integer('duration_ms'),
  summary: text('summary'),
  error_message: text('error_message'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  started_at: text('started_at'),
  finished_at: text('finished_at'),
});

export const droid_run_events = sqliteTable('droid_run_events', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => droid_runs.id),
  type: text('type').notNull(),
  actor: text('actor').notNull().default('droid'),
  source: text('source').notNull().default('worker'),
  message: text('message'),
  command: text('command'),
  cwd: text('cwd'),
  exit_code: integer('exit_code'),
  stdout: text('stdout'),
  stderr: text('stderr'),
  metadata: text('metadata').notNull().default('{}'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const droid_run_artifacts = sqliteTable('droid_run_artifacts', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => droid_runs.id),
  type: text('type').notNull(),
  name: text('name').notNull(),
  uri: text('uri').notNull(),
  metadata: text('metadata').notNull().default('{}'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const task_comments = sqliteTable('task_comments', {
  id: text('id').primaryKey(),
  owner_id: text('owner_id').notNull().references(() => users.id),
  task_id: text('task_id').notNull(),
  author_type: text('author_type').notNull().default('user'),
  body: text('body').notNull(),
  resolves_blocker: integer('resolves_blocker').notNull().default(0),
  marks_done: integer('marks_done').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});
