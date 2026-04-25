/**
 * @saas-maker/foundry-email
 *
 * Lightweight email sending with Resend/SMTP and auto-tracing via @saas-maker/ops.
 *
 * @example
 * ```ts
 * import { configureEmail, email } from '@saas-maker/foundry-email';
 *
 * configureEmail({
 *   provider: 'resend',
 *   apiKey: env.RESEND_API_KEY,
 *   from: 'noreply@yourdomain.com',
 * });
 *
 * await email.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   template: 'Hello {{name}}, welcome to {{product}}!',
 *   data: { name: 'Sarthak', product: 'Resume Tailor' },
 * });
 * ```
 */

import { trace } from '@saas-maker/ops';
import { sendViaResend } from './providers/resend';
import { sendViaSmtp } from './providers/smtp';
import { renderTemplate } from './render';

// ── Config ────────────────────────────────────────────────────────────────────

export type EmailProvider = 'resend' | 'smtp';

export interface ResendEmailConfig {
  provider: 'resend';
  apiKey: string;
  from: string;
}

export interface SmtpEmailConfig {
  provider: 'smtp';
  host: string;
  port?: number;
  secure?: boolean;
  auth: { user: string; pass: string };
  from: string;
}

export type EmailConfig = ResendEmailConfig | SmtpEmailConfig;

let _config: EmailConfig | null = null;

export function configureEmail(config: EmailConfig): void {
  _config = config;
}

function getConfig(): EmailConfig {
  if (!_config) {
    throw new Error(
      '@saas-maker/foundry-email: call configureEmail() before sending emails'
    );
  }
  return _config;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendOptions {
  to: string | string[];
  subject: string;
  /** Raw HTML body. If template is provided, this is ignored. */
  html?: string;
  /** Plain text body. */
  text?: string;
  /** Template string with {{variable}} placeholders. Rendered with `data`. */
  template?: string;
  /** Data to interpolate into template. */
  data?: Record<string, unknown>;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  /** Project name for tracing (defaults to 'email') */
  project?: string;
}

export interface SendResult {
  id: string;
  provider: EmailProvider;
}

// ── Core send ─────────────────────────────────────────────────────────────────

async function sendOne(options: SendOptions): Promise<SendResult> {
  const config = getConfig();
  const project = options.project ?? 'email';

  // Render template if provided
  const html = options.template
    ? renderTemplate(options.template, options.data ?? {})
    : options.html;

  const params = {
    to: options.to,
    subject: options.subject,
    html,
    text: options.text,
    replyTo: options.replyTo,
    cc: options.cc,
    bcc: options.bcc,
  };

  return trace(
    'email:send',
    async () => {
      if (config.provider === 'resend') {
        return sendViaResend({ apiKey: config.apiKey, from: config.from }, params);
      }
      return sendViaSmtp(config, params);
    },
    { project, meta: { to: Array.isArray(options.to) ? options.to[0] : options.to } }
  );
}

async function sendBatch(messages: SendOptions[]): Promise<SendResult[]> {
  return Promise.all(messages.map(sendOne));
}

// ── Public API ────────────────────────────────────────────────────────────────

export const email = {
  send: sendOne,
  batch: sendBatch,
};

export { renderTemplate } from './render';
