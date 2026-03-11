import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatbotService } from '../../packages/sdk/src/services/chatbot';

function createMockHttp() {
  return {
    request: vi.fn(),
    requestRaw: vi.fn(),
  } as any;
}

describe('ChatbotService', () => {
  let chatbot: ChatbotService;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    chatbot = new ChatbotService(http);
  });

  describe('createConversation', () => {
    it('creates a conversation with auto-generated ID', () => {
      const id = chatbot.createConversation();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('creates a conversation with custom ID', () => {
      const id = chatbot.createConversation('my-session');
      expect(id).toBe('my-session');
    });

    it('initializes empty history', () => {
      const id = chatbot.createConversation('test');
      expect(chatbot.getHistory(id)).toEqual([]);
    });
  });

  describe('send', () => {
    it('sends a message and stores both user and assistant messages in history', async () => {
      http.request.mockResolvedValue({
        response: 'SaasMaker is a backend-as-a-service platform.',
        sources: [{ document_id: 'doc1', chunk_content: 'some content', score: 0.9 }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const convoId = chatbot.createConversation('test');
      const result = await chatbot.send(convoId, 'What is SaasMaker?', {
        indexId: 'idx_abc',
      });

      expect(result.message.role).toBe('assistant');
      expect(result.message.content).toBe('SaasMaker is a backend-as-a-service platform.');
      expect(result.sources).toHaveLength(1);
      expect(result.usage?.input_tokens).toBe(100);

      const history = chatbot.getHistory(convoId);
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'What is SaasMaker?' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'SaasMaker is a backend-as-a-service platform.' });
    });

    it('includes conversation history in system prompt for multi-turn', async () => {
      http.request.mockResolvedValue({ response: 'Answer 1' });

      const convoId = chatbot.createConversation('multi');
      await chatbot.send(convoId, 'First question', { indexId: 'idx_abc' });

      http.request.mockResolvedValue({ response: 'Answer 2' });
      await chatbot.send(convoId, 'Follow-up question', { indexId: 'idx_abc' });

      // Second call should include prior conversation in system_prompt
      const secondCall = http.request.mock.calls[1][2];
      expect(secondCall.system_prompt).toContain('user: First question');
      expect(secondCall.system_prompt).toContain('assistant: Answer 1');
    });

    it('respects maxHistory to trim old messages', async () => {
      http.request.mockResolvedValue({ response: 'Reply' });

      const convoId = chatbot.createConversation('trim');

      for (let i = 0; i < 5; i++) {
        await chatbot.send(convoId, `Message ${i}`, { indexId: 'idx_abc', maxHistory: 2 });
      }

      // The last API call should only include the 2 most recent messages in the system prompt history
      const lastCall = http.request.mock.calls[4][2];
      expect(lastCall.system_prompt).not.toContain('Message 0');
    });

    it('uses custom system prompt', async () => {
      http.request.mockResolvedValue({ response: 'Custom reply' });

      const convoId = chatbot.createConversation('custom');
      await chatbot.send(convoId, 'Hello', {
        indexId: 'idx_abc',
        systemPrompt: 'You are a pirate assistant.',
      });

      const call = http.request.mock.calls[0][2];
      expect(call.system_prompt).toContain('You are a pirate assistant.');
    });

    it('passes topK to the RAG endpoint', async () => {
      http.request.mockResolvedValue({ response: 'ok' });

      const convoId = chatbot.createConversation('topk');
      await chatbot.send(convoId, 'Hello', { indexId: 'idx_abc', topK: 10 });

      expect(http.request.mock.calls[0][2].top_k).toBe(10);
    });

    it('handles OpenAI-compatible response format', async () => {
      http.request.mockResolvedValue({
        choices: [{ message: { content: 'OpenAI format response' } }],
      });

      const convoId = chatbot.createConversation('openai');
      const result = await chatbot.send(convoId, 'Hi', { indexId: 'idx_abc' });

      expect(result.message.content).toBe('OpenAI format response');
    });
  });

  describe('conversation management', () => {
    it('lists all active conversations', () => {
      chatbot.createConversation('a');
      chatbot.createConversation('b');
      chatbot.createConversation('c');

      expect(chatbot.listConversations()).toEqual(['a', 'b', 'c']);
    });

    it('clears conversation history', async () => {
      http.request.mockResolvedValue({ response: 'hi' });

      const id = chatbot.createConversation('clear');
      await chatbot.send(id, 'hello', { indexId: 'idx_abc' });
      expect(chatbot.getHistory(id)).toHaveLength(2);

      chatbot.clearHistory(id);
      expect(chatbot.getHistory(id)).toEqual([]);
    });

    it('deletes a conversation', () => {
      chatbot.createConversation('del');
      chatbot.deleteConversation('del');

      expect(chatbot.listConversations()).not.toContain('del');
    });

    it('auto-creates conversation on getHistory if missing', () => {
      const history = chatbot.getHistory('auto-created');
      expect(history).toEqual([]);
      expect(chatbot.listConversations()).toContain('auto-created');
    });
  });

  describe('export/import history', () => {
    it('exports a copy of the history', async () => {
      http.request.mockResolvedValue({ response: 'exported' });

      const id = chatbot.createConversation('export');
      await chatbot.send(id, 'test', { indexId: 'idx_abc' });

      const exported = chatbot.exportHistory(id);
      expect(exported).toHaveLength(2);

      // Verify it's a copy, not a reference
      exported.push({ role: 'user', content: 'extra' });
      expect(chatbot.getHistory(id)).toHaveLength(2);
    });

    it('imports history into a conversation', () => {
      const messages = [
        { role: 'user' as const, content: 'old question' },
        { role: 'assistant' as const, content: 'old answer' },
      ];

      chatbot.importHistory('restored', messages);
      expect(chatbot.getHistory('restored')).toHaveLength(2);
      expect(chatbot.getHistory('restored')[0].content).toBe('old question');
    });

    it('imported history is independent of source array', () => {
      const messages = [{ role: 'user' as const, content: 'test' }];
      chatbot.importHistory('independent', messages);

      messages.push({ role: 'assistant' as const, content: 'mutated' });
      expect(chatbot.getHistory('independent')).toHaveLength(1);
    });
  });
});
