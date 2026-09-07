import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DIRECTORY_PROJECTS, directoryFormFamilies } from '../../apps/showcase/src/data/directory';

async function readRepository(relativePath: string) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('verified public Fleet directory', () => {
  it('projects only shareable identities with privacy-safe anatomy', async () => {
    const catalog = JSON.parse(await readRepository('catalog/generated/public.json'));
    const ids = catalog.directory.map((project: { id: string }) => project.id);
    const counts = (catalog.directory as Array<{ group: string }>).reduce<Record<string, number>>(
      (result, project) => {
        result[project.group] = (result[project.group] ?? 0) + 1;
        return result;
      },
      {}
    );

    expect(catalog.schemaVersion).toBe(5);
    expect(catalog.directory).toHaveLength(21);
    expect(new Set(ids).size).toBe(21);
    expect(counts.current).toBe(4);
    expect(counts.featured).toBe(1);
    expect(counts.past).toBe(16);
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'web-playables')
    ).toMatchObject({ lifecycle: 'inactive', shareable: true, group: 'past' });
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'psi-swarm')
    ).toMatchObject({
      lifecycle: 'inactive',
      shareable: true,
      group: 'past',
      description: expect.stringContaining('Source-installed local Lighthouse'),
    });
    expect(ids).not.toContain('chess');
    expect(ids).not.toContain('journal');
    expect(ids).not.toContain('nomad-data-adventure');
    for (const heldId of [
      'reel-pipeline',
      'forecast-lab',
      'companion-robot',
      'ai-game',
      'open-historia',
      'motion',
      'truehire',
      'mobile-dev-cockpit',
    ]) {
      expect(ids).not.toContain(heldId);
    }
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'everythingrated')
        .purposeContract.proof
    ).toContain('early opinions, not benchmarks or consensus');
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'chatgpt-memory-insights')
        .description
    ).toContain('browser-local experiment');

    for (const project of catalog.directory) {
      expect(project.shareable).toBe(true);
      expect(project.name).toBeTruthy();
      expect(project.description).toBeTruthy();
      expect(project.makerNote).toMatch(/\b(?:I|me|my)\b/);
      expect(project.form).toBeTruthy();
      expect(project.platforms.length).toBeGreaterThan(0);
      expect(project.technologies.length).toBeGreaterThan(0);
      if (project.id !== 'ios-landings') {
        expect(Object.keys(project.purposeContract).sort()).toEqual([
          'audience',
          'mechanism',
          'nextAction',
          'outcome',
          'proof',
          'purpose',
        ]);
      }
      expect(JSON.stringify(project)).not.toMatch(
        /(?:sourcePath|cfProject|credential|password|private repository|\/Users\/)/i
      );
    }
  });

  it('renders a server-first directory with accessible filters and evidence links', async () => {
    const [page, data, nav, routes, jsonRoute] = await Promise.all([
      readRepository('apps/showcase/src/pages/projects.astro'),
      readRepository('apps/showcase/src/data/directory.ts'),
      readRepository('apps/showcase/src/components/Nav.astro'),
      readRepository('apps/showcase/src/data/publicRoutes.ts'),
      readRepository('apps/showcase/src/pages/projects.json.ts'),
    ]);

    expect(page).toMatch(/data-directory-row/);
    expect(page).toMatch(/<details/);
    expect(page).toMatch(/<summary class="directory-summary" aria-label=/);
    expect(page).toMatch(/Search name, purpose, stack, or domain/);
    expect(page).toMatch(/First retained commit/);
    expect(page).toMatch(/Latest retained commit/);
    expect(page).toMatch(/Prominent tools/);
    expect(page).toMatch(/data-directory-filter-return/);
    expect(page).toMatch(/Shareable does not mean finished/);
    expect(data).toMatch(/publicCatalog\.directory/);
    expect(nav).toMatch(/href="\/projects"/);
    expect(routes).toMatch(/path: '\/projects'/);
    expect(jsonRoute).toMatch(/JSON\.stringify\(directoryProjects\)/);
  });

  it('keeps established web identities discoverable through the public form families', () => {
    for (const projectId of ['starboard', 'veg-protein-food', 'research-papers']) {
      const project = DIRECTORY_PROJECTS.find((candidate) => candidate.id === projectId);
      expect(project).toBeDefined();
      expect(directoryFormFamilies(project!)).toContain('Web');
    }
  });
});
