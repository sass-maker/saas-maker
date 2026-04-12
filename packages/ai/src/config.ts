import type { AIConfig } from './types';

const DEFAULT_CONFIG: AIConfig = { endpointUrl: '', apiKey: '', model: '' };

function normalize(config: AIConfig): AIConfig {
  return {
    endpointUrl: config.endpointUrl.trim().replace(/\/+$/, ''),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
  };
}

export function getAIConfig(storageKey = 'ai-config'): AIConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    // corrupt data
  }
  return DEFAULT_CONFIG;
}

export function saveAIConfig(config: AIConfig, storageKey = 'ai-config'): void {
  localStorage.setItem(storageKey, JSON.stringify(normalize(config)));
}
