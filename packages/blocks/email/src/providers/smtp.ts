/**
 * SMTP provider — nodemailer fallback.
 * Only loaded when smtp provider is configured.
 */

export interface SmtpConfig {
  host: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
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
  provider: 'smtp';
}

export async function sendViaSmtp(config: SmtpConfig, params: SendParams): Promise<SendResult> {
  // Dynamic import to avoid bundling nodemailer unless needed
  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port ?? 587,
    secure: config.secure ?? false,
    auth: config.auth,
  });

  const info = await transporter.sendMail({
    from: config.from,
    to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
    cc: params.cc,
    bcc: params.bcc,
  });

  return { id: info.messageId ?? crypto.randomUUID(), provider: 'smtp' };
}
