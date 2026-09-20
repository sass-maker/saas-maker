function finite(values) {
  return values.filter(Number.isFinite);
}

export function median(values) {
  const sorted = finite(values).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function observedP95(values) {
  const sorted = finite(values).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)];
}

function sumMetric(runs, key) {
  return runs.reduce((sum, run) => sum + (Number.isFinite(run.metrics?.[key]) ? run.metrics[key] : 0), 0);
}

const timingMetricKeys = [
  'setupMs',
  'resetMs',
  'readinessMs',
  'observationMs',
  'modelMs',
  'controlMs',
  'applicationWaitMs',
  'controlAndApplicationWaitMs',
  'verificationMs',
  'unassignedMs',
];

function summarizeGroup(runs, expected) {
  const passed = runs.filter((run) => run.status === 'passed');
  const phaseNames = [...new Set(passed.flatMap((run) => Object.keys(run.phases)))];
  return {
    expected,
    attempts: runs.length,
    passed: passed.length,
    incorrect: runs.filter((run) => run.status === 'incorrect').length,
    failed: runs.filter((run) => run.status === 'failed').length,
    timedOut: runs.filter((run) => run.status === 'timed_out').length,
    medianMs: median(passed.map((run) => run.totalMs)),
    observedP95Ms: observedP95(passed.map((run) => run.totalMs)),
    attemptMedianMs: median(runs.map((run) => run.totalMs)),
    phaseMedianMs: Object.fromEntries(
      phaseNames.map((name) => [name, median(passed.map((run) => run.phases[name]?.durationMs))]),
    ),
    metricMedianMs: Object.fromEntries(
      timingMetricKeys.map((name) => [name, median(passed.map((run) => run.metrics?.[name]))]),
    ),
    modelCalls: sumMetric(runs, 'modelCalls'),
    inputTokens: sumMetric(runs, 'inputTokens'),
    outputTokens: sumMetric(runs, 'outputTokens'),
    imageInputs: sumMetric(runs, 'imageInputs'),
    apiSpendUsd: sumMetric(runs, 'apiSpendUsd'),
    subscriptionUnits: sumMetric(runs, 'subscriptionUnits'),
    seededDefectsDetected: sumMetric(runs, 'seededDefectsDetected'),
    seededDefectsMissed: sumMetric(runs, 'seededDefectsMissed'),
    falseAlarms: sumMetric(runs, 'falseAlarms'),
    retries: sumMetric(runs, 'retries'),
    manualInterventions: sumMetric(runs, 'manualInterventions'),
  };
}

export function summarizeReceipt(receipt) {
  const warmRuns = receipt.runs.filter((run) => run.temperature === 'warm');
  const coldRuns = receipt.runs.filter((run) => run.temperature === 'cold');
  const warm = summarizeGroup(warmRuns, receipt.benchmark.runs.warm);
  const cold = summarizeGroup(coldRuns, receipt.benchmark.runs.cold);
  const attempted = warm.attempts + cold.attempts;
  const passed = warm.passed + cold.passed;
  const manualInterventions = warm.manualInterventions + cold.manualInterventions;
  const reasons = [];
  if (receipt.setup && receipt.setup.status !== 'passed') reasons.push('setup did not pass');
  if (receipt.teardown && receipt.teardown.status !== 'passed') reasons.push('teardown did not pass');
  if (attempted !== receipt.benchmark.runs.warm + receipt.benchmark.runs.cold) {
    reasons.push('not all configured runs executed');
  }
  if (passed !== attempted) reasons.push('one or more runs did not pass independent verification');
  if (manualInterventions > 0) reasons.push('manual intervention was required');
  return {
    schemaVersion: 'fleet.agent-testing.summary.v1',
    benchmark: receipt.benchmark,
    warm,
    cold,
    qualification: {
      status: reasons.length === 0 ? 'qualified' : 'not-qualified',
      reasons,
    },
    note: 'Observed p95 is the maximum for samples smaller than 20 and is not a population tail estimate.',
  };
}
