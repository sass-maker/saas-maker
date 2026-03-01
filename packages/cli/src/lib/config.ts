import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const GLOBAL_DIR = join(homedir(), '.saasmaker');
const GLOBAL_CONFIG = join(GLOBAL_DIR, 'config.json');
const LOCAL_CONFIG = '.saasmaker.json';

interface GlobalConfig {
  apiKey?: string;
  apiBaseUrl?: string;
}

interface LocalConfig {
  projectId: string;
  slug: string;
}

export function getGlobalConfig(): GlobalConfig {
  try {
    return JSON.parse(readFileSync(GLOBAL_CONFIG, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  writeFileSync(GLOBAL_CONFIG, JSON.stringify(config, null, 2) + '\n');
}

export function getLocalConfig(): LocalConfig | null {
  try {
    return JSON.parse(readFileSync(LOCAL_CONFIG, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveLocalConfig(config: LocalConfig): void {
  writeFileSync(LOCAL_CONFIG, JSON.stringify(config, null, 2) + '\n');
}

export function getApiKey(): string | null {
  return getGlobalConfig().apiKey ?? null;
}

export function getApiBase(): string {
  return getGlobalConfig().apiBaseUrl ?? process.env.SAASMAKER_API_URL ?? 'https://api.saasmaker.dev';
}

export function hasLocalConfig(): boolean {
  return existsSync(LOCAL_CONFIG);
}
