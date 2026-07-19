import {
  parseDrAdvisorAdvice,
  parseDrAdvisorRequest,
  type DrAdvisorAdvice,
  type DrAdvisorRequest,
} from '../../lib/dr-advisor';

type AdvisorEnv = {
  FREE_AI_BASE_URL?: string;
  FREE_AI_GATEWAY_API_KEY?: string;
  GATEWAY_API_KEY?: string;
};

type AdvisorContext = {
  request: Request;
  env: AdvisorEnv;
};

type GatewayResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const DEFAULT_BASE_URL = 'https://ai-gateway.sassmaker.com';
const SYSTEM_PROMPT = `You are drank's conservative Domain Rating advisor.
You receive only a domain name, its observed Ahrefs Domain Rating, and a bounded trend.
You do not have backlink counts, referring-domain data, page content, traffic, or paid Ahrefs metrics.
Never invent site-specific causes or claim you inspected the site.
Return strict JSON only: {"schemaVersion":1,"why":string,"evidenceLimit":string,"actions":[{"priority":1,"title":string,"reason":string}, ...]}.
Return 3-5 actions ordered by likely leverage. Explain the observed score/trend conditionally and make the evidence limit explicit.`;

export async function onRequestPost(context: AdvisorContext): Promise<Response> {
  const apiKey = context.env.FREE_AI_GATEWAY_API_KEY ?? context.env.GATEWAY_API_KEY;
  if (!apiKey) {
    return json(
      {
        error: 'DR Advisor is not configured. Add the server-side gateway key and retry.',
        retryable: true,
      },
      503
    );
  }

  let input: DrAdvisorRequest;
  try {
    input = parseDrAdvisorRequest(await context.request.json());
  } catch {
    return json({ error: 'A valid domain, DR, and bounded trend are required.' }, 400);
  }

  const baseUrl = (context.env.FREE_AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'auto',
        project_id: 'drank',
        stream: false,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              observed: input,
              instruction:
                'Explain only what this measurement can support, then give prioritized general actions.',
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      return json(
        {
          error:
            status === 429
              ? 'Advisor generation is rate-limited. Try again shortly.'
              : 'Advisor generation is temporarily unavailable.',
          retryable: true,
        },
        status
      );
    }

    const payload = (await response.json()) as GatewayResponse;
    const content = payload.choices?.[0]?.message?.content;
    const advice: DrAdvisorAdvice = parseDrAdvisorAdvice(content);
    return json({ advice, generatedAt: Date.now() }, 200);
  } catch (error) {
    console.error('DR Advisor generation failed', error);
    return json(
      {
        error: 'Advisor generation failed or returned invalid guidance. Your DR history is safe.',
        retryable: true,
      },
      502
    );
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
