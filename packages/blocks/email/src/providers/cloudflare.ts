/**
 * Cloudflare Email Service provider — transactional email via REST API.
 * Docs: https://developers.cloudflare.com/email-service/
 */

export interface CloudflareEmailConfig {
  accountId: string;
  apiToken: string;
  from: string;
}

export interface SendParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SendResult {
  id: string;
  provider: 'cloudflare';
}

function toArray(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export async function sendViaCloudflare(
  config: CloudflareEmailConfig,
  params: SendParams
): Promise<SendResult> {
  const body: Record<string, unknown> = {
    from: { address: config.from },
    to: toArray(params.to)!.map((address) => ({ address })),
    subject: params.subject,
  };

  if (params.html) body.html = params.html;
  if (params.text) body.text = params.text;
  if (params.replyTo) body.reply_to = { address: params.replyTo };
  if (params.cc) body.cc = toArray(params.cc)!.map((address) => ({ address }));
  if (params.bcc) body.bcc = toArray(params.bcc)!.map((address) => ({ address }));

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare Email error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { result?: { id?: string } };
  const id = data.result?.id ?? crypto.randomUUID();
  return { id, provider: 'cloudflare' };
}
