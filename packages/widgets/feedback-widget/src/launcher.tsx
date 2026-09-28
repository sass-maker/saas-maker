import { createRoot } from 'react-dom/client';
import { FeedbackWidget } from './FeedbackWidget';

export interface SharedFooterFeedbackOptions {
  apiKey: string;
  pageUrl: string;
  pageTitle: string;
}

/** Mount the maintained feedback widget for the shared public footer. */
export function mountSharedFooterFeedback(
  host: HTMLElement,
  options: SharedFooterFeedbackOptions
): void {
  if (host.dataset.feedbackMounted === 'true') return;
  host.dataset.feedbackMounted = 'true';
  createRoot(host).render(
    <FeedbackWidget
      projectKey={options.apiKey}
      apiBaseUrl="https://api.sassmaker.com"
      triggerText="Feedback"
      position="bottom-right"
      enablePointing={false}
      pageContext={{ url: options.pageUrl, title: options.pageTitle }}
      requireConsent
      privacyUrl="https://sassmaker.com/privacy"
    />
  );
}
