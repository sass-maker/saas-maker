import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { whoamiCommand } from './commands/whoami.js';
import { keysCommand } from './commands/keys.js';
import { projectsListCommand, projectsCreateCommand, projectsDeleteCommand, projectsUpdateCommand } from './commands/projects.js';
import { feedbackListCommand, feedbackUpdateCommand, feedbackDeleteCommand } from './commands/feedback.js';
import { roadmapListCommand, roadmapCreateCommand, roadmapUpdateCommand, roadmapDeleteCommand } from './commands/roadmap.js';
import { changelogListCommand, changelogCreateCommand, changelogUpdateCommand, changelogDeleteCommand } from './commands/changelog.js';
import { testimonialsListCommand, testimonialsUpdateCommand, testimonialsDeleteCommand } from './commands/testimonials.js';
import { analyticsDashboardCommand, analyticsDetailCommand } from './commands/analytics.js';
import { formsListCommand, formsCreateCommand, formsGetCommand, formsDeleteCommand, formsResponsesCommand, formsAnalyticsCommand } from './commands/forms.js';
import { waitlistListCommand, waitlistCountCommand, waitlistDeleteCommand } from './commands/waitlist.js';
import { aiMentionConfigCommand, aiMentionPromptsCommand, aiMentionPromptsAddCommand, aiMentionCheckCommand, aiMentionHistoryCommand } from './commands/ai-mention.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { apiCommand } from './commands/api.js';
import { doctorCommand } from './commands/doctor.js';
import { completionsCommand } from './commands/completions.js';
import { examplesCommand } from './commands/examples.js';

const program = new Command();

program
  .name('saasmaker')
  .description('SaaS Maker CLI — manage your projects')
  .version('0.1.0');

program.command('login').description('Login via browser OAuth').action(loginCommand);
program.command('whoami').description('Show current auth status').action(whoamiCommand);
program.command('keys').description('Show API key for current project').action(keysCommand);

// --- Projects ---
const projects = program.command('projects').description('Manage projects');
projects
  .command('list')
  .description('List all projects')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields, e.g. id,name,slug')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(projectsListCommand);
projects
  .command('create')
  .description('Create a new project')
  .option('--name <name>', 'Project name (skip prompt)')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(projectsCreateCommand);
projects
  .command('delete')
  .description('Delete a project')
  .option('--id <id>', 'Project ID (skip prompt)')
  .option('--force', 'Skip confirmation')
  .action(projectsDeleteCommand);
projects
  .command('update')
  .description('Update a project')
  .option('--id <id>', 'Project ID (skip prompt)')
  .option('--name <name>', 'New project name')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(projectsUpdateCommand);

// --- Feedback ---
const feedback = program.command('feedback').description('Manage feedback inbox');
feedback
  .command('list')
  .description('List feedback for a project')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(feedbackListCommand);
feedback
  .command('update <id>')
  .description('Update feedback status')
  .option('--status <status>', 'New status: open, planned, in_progress, done, closed')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(feedbackUpdateCommand);
feedback
  .command('delete <id>')
  .description('Delete feedback entry')
  .action(feedbackDeleteCommand);

// --- Roadmap ---
const roadmap = program.command('roadmap').description('Manage roadmap items');
roadmap
  .command('list')
  .description('List roadmap items')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(roadmapListCommand);
roadmap
  .command('create')
  .description('Create a roadmap item')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--title <title>', 'Item title (skip prompt)')
  .option('--description <desc>', 'Item description')
  .option('--status <status>', 'Status: planned, in_progress, done, backlog', 'planned')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(roadmapCreateCommand);
roadmap
  .command('update <id>')
  .description('Update a roadmap item')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--title <title>', 'New title')
  .option('--description <desc>', 'New description')
  .option('--status <status>', 'New status: planned, in_progress, done, backlog')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(roadmapUpdateCommand);
roadmap
  .command('delete <id>')
  .description('Delete a roadmap item')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .action(roadmapDeleteCommand);

// --- Changelog ---
const changelog = program.command('changelog').description('Manage changelog entries');
changelog
  .command('list')
  .description('List changelog entries')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(changelogListCommand);
changelog
  .command('create')
  .description('Create a changelog entry')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--title <title>', 'Entry title (skip prompt)')
  .option('--content <content>', 'Entry content (markdown)')
  .option('--status <status>', 'Status: draft, published', 'draft')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(changelogCreateCommand);
