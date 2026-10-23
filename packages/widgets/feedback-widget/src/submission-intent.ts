import type { FeedbackSubmission } from './types';

/** Keep retries together while letting an edited form or another submission be new. */
export function createSubmissionIntent() {
  let previous: { fields: string; screenshot?: File; id: string } | undefined;
  return {
    identify(submission: FeedbackSubmission) {
      const { screenshot, ...fields } = submission;
      delete fields.submissionId;
      const serialized = JSON.stringify(fields);
      if (!previous || previous.fields !== serialized || previous.screenshot !== screenshot) {
        previous = { fields: serialized, screenshot, id: crypto.randomUUID() };
      }
      return previous.id;
    },
    reset() {
      previous = undefined;
    },
  };
}
