import { describe, expect, it } from 'vitest';
import {
  buildAIGatewaySnippets,
  formatLatency,
  formatTokenCount,
} from '../apps/cockpit/src/lib/ai-gateway';

describe('cockpit AI Gateway helpers', () => {
  it('builds snippets against the SaaS Maker gateway instead of provider URLs', () => {
    const snippets = buildAIGatewaySnippets({
      apiBaseUrl: 'https://api.sassmaker.com/',
      projectKey: 'pk_project',
    });

    expect(snippets.curl).toContain('https://api.sassmaker.com/v1/ai/chat/completions');
    expect(snippets.curl).toContain('X-Project-Key: pk_project');
    expect(snippets.curl).not.toContain('sk-');
    expect(snippets.sdk).toContain('client.ai.chatCompletions');
    expect(snippets.embeddings).toContain('client.ai.embeddings');
  });

  it('formats compact usage stats for dashboard cards', () => {
    expect(formatTokenCount(null)).toBe('0');
    expect(formatTokenCount(999)).toBe('999');
    expect(formatTokenCount(1_250)).toBe('1.3K');
    expect(formatTokenCount(1_250_000)).toBe('1.3M');
    expect(formatLatency(null)).toBe('-');
    expect(formatLatency(123)).toBe('123ms');
  });
});
