import ora from 'ora';
import chalk from 'chalk';
import { execSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { requestApi } from '../lib/request.js';
import { readFileSync, existsSync } from 'node:fs';

interface FoundryErrorEvent {
  id: string;
  event: string;
  timestamp: string;
  message: string;
  severity: string;
  project_id: string;
  stack?: string;
}

// In a real scenario, this state might be saved to disk (.foundry/supervisor_state.json)
// to remember the last handled error across restarts.
let lastProcessedTimestamp = new Date().toISOString();

export async function fleetSuperviseCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n👁️  Foundry Factory Supervisor is ONLINE'));
  console.log(chalk.gray('Monitoring Fleet Error Feed. Press Ctrl+C to stop.\n'));

  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    log.error('No projects found in fleet. Exiting supervisor.');
    return;
  }

  // Polling loop
  setInterval(async () => {
    await checkErrorFeed(fleet);
  }, 30000); // Check every 30 seconds

  // Run initial check immediately
  await checkErrorFeed(fleet);
}

async function checkErrorFeed(fleet: any[]) {
  const spinner = ora('Checking global error feed...').start();

  try {
    // We fetch secrets from the local saas-maker .env.local to get PostHog keys
    const saasMakerPath = join(process.cwd(), 'saas-maker');
    const envPath = join(saasMakerPath, 'apps', 'cockpit', '.env.local');
    
    let posthogKey = process.env.POSTHOG_PERSONAL_API_KEY;
    let posthogProject = process.env.POSTHOG_PROJECT_ID;

    if (!posthogKey && existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf-8');
      const keyMatch = envContent.match(/POSTHOG_PERSONAL_API_KEY="?([^"\n]+)"?/);
      const projMatch = envContent.match(/POSTHOG_PROJECT_ID="?([^"\n]+)"?/);
      if (keyMatch) posthogKey = keyMatch[1];
      if (projMatch) posthogProject = projMatch[1];
    }

    if (!posthogKey || !posthogProject) {
      spinner.fail('Supervisor requires PostHog Personal API Key in apps/cockpit/.env.local');
      return;
    }

    const url = `https://us.posthog.com/api/projects/${posthogProject}/query/`;
    const query = {
      query: {
        kind: "EventsQuery",
        select: [
          "*", "event", "timestamp", "properties.message", "properties.severity", "properties.foundry_project_id", "properties.$exception_stack"
        ],
        where: [`event == 'foundry_error'`, `timestamp > '${lastProcessedTimestamp}'`],
        orderBy: ["timestamp ASC"], // Process oldest first
        limit: 5,
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${posthogKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) throw new Error('Failed to fetch from PostHog');

    const data = await res.json();
    const newErrors = (data.results || []).map((row: any[]) => ({
      id: row[0].id,
      event: row[1],
      timestamp: row[2],
      message: row[3],
      severity: row[4],
      project_id: row[5],
      stack: row[6],
    })) as FoundryErrorEvent[];

    if (newErrors.length === 0) {
      spinner.stop();
      return;
    }

    spinner.warn(`Detected ${newErrors.length} new fleet errors!`);

    for (const error of newErrors) {
      await dispatchAgent(error, fleet);
      lastProcessedTimestamp = error.timestamp;
    }

  } catch (err) {
    spinner.fail(`Supervisor check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function dispatchAgent(error: FoundryErrorEvent, fleet: any[]) {
  console.log(chalk.bgRed.white(`\n 🚨 INCIDENT DETECTED: ${error.project_id || 'Unknown Project'} `));
  console.log(chalk.red(`Message: ${error.message}`));
  
  const targetProject = fleet.find(p => p.slug === error.project_id || p.name === error.project_id);
  
  if (!targetProject) {
    log.error(`Cannot dispatch agent: Project '${error.project_id}' not found in local fleet.`);
    return;
  }

  console.log(chalk.yellow(`Dispatching Autonomous Agent to ./${targetProject.slug}...`));

  // Construct the prompt using the Debugging Protocol
  const prompt = `
CRITICAL INCIDENT REPORT for project: ${targetProject.slug}

You are a Foundry Factory Agent. An error has been detected in production/dev.
Please follow the strict instructions in \`saas-maker/skills/protocol-debugging.md\`.

ERROR DETAILS:
Message: ${error.message}
Severity: ${error.severity}
Timestamp: ${error.timestamp}

STACK TRACE:
${error.stack || 'No stack trace available.'}

YOUR MISSION:
1. Navigate to the project if needed (you are starting in ${targetProject.path}).
2. Isolate the cause of the stack trace.
3. Apply the fix.
4. Commit the fix with the prefix 'fix(foundry): auto-resolved ${error.message}'.
`;

  // Write prompt to a temporary file to avoid shell escaping issues
  const promptFile = join(process.cwd(), '.fallow', `incident-${error.id}.txt`);
  if (!existsSync(join(process.cwd(), '.fallow'))) {
    execSync('mkdir -p .fallow');
  }
  writeFileSync(promptFile, prompt);

  try {
    // We launch the agent harness (Assuming Gemini CLI is available, or fallback to Claude)
    // For this environment, we will use `gemini` as the agent CLI
    console.log(chalk.cyan(`> gemini --prompt-file ${promptFile}`));
    
    // Spawn the agent process interactively so the user can see it work
    const agentProcess = spawn('gemini', ['--prompt', prompt], {
      cwd: targetProject.path,
      stdio: 'inherit',
      env: process.env
    });

    await new Promise<void>((resolve) => {
      agentProcess.on('close', (code) => {
        if (code === 0) {
          log.success(`Agent successfully resolved incident ${error.id}`);
        } else {
          log.error(`Agent failed to resolve incident ${error.id} (Exit code: ${code})`);
        }
        resolve();
      });
    });

  } catch (err) {
    log.error(`Failed to launch agent: ${err instanceof Error ? err.message : String(err)}`);
  }
}
