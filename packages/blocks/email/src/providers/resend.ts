/**
 * Resend provider — primary email provider.
 * Uses the Resend REST API directly (no SDK dependency).
 */

export interface ResendConfig {
  apiKey: string;
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
  provider: 'resend';
}

export async function sendViaResend(config: ResendConfig, params: SendParams): Promise<SendResult> {
  const body: Record<string, unknown> = {
    from: config.from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
  };

  if (params.html) body.html = params.html;
  if (params.text) body.text = params.text;
  if (params.replyTo) body.reply_to = params.replyTo;
  if (params.cc) body.cc = Array.isArray(params.cc) ? params.cc : [params.cc];
  if (params.bcc) body.bcc = Array.isArray(params.bcc) ? params.bcc : [params.bcc];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return { id: data.id, provider: 'resend' };
}
