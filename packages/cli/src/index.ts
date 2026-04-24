import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { whoamiCommand } from './commands/whoami.js';
import { keysCommand } from './commands/keys.js';
import { projectsListCommand, projectsCreateCommand, projectsDeleteCommand, projectsUpdateCommand } from './commands/projects.js';
import { fleetListCommand, fleetRunCommand, fleetUpgradeCommand, fleetAuditCommand, fleetFixCommand } from './commands/fleet.js';
import { feedbackListCommand, feedbackUpdateCommand, feedbackDeleteCommand } from './commands/feedback.js';
import { roadmapListCommand, roadmapCreateCommand, roadmapUpdateCommand, roadmapDeleteCommand } from './commands/roadmap.js';
import { changelogListCommand, changelogCreateCommand, changelogUpdateCommand, changelogDeleteCommand } from './commands/changelog.js';
import { testimonialsListCommand, testimonialsUpdateCommand, testimonialsDeleteCommand } from './commands/testimonials.js';
import { analyticsDashboardCommand, analyticsDetailCommand, analyticsSetupCommand } from './commands/analytics.js';
import { formsListCommand, formsCreateCommand, formsGetCommand, formsDeleteCommand, formsResponsesCommand, formsAnalyticsCommand } from './commands/forms.js';
import { waitlistListCommand, waitlistCountCommand, waitlistDeleteCommand } from './commands/waitlist.js';
import { aiMentionConfigCommand, aiMentionPromptsCommand, aiMentionPromptsAddCommand, aiMentionCheckCommand, aiMentionHistoryCommand } from './commands/ai-mention.js';
import { initCommand } from './commands/init.js';
import { forgeCommand } from './commands/forge.js';
import { statusCommand } from './commands/status.js';
import { apiCommand } from './commands/api.js';
import { doctorCommand } from './commands/doctor.js';
import { completionsCommand } from './commands/completions.js';
import { examplesCommand } from './commands/examples.js';

const program = new Command();

program
  .name('foundry')
  .alias('fnd')
  .description('Foundry CLI — manage your project fleet and standards')
  .version('1.0.0');

program.command('login').description('Login to the Foundry Cockpit').action(loginCommand);
program.command('whoami').description('Show current auth status').action(whoamiCommand);
program.command('keys').description('Show API keys for the linked block').action(keysCommand);

// --- Fleet Management ---
const fleet = program.command('fleet').description('Manage your project fleet');
fleet.command('list').description('List all projects in your fleet').action(fleetListCommand);
fleet
  .command('run <command>')
  .description('Run a shell command across the entire fleet')
  .option('--type <type>', 'next | vite | node')
  .option('--parallel', 'Run concurrently despite failures')
  .action(fleetRunCommand);
fleet.command('audit').description('Audit all fleet projects for Foundry compliance').action(fleetAuditCommand);
fleet.command('fix').description('Auto-fix compliance issues across the fleet').action(fleetFixCommand);
fleet.command('upgrade').description('Upgrade all projects to Foundry Standards').action(fleetUpgradeCommand);

// --- Blocks & Widgets ---
program.command('feedback').description('Manage the Feedback block').action(feedbackListCommand);
program.command('roadmap').description('Manage the Roadmap block').action(roadmapListCommand);
program.command('changelog').description('Manage the Changelog block').action(changelogListCommand);
program.command('testimonials').description('Manage the Testimonials block').action(testimonialsListCommand);

const analytics = program.command('analytics').description('Manage the Analytics block');
analytics.command('dashboard').description('View analytics dashboard').action(analyticsDashboardCommand);
analytics.command('setup').description('Automate PostHog integration').action(analyticsSetupCommand);
analytics.command('detail <section>').description('Drill down into analytics').action(analyticsDetailCommand);

program.command('forms').description('Manage the Forms block').action(formsListCommand);
program.command('waitlist').description('Manage the Waitlist block').action(waitlistListCommand);
program.command('ai').description('Manage the AI block').action(aiMentionConfigCommand);

// --- Forge & Commander Utils ---
program
  .command('init')
  .description('Forge a Foundry link in this directory')
  .option('--offline', 'Apply standards locally without linking to fleet (use when auth is unavailable)')
  .action((opts) => initCommand({ offline: opts.offline }));
program
  .command('forge')
  .description('Forge a new Foundry-compliant project from scratch')
  .option('--name <name>', 'Project name')
  .option('--type <type>', 'next | vite | node')
  .action(forgeCommand);

program
  .command('status')
  .description('Show fleet-wide project stats')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(statusCommand);

program
  .command('audit')
  .description('Validate Foundry Standard compliance')
  .alias('doctor')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--raw', 'Print compact JSON')
  .action(doctorCommand);

program
  .command('examples')
  .description('Show practical command examples')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--raw', 'Print compact JSON')
  .action(examplesCommand);

program
  .command('completions [shell]')
  .description('Print shell completion script (bash | zsh | fish)')
  .action(completionsCommand);

program
  .command('api <method> <path>')
  .description('Call any API route (control all website features from CLI)')
  .option('-a, --auth <mode>', 'Auth mode: auto | session | project | none', 'auto')
  .option('-b, --body <json>', 'Raw JSON body string')
  .option('--body-file <path>', 'Read JSON body from file')
  .option('-q, --query <key=value>', 'Add query params', (value, prev: string[] = []) => [...prev, value], [])
  .option('-H, --header <key=value>', 'Add custom headers', (value, prev: string[] = []) => [...prev, value], [])
  .option('--token <token>', 'Override saved session token')
  .option('--project-key <key>', 'Override local project API key')
  .option('--output <format>', 'table | json', 'json')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--no-validate', 'Skip OpenAPI route validation')
  .option('--raw', 'Print compact JSON')
  .action(apiCommand);

program.parse();
