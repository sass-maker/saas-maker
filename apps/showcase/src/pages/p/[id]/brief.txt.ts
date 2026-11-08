import type { SubmissionKit } from '../../../../../../scripts/submission-kits.mjs';
import { SUBMISSION_KITS, SUBMISSION_KIT_HEADERS } from '../../../data/submissionKits';
import { submissionBrief } from '../../../../../../scripts/submission-kits.mjs';

export const prerender = true;
export function getStaticPaths() {
  return SUBMISSION_KITS.map((kit) => ({ params: { id: kit.id }, props: { kit } }));
}
export function GET({ props }: { props: { kit: SubmissionKit } }) {
  return new Response(submissionBrief(props.kit), {
    headers: { ...SUBMISSION_KIT_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
