import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession, requireApiKeyOrSession } from '../middleware/auth';
import { getDb } from '../db';

const standards = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const VALID_TYPES = ['next', 'vite', 'node'] as const;
type StandardsType = typeof VALID_TYPES[number];

const DEFAULT_ESLINT_RULES = {
  'react-hooks/set-state-in-effect': 'warn',
  'react-refresh/only-export-components': 'warn',
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-explicit-any': 'warn',
  'no-console': 'warn',
};

const DEFAULT_TSCONFIG_OPTIONS = {
  strict: true,
  skipLibCheck: true,
  noUnusedLocals: false,
  noUnusedParameters: false,
};

const DEFAULT_PRETTIER_OPTIONS = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
};

function isValidType(type: string): type is StandardsType {
  return VALID_TYPES.includes(type as StandardsType);
}

function parseStandardsRow(row: { eslint_rules: string; tsconfig_options: string; prettier_options: string; [key: string]: unknown }) {
  return {
    ...row,
    eslint_rules: JSON.parse(row.eslint_rules),
    tsconfig_options: JSON.parse(row.tsconfig_options),
    prettier_options: JSON.parse(row.prettier_options),
  };
}

// GET /v1/standards — list all standards for the logged-in user (session only)
standards.get('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DB);
  const rows = await db.getAllStandardsByOwner(userId);
  return c.json({ data: rows.map(parseStandardsRow) });
});

// GET /v1/standards/:type — get standards for a specific type (project key OR session)
standards.get('/:type', requireApiKeyOrSession, async (c) => {
  const type = c.req.param('type');
  if (!isValidType(type)) return c.json({ error: 'Invalid type. Must be one of: next, vite, node' }, 400);

  const db = getDb(c.env.DB);

  // Resolve owner: project API key -> project owner_id, session -> userId
  let ownerId: string;
  const projectId = c.get('projectId');
  if (projectId) {
    const project = await db.getProjectById(projectId);
    if (!project) return c.json({ error: 'Project not found' }, 404);
    ownerId = project.owner_id;
  } else {
    ownerId = c.get('userId')!;
  }

  let row = await db.getStandards(ownerId, type);

  // Seed defaults on first GET if no row exists yet
  if (!row) {
    row = await db.upsertStandards(
      ownerId,
      type,
      DEFAULT_ESLINT_RULES,
      DEFAULT_TSCONFIG_OPTIONS,
      DEFAULT_PRETTIER_OPTIONS,
    );
  }

  return c.json(parseStandardsRow(row));
});

// PUT /v1/standards/:type — update standards for a type (session only)
standards.put('/:type', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const type = c.req.param('type');
  if (!isValidType(type)) return c.json({ error: 'Invalid type. Must be one of: next, vite, node' }, 400);

  const body = await c.req.json() as {
    eslint_rules?: unknown;
    tsconfig_options?: unknown;
    prettier_options?: unknown;
  };

  if (body.eslint_rules !== undefined && (typeof body.eslint_rules !== 'object' || Array.isArray(body.eslint_rules) || body.eslint_rules === null)) {
    return c.json({ error: 'eslint_rules must be an object' }, 400);
  }
  if (body.tsconfig_options !== undefined && (typeof body.tsconfig_options !== 'object' || Array.isArray(body.tsconfig_options) || body.tsconfig_options === null)) {
    return c.json({ error: 'tsconfig_options must be an object' }, 400);
  }
  if (body.prettier_options !== undefined && (typeof body.prettier_options !== 'object' || Array.isArray(body.prettier_options) || body.prettier_options === null)) {
    return c.json({ error: 'prettier_options must be an object' }, 400);
  }

  const db = getDb(c.env.DB);

  // Load existing (or defaults) to merge partial updates
  const existing = await db.getStandards(userId, type);
  const currentEslint = existing ? JSON.parse(existing.eslint_rules) : DEFAULT_ESLINT_RULES;
  const currentTsconfig = existing ? JSON.parse(existing.tsconfig_options) : DEFAULT_TSCONFIG_OPTIONS;
  const currentPrettier = existing ? JSON.parse(existing.prettier_options) : DEFAULT_PRETTIER_OPTIONS;

  const updated = await db.upsertStandards(
    userId,
    type,
    body.eslint_rules !== undefined ? (body.eslint_rules as object) : currentEslint,
    body.tsconfig_options !== undefined ? (body.tsconfig_options as object) : currentTsconfig,
    body.prettier_options !== undefined ? (body.prettier_options as object) : currentPrettier,
  );

  return c.json(parseStandardsRow(updated));
});

export { standards };
