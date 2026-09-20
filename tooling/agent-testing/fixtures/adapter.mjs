const action = process.argv[2];

if (action === 'workflow') {
  console.log('fixture workflow output is intentionally not retained');
  console.log(
    `FLEET_AGENT_TEST_RESULT=${JSON.stringify({
      metrics: {
        observationMs: 4,
        modelMs: 7,
        controlMs: 3,
        applicationWaitMs: 5,
        verificationMs: 2,
        modelCalls: 1,
        inputTokens: 10,
        outputTokens: 5,
        seededDefectsDetected: 0,
        seededDefectsMissed: 0,
        falseAlarms: 0,
        retries: 0,
        manualInterventions: 0,
      },
      artifacts: ['evidence/checkpoint.png'],
    })}`,
  );
} else if (action === 'verify-good') {
  process.exitCode = 0;
} else if (action === 'verify-broken') {
  process.exitCode = 7;
} else if (action === 'invalid-counter') {
  console.log('FLEET_AGENT_TEST_RESULT={"metrics":{"modelCalls":0.5}}');
} else if (action === 'hang') {
  setInterval(() => {}, 1_000);
} else {
  process.exitCode = 2;
}
