import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { fetchModels } from './models';
import type { AIConfig } from './types';

export type { AIConfig } from './types';
export type { ChatMessage } from './chat';

/**
 * Create a language model from an AIConfig.
 * Wraps @ai-sdk/openai-compatible for use with AI SDK's streamText/generateText.
 */
export function createAIModel(
  config: AIConfig,
  options?: { headers?: Record<string, string>; name?: string },
): LanguageModel {
  const provider = createOpenAICompatible({
    baseURL: config.endpointUrl.trim().replace(/\/+$/, ''),
    apiKey: config.apiKey,
    name: options?.name ?? 'custom',
    headers: options?.headers,
  });
  return provider.chatModel(config.model);
}

/**
 * Framework-agnostic handler for model discovery requests.
 * Use in any server route — just pass the parsed body and return the result.
 *
 * Next.js:  return Response.json(await handleModelsRequest(await req.json()));
 * Vercel:   res.json(await handleModelsRequest(req.body));
 */
export async function handleModelsRequest(
  body: { endpointUrl: string; apiKey: string },
): Promise<{ models: string[] }> {
  const models = await fetchModels(
    body.endpointUrl ?? '',
    body.apiKey ?? '',
  );
  return { models };
}
