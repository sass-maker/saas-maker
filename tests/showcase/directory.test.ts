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
    const projectedIds = [...catalog.products, ...catalog.pastProjects].map(
      (project: { id: string }) => project.id
    );

    expect(catalog.schemaVersion).toBe(5);
    expect(new Set(ids).size).toBe(catalog.directory.length);
    expect(ids.toSorted()).toEqual(projectedIds.toSorted());
    expect(Object.values(counts).reduce((total, count) => total + count, 0)).toBe(
      catalog.directory.length
    );
    for (const project of catalog.directory) {
      expect(project.group).toBe(
        project.lifecycle === 'primary'
          ? 'featured'
          : project.lifecycle === 'inactive'
            ? 'past'
            : 'current'
      );
    }
    const storagedaddy = catalog.directory.find(
      (project: { id: string }) => project.id === 'storagedaddy'
    );
    expect(storagedaddy).toMatchObject({
      lifecycle: 'active',
      shareable: true,
      category: 'utility',
      group: 'current',
      form: 'macOS app',
      url: 'https://storagedaddy.significanthobbies.com/',
    });
    expect(storagedaddy).not.toHaveProperty('repositoryUrl');
    expect(storagedaddy).not.toHaveProperty('roadmapUrl');
    expect(storagedaddy).not.toHaveProperty('changelogUrl');
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'web-playables')
    ).toMatchObject({ lifecycle: 'inactive', shareable: true, group: 'past' });
    const rolepatch = catalog.directory.find(
      (project: { id: string }) => project.id === 'rolepatch'
    );
    expect(rolepatch).toMatchObject({ lifecycle: 'inactive', shareable: true, group: 'past' });
    expect(rolepatch.description).toContain('guest resume-tailoring experiment');
    expect(rolepatch.purposeContract.proof).toContain(
      'Account sync and broader application tools remain unqualified'
    );
    expect(ids).not.toContain('chess');
    expect(ids).not.toContain('journal');
    expect(ids).not.toContain('nomad-data-adventure');
    for (const heldId of [
      'psi-swarm',
      'everythingrated',
      'veg-protein-food',
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
      catalog.directory.find((project: { id: string }) => project.id === 'chatgpt-memory-insights')
        .description
    ).toContain('browser-local experiment');

    for (const project of catalog.directory) {
      expect(project.shareable).toBe(true);
      expect(project.name).toBeTruthy();
      expect(project.description).toBeTruthy();
      expect(project.makerNote.trim()).not.toBe('');
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

  it('revalidates the shared project strip catalog', async () => {
    const script = await readRepository('apps/showcase/src/pages/project-strip.js.ts');

    expect(script).toMatch(
      /fetch\(CATALOG_URL, \{ headers: \{ accept: 'application\/json' \}, cache: 'no-cache'/
    );
    expect(script).not.toContain("cache: 'force-cache'");
  });

  it('keeps established web identities discoverable through the public form families', () => {
    for (const projectId of ['starboard', 'on-record', 'research-papers']) {
      const project = DIRECTORY_PROJECTS.find((candidate) => candidate.id === projectId);
      expect(project).toBeDefined();
      expect(directoryFormFamilies(project!)).toContain('Web');
    }
  });
});
