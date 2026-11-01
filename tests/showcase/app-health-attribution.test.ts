import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { appHealthEventProperties } from '../../apps/showcase/src/data/app-health-attribution';

async function readShowcase(relativePath: string) {
  return readFile(new URL(`../../apps/showcase/${relativePath}`, import.meta.url), 'utf8');
}

describe('bounded App Health CTA attribution', () => {
  it('marks ordinary and ambiguous traffic as unknown without copying query data', () => {
    expect(appHealthEventProperties('?note=PRIVATE_VALUE', 'project_directory', [])).toEqual({
      traffic_class: 'unknown',
      destination_id: 'project_directory',
    });
    expect(
      appHealthEventProperties('?fleet_qa=1&fleet_internal=1&token=PRIVATE_VALUE', null, [])
    ).toEqual({ traffic_class: 'unknown' });
    expect(appHealthEventProperties('?fleet_qa=1&fleet_qa=1', null, [])).toEqual({
      traffic_class: 'unknown',
    });
  });

  it('accepts only one explicit QA or internal marker and a curated public destination', () => {
    expect(appHealthEventProperties('?fleet_qa=1', 'project-one', ['project-one'])).toEqual({
      traffic_class: 'qa',
      destination_id: 'project-one',
    });
    expect(appHealthEventProperties('?fleet_internal=1', 'feedback_docs', [])).toEqual({
      traffic_class: 'internal',
      destination_id: 'feedback_docs',
    });
    expect(appHealthEventProperties('', 'https://private.example/path', [])).toEqual({
      traffic_class: 'unknown',
    });
    expect(
      JSON.stringify(appHealthEventProperties('?q=PRIVATE_VALUE', 'project_directory', []))
    ).not.toContain('PRIVATE_VALUE');
    expect(appHealthEventProperties('', 'not-in-server-allowlist', ['project-one'])).toEqual({
      traffic_class: 'unknown',
    });
  });

  it('sends bounded destinations through the existing click tracker', async () => {
    const [layout, hero, spec] = await Promise.all([
      readShowcase('src/layouts/Layout.astro'),
      readShowcase('src/components/Hero.astro'),
      readShowcase('src/components/Spec.astro'),
    ]);

    expect(layout).toMatch(/appHealth\.track\(\s*name,\s*appHealthEventProperties/);
    expect(layout).toContain('flushForNavigation?: () => Promise<boolean>');
    expect(layout).toContain('if (accepted) navigate();');
    expect(layout).toContain('window.setTimeout(navigate, 800);');
    expect(layout).toContain('data-app-health-project-ids={appHealthProjectIds}');
    expect(layout).toContain("CORE.map(({ id }) => id).join(',')");
    expect(hero).toContain('data-app-health-destination="project_directory"');
    expect(hero).toContain('data-app-health-destination={project.id}');
    expect(spec).toContain('data-app-health-destination="feedback_docs"');

    const helper = await readShowcase('src/data/app-health-attribution.ts');
    expect(helper).not.toContain("from './projects'");
  });
});
