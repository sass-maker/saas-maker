import { NewsletterCapture } from '../src';

export const newsletterCaptureTypeContract = (
  <NewsletterCapture
    productName="Acme"
    projectKey="pk_example"
    kind="waitlist"
    allowKindSelection
    source="acme"
    apiBaseUrl="https://api.example.com"
    privacyUrl="https://acme.example/privacy"
  />
);