changelog
  .command('update <id>')
  .description('Update a changelog entry')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--title <title>', 'New title')
  .option('--content <content>', 'New content')
  .option('--status <status>', 'New status: draft, published')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(changelogUpdateCommand);
changelog
  .command('delete <id>')
  .description('Delete a changelog entry')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .action(changelogDeleteCommand);

// --- Testimonials ---
const testimonials = program.command('testimonials').description('Manage testimonials');
testimonials
  .command('list')
  .description('List testimonials')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(testimonialsListCommand);
testimonials
  .command('update <id>')
  .description('Update testimonial status')
  .option('--status <status>', 'New status: approved, rejected, pending')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(testimonialsUpdateCommand);
testimonials
  .command('delete <id>')
  .description('Delete a testimonial')
  .action(testimonialsDeleteCommand);

// --- Analytics ---
const analytics = program.command('analytics').description('View analytics');
analytics
  .command('dashboard')
  .description('Get full analytics dashboard')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--period <period>', 'Time period: today, 7d, 30d, 90d, all', '30d')
  .option('--include-bots', 'Include bot traffic')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(analyticsDashboardCommand);
analytics
  .command('detail <section>')
  .description('Drill down into analytics section (pages, referrers, countries, devices, browsers, os, events, bots)')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--period <period>', 'Time period: today, 7d, 30d, 90d, all', '30d')
  .option('--limit <n>', 'Results per page', '50')
  .option('--offset <n>', 'Offset for pagination', '0')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(analyticsDetailCommand);

// --- Forms ---
const forms = program.command('forms').description('Manage forms/surveys');
forms
  .command('list')
  .description('List forms')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(formsListCommand);
forms
  .command('create')
  .description('Create a form')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--title <title>', 'Form title (skip prompt)')
  .option('--slug <slug>', 'URL slug (auto-generated from title)')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(formsCreateCommand);
forms
  .command('get <formId>')
  .description('Get form details with questions')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(formsGetCommand);
forms
  .command('delete <formId>')
  .description('Delete a form')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .action(formsDeleteCommand);
forms
  .command('responses <formId>')
  .description('List form responses')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--page <n>', 'Page number')
  .option('--limit <n>', 'Results per page')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(formsResponsesCommand);
forms
  .command('analytics <formId>')
  .description('View form analytics')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(formsAnalyticsCommand);

// --- Waitlist ---
const waitlist = program.command('waitlist').description('Manage waitlist');
waitlist
  .command('list')
  .description('List waitlist entries')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(waitlistListCommand);
waitlist
  .command('count')
  .description('Get waitlist count')
  .action(waitlistCountCommand);
waitlist
  .command('delete <id>')
  .description('Delete a waitlist entry')
  .action(waitlistDeleteCommand);

// --- AI Mention ---
const aiMentionCmd = program.command('ai-mention').description('AI mention check');
aiMentionCmd
  .command('config')
  .description('Show AI mention config')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(aiMentionConfigCommand);
aiMentionCmd
  .command('prompts')
  .description('List saved prompts')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'table')
  .option('--raw', 'Print compact JSON')
  .action(aiMentionPromptsCommand);
aiMentionCmd
  .command('prompts-add')
  .description('Add a prompt')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--text <text>', 'Prompt text (skip prompt)')
  .option('--category <category>', 'Prompt category')
  .option('--output <format>', 'table | json', 'json')
  .option('--raw', 'Print compact JSON')
  .action(aiMentionPromptsAddCommand);
aiMentionCmd
  .command('check')
  .description('Run an AI mention check')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'table')
  .option('--raw', 'Print compact JSON')
  .action(aiMentionCheckCommand);
aiMentionCmd
  .command('history')
  .description('List past checks')
  .option('--project <id>', 'Project ID (or use saasmaker init)')
  .option('--output <format>', 'table | json', 'table')
  .option('--raw', 'Print compact JSON')
  .action(aiMentionHistoryCommand);

// --- Utility ---
program.command('init').description('Link a project to this directory').action(initCommand);
program
  .command('status')
  .description('Show project stats')
  .option('--output <format>', 'table | json', 'table')
  .option('--select <fields>', 'Comma-separated fields')
  .option('--quiet', 'Reduce non-data logs')
  .option('--raw', 'Print compact JSON')
  .action(statusCommand);

program
  .command('doctor')
  .description('Validate CLI auth, project link, and API access')
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
