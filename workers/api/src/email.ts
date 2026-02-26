interface SendEmailParams {
  to: string;
  projectName: string;
  feedbackTitle: string;
  feedbackType: string;
  feedbackDescription: string;
  submitterEmail: string;
  dashboardUrl: string;
}

export async function sendNewFeedbackEmail(
  resendApiKey: string,
  fromEmail: string,
  params: SendEmailParams
): Promise<void> {
  const { to, projectName, feedbackTitle, feedbackType, feedbackDescription, submitterEmail, dashboardUrl } = params;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: `[${projectName}] New ${feedbackType}: ${feedbackTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>New ${feedbackType} on ${projectName}</h2>
          <p><strong>${feedbackTitle}</strong></p>
          <p>${feedbackDescription}</p>
          <p style="color: #666;">From: ${submitterEmail}</p>
          <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; background: #1464ff; color: #fff; text-decoration: none; border-radius: 8px; margin-top: 12px;">
            View in Dashboard
          </a>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.error('Resend email failed:', await response.text());
  }
}
