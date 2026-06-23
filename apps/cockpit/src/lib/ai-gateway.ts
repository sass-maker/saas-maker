interface SnippetInput {
  apiBaseUrl: string;
  projectKey: string;
}

export function formatTokenCount(value: number | null | undefined): string {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function formatLatency(value: number | null | undefined): string {
  return value == null ? '-' : `${value}ms`;
}

export function buildAIGatewaySnippets({ apiBaseUrl, projectKey }: SnippetInput) {
  const baseUrl = apiBaseUrl.replace(/\/+$/, '');

  return {
    curl: `curl ${baseUrl}/v1/ai/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-Project-Key: ${projectKey}" \\
  -d '{
    "messages": [
      { "role": "user", "content": "Write a launch checklist." }
    ]
  }'`,
    sdk: `import { SaaSMakerClient } from "@saas-maker/sdk";

const client = new SaaSMakerClient({
  apiKey: process.env.SAASMAKER_PROJECT_KEY!,
});

const completion = await client.ai.chatCompletions({
  messages: [{ role: "user", content: "Write a launch checklist." }],
});`,
    embeddings: `await client.ai.embeddings({
  input: "Searchable product documentation",
});`,
  };
}
