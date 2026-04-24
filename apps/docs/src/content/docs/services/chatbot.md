---
title: Chatbot
description: Build AI chatbots grounded in your knowledge base with multi-turn conversation support.
---

Build conversational AI chatbots powered by RAG (Retrieval-Augmented Generation). The chatbot service combines the AI Gateway with Knowledge Base to create assistants that answer questions using your own data.

## How It Works

The chatbot is a **client-side SDK service** that manages conversation state and calls the RAG endpoint under the hood. Each message:

1. Adds the user message to conversation history
2. Queries your knowledge base for relevant context
3. Sends the context + conversation history to the LLM
4. Returns the assistant response with source citations

## Quick Start

```typescript
import { SaaSMakerClient } from '@foundry/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// Create a conversation
const conversationId = client.chatbot.createConversation();

// Send a message
const response = await client.chatbot.send(conversationId, 'How do I reset my password?', {
  indexId: 'your-knowledge-base-index-id',
  systemPrompt: 'You are a helpful support agent for Acme Corp.',
});

console.log(response.message.content);
// "To reset your password, go to Settings > Security > Reset Password..."

console.log(response.sources);
// [{ document_id: "...", chunk_content: "...", score: 0.92 }]
```

## Configuration

```typescript
interface ChatbotConfig {
  /** Knowledge base index ID to ground answers in (required). */
  indexId: string;
  /** Custom system prompt for the chatbot personality. */
  systemPrompt?: string;
  /** Number of knowledge base chunks to retrieve per query (default: 5). */
  topK?: number;
  /** Max conversation messages to send as context (default: 20). */
  maxHistory?: number;
}
```

## Streaming Responses

```typescript
const { stream, done } = await client.chatbot.sendStream(
  conversationId,
  'Explain your pricing plans',
  { indexId: 'your-index-id' }
);

// Read the stream
const reader = stream.getReader();
while (true) {
  const { done: streamDone, value } = await reader.read();
  if (streamDone) break;
  process.stdout.write(value); // Print chunks as they arrive
}

// Get the final response (includes sources)
const finalResponse = await done;
```

## Conversation Management

```typescript
// Create with a custom ID (e.g., user session)
const id = client.chatbot.createConversation('user-123-session');

// Get conversation history
const history = client.chatbot.getHistory(id);

// Clear history (keep conversation ID)
client.chatbot.clearHistory(id);

// Delete conversation entirely
client.chatbot.deleteConversation(id);

// List all active conversations
const conversations = client.chatbot.listConversations();
```

## Persisting Conversations

The chatbot stores conversations in memory. To persist across page reloads or server restarts:

```typescript
// Export to save
const messages = client.chatbot.exportHistory(conversationId);
localStorage.setItem('chat-history', JSON.stringify(messages));

// Import to restore
const saved = JSON.parse(localStorage.getItem('chat-history') || '[]');
client.chatbot.importHistory(conversationId, saved);
```

## Prerequisites

Before using the chatbot, you need:

1. **AI Gateway configured** — Set up an AI provider in your project's AI settings
2. **Knowledge Base index** — Create an index and upload documents via the Knowledge Base service
3. **API key** — Your project's `pk_` API key

See [AI Gateway](/services/ai-gateway) and [Knowledge Base](/services/knowledge-base) for setup instructions.
