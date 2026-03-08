import { printOutput, type OutputFormat } from '../lib/output.js';

interface ExampleRow {
  category: string;
  command: string;
  description: string;
}

interface ExamplesOptions {
  output?: OutputFormat;
  select?: string;
  raw?: boolean;
}

const EXAMPLES: ExampleRow[] = [
  {
    category: 'Setup',
    command: 'saasmaker doctor',
    description: 'Validate auth, project link, and API connectivity',
  },
  {
    category: 'Setup',
    command: 'saasmaker login && saasmaker init',
    description: 'Authenticate and link current directory to a project',
  },
  {
    category: 'Projects',
    command: 'saasmaker projects list --output table',
    description: 'List your projects in table format',
  },
  {
    category: 'Status',
    command: 'saasmaker status --output json --raw',
    description: 'Machine-readable project feature status',
  },
  {
    category: 'Projects',
    command: 'saasmaker api GET /v1/projects --auth session',
    description: 'List projects via session auth',
  },
  {
    category: 'Feedback',
    command: 'saasmaker api GET /v1/feedback --auth project --query type=feature --output table',
    description: 'List feature feedback using project key',
  },
  {
    category: 'Feedback',
    command: 'saasmaker api POST /v1/feedback --auth project --body \'{"title":"Bug","description":"Broken CTA","submitter_email":"me@example.com","type":"bug"}\'',
    description: 'Create a feedback item',
  },
  {
    category: 'Forms',
    command: 'saasmaker api GET /v1/forms/dashboard/<projectId> --auth session --output table',
    description: 'List forms via dashboard session route',
  },
  {
    category: 'Links',
    command: 'saasmaker api POST /v1/links --auth project --body \'{"destination":"https://example.com","title":"Homepage"}\'',
    description: 'Create a short link',
  },
  {
    category: 'Raw API',
    command: 'saasmaker api GET /v1/projects --auth session',
    description: 'Call any endpoint directly',
  },
];

export function examplesCommand(options: ExamplesOptions = {}): void {
  printOutput(EXAMPLES, {
    output: options.output ?? 'table',
    select: options.select,
    raw: options.raw,
    defaultColumns: ['category', 'command', 'description'],
  });
}
