import { configureEmail, email, NewFeedbackEmail, renderEmail } from '@saas-maker/email';
import * as React from 'react';

export function initEmail(accountId: string, apiToken: string, from: string): void {
  configureEmail({ provider: 'cloudflare', accountId, apiToken, from });
}

interface SendEmailParams {
  to: string;
  projectName: string;
  feedbackTitle: string;
  feedbackType: string;
  feedbackDescription: string;
  submitterEmail: string;
  dashboardUrl: string;
}

export async function sendNewFeedbackEmail(params: SendEmailParams): Promise<void> {
  const { to, projectName, feedbackTitle, feedbackType, feedbackDescription, submitterEmail, dashboardUrl } = params;

  const { html, text } = await renderEmail(
    React.createElement(NewFeedbackEmail, {
      projectName,
      feedbackTitle,
      feedbackType,
      feedbackDescription,
      submitterEmail,
      dashboardUrl,
    })
  );

  await email.send({
    to,
    subject: `[${projectName}] New ${feedbackType}: ${feedbackTitle}`,
    html,
    text,
    project: 'api',
  });
}
