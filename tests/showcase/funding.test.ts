import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  FUNDING,
  FUNDING_DOCS,
  FUNDING_FIELD_GROUPS,
  FUNDING_PROGRAMS,
  FUNDING_VIEW_ORDER,
  FUNDING_VIEWS,
  field,
} from '../../apps/showcase/src/data/funding';
import { PUBLIC_ROUTES } from '../../apps/showcase/src/data/publicRoutes';

const programSlugs = new Set(FUNDING_PROGRAMS.map((program) => program.slug));

async function readShowcase(relativePath: string) {
  return readFile(new URL(`../../apps/showcase/${relativePath}`, import.meta.url), 'utf8');
}

describe('SaaS Maker funding directory', () => {
  it('imports the complete program set with unique, routable slugs', () => {
    expect(FUNDING_PROGRAMS).toHaveLength(184);
    expect(programSlugs.size).toBe(184);
    for (const program of FUNDING_PROGRAMS) {
      expect(program.name).toBeTruthy();
      expect(program.slug).toMatch(/^[a-z0-9-]+$/);
      expect(field(program, 'Category')).toBeTruthy();
    }
  });

  it('reproduces the workspace decision views faithfully', () => {
    expect(FUNDING_VIEWS).toHaveLength(16);
    const labels = FUNDING_VIEWS.map((view) => view.label);
    expect(labels).toContain('Current Shortlist');
    expect(labels).toContain('Archive, Dead & Unresolved');
    for (const view of FUNDING_VIEWS) {
      expect(FUNDING_VIEW_ORDER[view.key]).toHaveLength(view.slugs.length);
      for (const slug of view.slugs) expect(programSlugs.has(slug)).toBe(true);
    }
    // Union of all views must cover every program — nothing orphaned.
    const covered = new Set(FUNDING_VIEWS.flatMap((view) => view.slugs));
    expect(covered.size).toBe(184);
  });

  it('groups every schema field into a detail-page pane or the header', () => {
    const headerFields = new Set(['Program', 'Organization', 'Official URL', 'Category']);
    const grouped = new Set(FUNDING_FIELD_GROUPS.flatMap((group) => group.fields));
    const schemaNames = Object.values(FUNDING.schema).map((prop) => prop.name);
    for (const name of schemaNames) {
      expect(grouped.has(name) || headerFields.has(name), `ungrouped field: ${name}`).toBe(true);
    }
  });

  it('keeps private contact data and internal Notion references out of the public export', () => {
    const serialized = JSON.stringify(FUNDING.programs);
    expect(serialized).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(serialized).not.toMatch(/notion\.com/);
    expect(serialized).not.toMatch(/notion\.so/);
  });

  it('registers the directory, docs, and records as public routes with markdown', () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);
    expect(paths).toContain('/funding');
    for (const doc of FUNDING_DOCS) {
      expect(paths).toContain(`/funding/docs/${doc.slug}`);
      const route = PUBLIC_ROUTES.find((entry) => entry.path === `/funding/docs/${doc.slug}`);
      expect(route?.markdown.length).toBeGreaterThan(500);
    }
  });

  it('ships markdown mirrors for every funding doc', async () => {
    for (const doc of FUNDING_DOCS) {
      const md = await readShowcase(`src/data/funding-docs/${doc.slug}.md`);
      expect(md.length).toBeGreaterThan(500);
      expect(md).not.toMatch(/notion\.so|app\.notion\.com/);
    }
  });
});
