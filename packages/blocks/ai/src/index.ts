// Types
export type { AIConfig } from './types';
export type { ChatMessage, ChatCompletionOptions } from './chat';
export type { AISettingsProps, AISettingsClassNames } from './components/AISettings';

// Config (localStorage)
export { getAIConfig, saveAIConfig } from './config';

// Model discovery (works in any runtime)
export { fetchModels } from './models';

// Chat completions — raw fetch (works in any runtime including Workers)
export { fetchChatCompletion, parseSSEStream, buildChatUrl } from './chat';

// React hooks
export { useAIConfig } from './hooks/useAIConfig';
export { useModelDiscovery } from './hooks/useModelDiscovery';

// React component
export { AISettings } from './components/AISettings';
