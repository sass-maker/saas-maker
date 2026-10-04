import { NewsletterCapture } from '../src';

export const newsletterCaptureTypeContract = (
  <NewsletterCapture
    productName="Acme"
    projectKey="pk_example"
    kind="waitlist"
    allowKindSelection
    layout="compact"
    source="acme"
    apiBaseUrl="https://api.example.com"
    privacyUrl="https://acme.example/privacy"
  />
);

// catalog-id mode: resolve the publishable key from a Fleet catalog id.
export const newsletterCaptureCatalogMode = (
  <NewsletterCapture productName="Acme" catalogId="acme" source="acme" />
);

// Both keys present: project-key takes precedence; catalog-id is ignored.
export const newsletterCaptureBothKeys = (
  <NewsletterCapture productName="Acme" projectKey="pk_example" catalogId="acme" />
);
