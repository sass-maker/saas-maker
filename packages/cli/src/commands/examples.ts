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
    command: 'fnd doctor',
    description: 'Validate auth, project link, and API connectivity',
  },
  {
    category: 'Setup',
    command: 'fnd login && fnd init',
    description: 'Authenticate and link current directory to a project',
  },
  {
    category: 'Projects',
    command: 'fnd projects list --output table',
    description: 'List your projects in table format',
  },
  {
    category: 'Status',
    command: 'fnd status --output json --raw',
    description: 'Machine-readable project feature status',
  },
  {
    category: 'Projects',
    command: 'fnd api GET /v1/projects --auth session',
    description: 'List projects via session auth',
  },
  {
    category: 'Feedback',
    command: 'fnd api GET /v1/feedback --auth project --query type=feature --output table',
    description: 'List feature feedback using project key',
  },
  {
    category: 'Feedback',
    command:
      'fnd api POST /v1/feedback --auth project --body \'{"title":"Bug","description":"Broken CTA","submitter_email":"me@example.com","type":"bug"}\'',
    description: 'Create a feedback item',
  },
  {
    category: 'Roadmap',
    command: 'fnd api GET /v1/roadmap/by-project/<slug> --auth project --output table',
    description: 'List public roadmap items for a project',
  },
  {
    category: 'Testimonials',
    command: 'fnd api GET /v1/testimonials --auth project --output table',
    description: 'List approved testimonials for the linked project',
  },
  {
    category: 'AI Gateway',
    command:
      'fnd api PUT /v1/ai/config --auth session --query project_id=<projectId> --body \'{"ai_base_url":"https://api.openai.com/v1","ai_model":"gpt-4o-mini","ai_api_key":"sk-..."}\'',
    description: 'Configure an OpenAI-compatible BYOK provider',
  },
  {
    category: 'AI Gateway',
    command:
      'fnd api POST /v1/ai/chat/completions --auth project --body \'{"messages":[{"role":"user","content":"Write release notes"}]}\'',
    description: 'Proxy a chat completion through the linked project',
  },
  {
    category: 'Raw API',
    command: 'fnd api GET /v1/projects --auth session',
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
