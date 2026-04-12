import { useState, useCallback } from 'react';
import type { AIConfig } from '../types';
import { getAIConfig, saveAIConfig } from '../config';

export function useAIConfig(storageKey = 'ai-config') {
  const [config, setConfigState] = useState<AIConfig>(() => getAIConfig(storageKey));

  const setConfig = useCallback(
    (next: AIConfig | ((prev: AIConfig) => AIConfig)) => {
      setConfigState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        return resolved;
      });
    },
    [],
  );

  const update = useCallback(
    (partial: Partial<AIConfig>) => {
      setConfigState((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const save = useCallback(() => {
    setConfigState((current) => {
      saveAIConfig(current, storageKey);
      return current;
    });
  }, [storageKey]);

  const isReady = !!(config.endpointUrl && config.apiKey);

  return { config, setConfig, update, save, isReady };
}
