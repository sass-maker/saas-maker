import type { SubmissionKit } from '../../../../../../scripts/submission-kits.mjs';
import { SUBMISSION_KITS, SUBMISSION_KIT_HEADERS } from '../../../data/submissionKits';

export const prerender = true;
export function getStaticPaths() {
  return SUBMISSION_KITS.map((kit) => ({ params: { id: kit.id }, props: { kit } }));
}
export function GET({ props }: { props: { kit: SubmissionKit } }) {
  return new Response(`${JSON.stringify(props.kit, null, 2)}\n`, {
    headers: SUBMISSION_KIT_HEADERS,
  });
}
