/**
 * @saas-maker/email
 *
 * Lightweight email sending with Cloudflare/Resend/SMTP and auto-tracing via @saas-maker/ops.
 * Templates are React components rendered via @react-email/render.
 *
 * @example
 * ```tsx
 * import { configureEmail, email } from '@saas-maker/email';
 * import { NewFeedbackEmail } from '@saas-maker/email/templates';
 * import { renderEmail } from '@saas-maker/email';
 * import * as React from 'react';
 *
 * configureEmail({
 *   provider: 'cloudflare',
 *   accountId: env.CF_ACCOUNT_ID,
 *   apiToken: env.CF_EMAIL_API_TOKEN,
 *   from: 'noreply@yourdomain.com',
 * });
 *
 * const { html, text } = await renderEmail(
 *   <NewFeedbackEmail projectName="Acme" feedbackTitle="Bug" ... />
 * );
 * await email.send({ to: 'user@example.com', subject: 'New feedback', html, text });
 * ```
 */

import { trace } from '@saas-maker/ops';
import { sendViaCloudflare } from './providers/cloudflare';
import { sendViaResend } from './providers/resend';
import { sendViaSmtp } from './providers/smtp';

// ── Config ────────────────────────────────────────────────────────────────────

export type EmailProvider = 'cloudflare' | 'resend' | 'smtp';

export interface CloudflareEmailConfig {
  provider: 'cloudflare';
  accountId: string;
  apiToken: string;
  from: string;
}

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

export type EmailConfig = CloudflareEmailConfig | ResendEmailConfig | SmtpEmailConfig;

let _config: EmailConfig | null = null;

export function configureEmail(config: EmailConfig): void {
  _config = config;
}

function getConfig(): EmailConfig {
  if (!_config) {
    throw new Error(
      '@saas-maker/email: call configureEmail() before sending emails'
    );
  }
  return _config;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
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

  const params = {
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
    cc: options.cc,
    bcc: options.bcc,
  };

  return trace(
    `email:send:${project}`,
    async () => {
      if (config.provider === 'cloudflare') {
        return sendViaCloudflare(config, params);
      }
      if (config.provider === 'resend') {
        return sendViaResend({ apiKey: config.apiKey, from: config.from }, params);
      }
      return sendViaSmtp(config, params);
    },
    { context: { to: Array.isArray(options.to) ? options.to[0] : options.to } }
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

export { renderEmail } from './render';
export { NewFeedbackEmail } from './templates/NewFeedback';
export type { NewFeedbackEmailProps } from './templates/NewFeedback';
export { WaitlistSignupEmail } from './templates/WaitlistSignup';
export type { WaitlistSignupEmailProps } from './templates/WaitlistSignup';
