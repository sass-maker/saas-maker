import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { whoamiCommand } from './commands/whoami.js';
import { keysCommand } from './commands/keys.js';
import { projectsListCommand, projectsCreateCommand } from './commands/projects.js';
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
