import { SUBMISSION_KITS, SUBMISSION_KIT_HEADERS } from '../data/submissionKits';

export const prerender = true;
export function GET() {
  return new Response(
    `${JSON.stringify({ $schema: 'fleet.product-submission-kits.v1', kits: SUBMISSION_KITS }, null, 2)}\n`,
    { headers: SUBMISSION_KIT_HEADERS }
  );
}
