import { type ComponentType, createElement } from 'react';
import './element';
import type { NewsletterCaptureProps } from './types';

type NativeCaptureProps = {
  'product-name': string;
  'project-key': string;
  kind?: string;
  'allow-kind-selection'?: string;
  source?: string;
  'api-base-url'?: string;
  'privacy-url'?: string;
  label?: string;
  theme?: 'light' | 'dark';
  class?: string;
};

const NewsletterCaptureElement =
  'saas-maker-newsletter-capture' as unknown as ComponentType<NativeCaptureProps>;

export function NewsletterCapture(props: NewsletterCaptureProps) {
  return createElement(NewsletterCaptureElement, {
    'product-name': props.productName,
    'project-key': props.projectKey,
    kind: props.kind,
    'allow-kind-selection': props.allowKindSelection ? '' : undefined,
    source: props.source,
    'api-base-url': props.apiBaseUrl,
    'privacy-url': props.privacyUrl,
    label: props.label,
    theme: props.theme,
    class: props.className,
  });
}
