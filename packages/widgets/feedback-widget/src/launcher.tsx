import { createRoot, type Root } from 'react-dom/client';
import { FeedbackWidget } from './FeedbackWidget';

const roots = new WeakMap<HTMLElement, { root: Root; openSignal: number }>();

export interface SharedFooterFeedbackOptions {
  apiKey: string;
  pageUrl: string;
  pageTitle: string;
}

/** Mount the maintained feedback widget for the shared public footer. */
export function mountSharedFooterFeedback(
  mountPoint: HTMLElement,
  options: SharedFooterFeedbackOptions
): void {
  if (mountPoint.dataset.feedbackMounted === 'true') return;
  mountPoint.dataset.feedbackMounted = 'true';
  const root = createRoot(mountPoint);
  roots.set(mountPoint, { root, openSignal: 0 });
  root.render(
    <FeedbackWidget
      projectKey={options.apiKey}
      apiBaseUrl="https://api.sassmaker.com"
      triggerText="Feedback"
      position="bottom-right"
      enablePointing={false}
      pageContext={{ url: options.pageUrl, title: options.pageTitle }}
      requireConsent
      privacyUrl="https://sassmaker.com/privacy"
      initiallyOpen
      hideTrigger
    />
  );
}

export function openSharedFooterFeedback(
  mountPoint: HTMLElement,
  options: SharedFooterFeedbackOptions
): void {
  const mounted = roots.get(mountPoint);
  if (!mounted) {
    mountSharedFooterFeedback(mountPoint, options);
    return;
  }
  mounted.openSignal += 1;
  mounted.root.render(
    <FeedbackWidget
      projectKey={options.apiKey}
      apiBaseUrl="https://api.sassmaker.com"
      triggerText="Feedback"
      position="bottom-right"
      enablePointing={false}
      pageContext={{ url: options.pageUrl, title: options.pageTitle }}
      requireConsent
      privacyUrl="https://sassmaker.com/privacy"
      hideTrigger
      openSignal={mounted.openSignal}
    />
  );
}

export function unmountSharedFooterFeedback(mountPoint: HTMLElement): void {
  const mounted = roots.get(mountPoint);
  if (!mounted) return;
  roots.delete(mountPoint);
  mounted.root.unmount();
}
