import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Canonical paths
const GLOBAL_DIR = join(homedir(), '.foundry');
const GLOBAL_CONFIG = join(GLOBAL_DIR, 'config.json');
const LOCAL_CONFIG = 'foundry.json';

// Legacy paths (auto-migrated on first read)
const LEGACY_GLOBAL_DIR = join(homedir(), '.saasmaker');
const LEGACY_GLOBAL_CONFIG = join(LEGACY_GLOBAL_DIR, 'config.json');
const LEGACY_LOCAL_CONFIG = '.saasmaker.json';

export interface GlobalConfig {
  apiKey?: string;
  apiBaseUrl?: string;
}

export interface LocalConfig {
  slug: string;
  projectId?: string;
  projectKey?: string;
  linked?: boolean;
}

function readJsonOrNull<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function getGlobalConfig(): GlobalConfig {
  const fresh = readJsonOrNull<GlobalConfig>(GLOBAL_CONFIG);
  if (fresh) return fresh;
  // One-shot migration from legacy ~/.saasmaker/config.json
  const legacy = readJsonOrNull<GlobalConfig>(LEGACY_GLOBAL_CONFIG);
  if (legacy) {
    mkdirSync(GLOBAL_DIR, { recursive: true });
    writeFileSync(GLOBAL_CONFIG, JSON.stringify(legacy, null, 2) + '\n');
    return legacy;
  }
  return {};
}

export function saveGlobalConfig(config: GlobalConfig): void {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  writeFileSync(GLOBAL_CONFIG, JSON.stringify(config, null, 2) + '\n');
}

export function getLocalConfig(): LocalConfig | null {
  const fresh = readJsonOrNull<LocalConfig>(LOCAL_CONFIG);
  if (fresh) return fresh;
  // Auto-migrate legacy .saasmaker.json → foundry.json
  const legacy = readJsonOrNull<LocalConfig>(LEGACY_LOCAL_CONFIG);
  if (legacy) {
    writeFileSync(LOCAL_CONFIG, JSON.stringify(legacy, null, 2) + '\n');
    try { unlinkSync(LEGACY_LOCAL_CONFIG); } catch { /* keep going */ }
    return legacy;
  }
  return null;
}

export function saveLocalConfig(config: LocalConfig): void {
  writeFileSync(LOCAL_CONFIG, JSON.stringify(config, null, 2) + '\n');
  // Clean up legacy file if it exists alongside the new one
  if (existsSync(LEGACY_LOCAL_CONFIG)) {
    try { unlinkSync(LEGACY_LOCAL_CONFIG); } catch { /* ignore */ }
  }
}

export function getApiKey(): string | null {
  return getGlobalConfig().apiKey ?? null;
}

export function getApiBase(): string {
  return (
    getGlobalConfig().apiBaseUrl
    ?? process.env.FND_API_URL
    ?? process.env.SAASMAKER_API_URL
    ?? 'https://api.sassmaker.com'
  );
}

export function hasLocalConfig(): boolean {
  return existsSync(LOCAL_CONFIG) || existsSync(LEGACY_LOCAL_CONFIG);
}

function isProjectKey(value: string): boolean {
  return value.startsWith('pk_');
}

export function getLocalProjectKey(local: LocalConfig | null = getLocalConfig()): string | null {
  if (!local) return null;
  if (local.projectKey) return local.projectKey;
  if (local.projectId && isProjectKey(local.projectId)) return local.projectId;
  return null;
}

export function getLocalProjectId(local: LocalConfig | null = getLocalConfig()): string | null {
  if (!local) return null;
  if (local.projectId && !isProjectKey(local.projectId)) return local.projectId;
  return null;
}
