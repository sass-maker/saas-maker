const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';

export class StudioLlm {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.model = options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? console;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async chatJson(messages, { temperature = 0.7, maxTokens = 2048 } = {}) {
    if (!this.apiKey) throw new Error('studio llm is not configured');
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      throw new Error(`studio llm request failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error('studio llm response missing content');
    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`studio llm returned non-JSON content: ${content.slice(0, 200)}`);
    }
  }

  /**
   * Run an LLM generation with a mandatory deterministic fallback.
   * Returns { source: 'llm' | 'template', data } and never throws for
   * missing configuration or provider failure.
   */
  async generate({ messages, fallback, temperature, maxTokens, normalize }) {
    if (typeof fallback !== 'function') throw new Error('generate requires a fallback()');
    if (this.isConfigured()) {
      try {
        const raw = await this.chatJson(messages, { temperature, maxTokens });
        const data = normalize ? normalize(raw) : raw;
        return { source: 'llm', data };
      } catch (error) {
        this.logger.warn?.(`studio llm fell back to template: ${error.message}`);
      }
    }
    return { source: 'template', data: fallback() };
  }
}

let sharedLlm = null;

export function resolveStudioLlm(options = {}) {
  if (options.llm) return options.llm;
  if (!sharedLlm) sharedLlm = new StudioLlm(options);
  return sharedLlm;
}
