import { HttpClient } from '../http';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatbotConfig {
  /** Knowledge base index ID to ground answers in. */
  indexId: string;
  /** Custom system prompt for the chatbot personality. */
  systemPrompt?: string;
  /** Number of knowledge base chunks to retrieve per query (default: 5). */
  topK?: number;
  /** Max conversation messages to send as context (default: 20). Keeps the most recent N messages. */
  maxHistory?: number;
}

export interface ChatbotResponse {
  message: ChatMessage;
  sources?: Array<{ document_id: string; chunk_content: string; score: number }>;
  usage?: { input_tokens: number; output_tokens: number };
}

export class ChatbotService {
  private conversations = new Map<string, ChatMessage[]>();

  constructor(private http: HttpClient) {}

  /**
   * Create a new conversation and return its ID.
   * Optionally provide an ID to use (e.g. a user session ID).
   */
  createConversation(id?: string): string {
    const conversationId = id || crypto.randomUUID();
    this.conversations.set(conversationId, []);
    return conversationId;
  }

  /**
   * Send a message in a conversation. Automatically includes conversation
   * history for multi-turn context and queries the knowledge base via RAG.
   */
  async send(
    conversationId: string,
    message: string,
    config: ChatbotConfig,
  ): Promise<ChatbotResponse> {
    const history = this.getHistory(conversationId);
    const maxHistory = config.maxHistory ?? 20;

    // Add the user message to history
    const userMessage: ChatMessage = { role: 'user', content: message };
    history.push(userMessage);

    // Build messages array: system prompt + trimmed history
    const recentHistory = history.slice(-maxHistory);

    const systemPrompt = config.systemPrompt ||
      'You are a helpful assistant. Answer the user\'s question based on the provided context. If the context does not contain relevant information, say so.';

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...recentHistory,
    ];

    // Call the RAG endpoint with conversation context
    const response = await this.http.request<any>('POST', '/v1/ai/rag', {
      index_id: config.indexId,
      query: message,
      system_prompt: this.buildSystemPromptWithHistory(systemPrompt, recentHistory.slice(0, -1)),
      top_k: config.topK ?? 5,
    });

    // Parse the assistant response
    const assistantContent = this.extractContent(response);
    const assistantMessage: ChatMessage = { role: 'assistant', content: assistantContent };
    history.push(assistantMessage);

    return {
      message: assistantMessage,
      sources: response.sources,
      usage: response.usage,
    };
  }

  /**
   * Send a message and get a streaming response.
   * The assistant message is added to history after the stream completes.
   * Returns a ReadableStream of text chunks.
   */
  async sendStream(
    conversationId: string,
    message: string,
    config: ChatbotConfig,
  ): Promise<{ stream: ReadableStream<string>; done: Promise<ChatbotResponse> }> {
    const history = this.getHistory(conversationId);
    const maxHistory = config.maxHistory ?? 20;

    const userMessage: ChatMessage = { role: 'user', content: message };
    history.push(userMessage);

    const recentHistory = history.slice(-maxHistory);

    const systemPrompt = config.systemPrompt ||
      'You are a helpful assistant. Answer the user\'s question based on the provided context. If the context does not contain relevant information, say so.';

    const response = await this.http.requestRaw('POST', '/v1/ai/rag', {
      index_id: config.indexId,
      query: message,
      system_prompt: this.buildSystemPromptWithHistory(systemPrompt, recentHistory.slice(0, -1)),
      top_k: config.topK ?? 5,
      stream: true,
    });

    let fullContent = '';
    const body = response.body!;
    const reader = body.getReader();
    const decoder = new TextDecoder();

    const textStream = new ReadableStream<string>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const text = decoder.decode(value, { stream: true });
        fullContent += text;
        controller.enqueue(text);
      },
    });

    const done = new Promise<ChatbotResponse>((resolve) => {
      const checkDone = () => {
        const assistantMessage: ChatMessage = { role: 'assistant', content: fullContent };
        history.push(assistantMessage);
        resolve({ message: assistantMessage });
      };
      // The stream closing triggers history update
      textStream.pipeTo(new WritableStream({
        close: checkDone,
        abort: checkDone,
      })).catch(checkDone);
    });

    return { stream: textStream, done };
  }

  /** Get the full conversation history for a conversation. */
  getHistory(conversationId: string): ChatMessage[] {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, []);
    }
    return this.conversations.get(conversationId)!;
  }

  /** Clear conversation history (start fresh while keeping the same ID). */
  clearHistory(conversationId: string): void {
    this.conversations.set(conversationId, []);
  }

  /** Delete a conversation entirely. */
  deleteConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /** List all active conversation IDs. */
  listConversations(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Export conversation history (e.g. for persistence across sessions).
   * Returns a serializable array of messages.
   */
  exportHistory(conversationId: string): ChatMessage[] {
    return [...this.getHistory(conversationId)];
  }

  /**
   * Import conversation history (e.g. restored from localStorage or a database).
   * Replaces any existing history for the conversation.
   */
  importHistory(conversationId: string, messages: ChatMessage[]): void {
    this.conversations.set(conversationId, [...messages]);
  }

  private buildSystemPromptWithHistory(systemPrompt: string, priorMessages: ChatMessage[]): string {
    if (priorMessages.length === 0) return systemPrompt;
    const historyBlock = priorMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    return `${systemPrompt}\n\nConversation so far:\n${historyBlock}`;
  }

  private extractContent(response: any): string {
    // Handle OpenAI-compatible response format
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }
    // Handle direct response string
    if (typeof response.response === 'string') {
      return response.response;
    }
    return String(response);
  }
}
