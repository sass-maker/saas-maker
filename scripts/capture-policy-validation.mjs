const feedbackApplicabilityValues = new Set(['applicable', 'not_applicable', 'unknown']);

export function validateFeedbackApplicability(value, projectId) {
  if (value === undefined) return;
  if (!feedbackApplicabilityValues.has(value)) {
    throw new Error(`Invalid feedback applicability: ${projectId}`);
  }
}
