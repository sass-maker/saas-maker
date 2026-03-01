import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { whoamiCommand } from './commands/whoami.js';
import { keysCommand } from './commands/keys.js';
import { projectsListCommand, projectsCreateCommand } from './commands/projects.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('saasmaker')
  .description('SaaS Maker CLI — manage your projects')
  .version('0.1.0');

program.command('login').description('Save your API key').action(loginCommand);
program.command('whoami').description('Show current auth status').action(whoamiCommand);
program.command('keys').description('Show API key for current project').action(keysCommand);

const projects = program.command('projects').description('Manage projects');
projects.command('list').description('List all projects').action(projectsListCommand);
projects.command('create').description('Create a new project').action(projectsCreateCommand);

program.command('init').description('Link a project to this directory').action(initCommand);
program.command('status').description('Show project stats').action(statusCommand);

program.parse();
