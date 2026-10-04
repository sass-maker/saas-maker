import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { DIRECTORY_PROJECTS, directoryFormFamilies } from '../../apps/showcase/src/data/directory';
import { GET as getProjectStripScript } from '../../apps/showcase/src/pages/project-strip.js';

async function readRepository(relativePath: string) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

// Execute the page's real client script against a small synthetic directory.
async function directoryHarness(groups = ['current', 'current', 'current', 'past']) {
  class Element {
    hidden = false;
    value = '';
    textContent = '';
    dataset: Record<string, string> = {};
    attributes: Record<string, string> = {};
    listeners: Record<string, () => void> = {};
    focused = false;
    children: Element[] = [];
    count?: Element;
    addEventListener(event: string, listener: () => void) {
      this.listeners[event] = listener;
    }
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
    focus() {
      this.focused = true;
    }
    getBoundingClientRect() {
      return { bottom: 1 };
    }
    querySelectorAll() {
      return this.children;
    }
    querySelector(selector: string) {
      return selector === '[data-directory-section-count]' ? this.count : null;
    }
    fire(event: string) {
      this.listeners[event]?.();
    }
  }
  const selectors = [
    '[data-directory-root]',
    '[data-directory-controls]',
    '[data-directory-filter-return]',
    '[data-filter-return-count]',
    '[data-filter-return-label]',
    '#directory-search',
    '#directory-form',
    '#directory-platform',
    '#directory-result-count',
    '#directory-reset',
    '[data-directory-empty]',
    '[data-empty-reset]',
  ];
  const elements = Object.fromEntries(selectors.map((selector) => [selector, new Element()]));
  const rows = groups.map((group, index) => {
    const row = new Element();
    row.dataset = {
      group,
      form: index === 1 ? 'CLI' : 'Web|Library',
      platforms: index === 2 ? 'macOS' : 'Web|Local',
      search: index === 3 ? 'beta archive' : 'alpha experiment',
    };
    return row;
  });
  const sections = [...new Set(groups)].map((group) => {
    const section = new Element();
    section.children = rows.filter((row) => row.dataset.group === group);
    section.count = new Element();
    section.count.textContent = `${section.children.length} projects`;
    return section;
  });
  const buttons = ['all', ...new Set(groups)].map((group) => {
    const button = new Element();
    button.dataset.groupFilter = group;
    return button;
  });
  const page = await readRepository('apps/showcase/src/pages/projects.astro');
  const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  runInNewContext(
    ts.transpileModule(script!, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    {
      document: {
        querySelector: (selector: string) => elements[selector],
        querySelectorAll: (selector: string) =>
          ({
            '[data-directory-row]': rows,
            '[data-directory-section]': sections,
            '[data-group-filter]': buttons,
          })[selector],
      },
      window: { addEventListener() {} },
    }
  );
  return { elements, rows, sections, buttons };
}

describe('directory visible counts', () => {
  it('counts the intersection of search, form, platform and lifecycle filters', async () => {
    const { elements, rows, sections, buttons } = await directoryHarness();
    elements['#directory-search'].value = '  ALPHA  ';
    elements['#directory-search'].fire('input');
    expect(sections[0].count?.textContent).toBe('3 projects');
    expect(sections[1].hidden).toBe(true);
    elements['#directory-form'].value = 'Web';
    elements['#directory-form'].fire('change');
    expect(sections[0].count?.textContent).toBe('2 projects of 3 total');
    elements['#directory-platform'].value = 'Web';
    elements['#directory-platform'].fire('change');
    buttons[1].fire('click');

    expect(rows.map((row) => row.hidden)).toEqual([false, true, true, true]);
    expect(sections[0].count?.textContent).toBe('1 project of 3 total');
    expect(sections[1].count?.textContent).toBe('0 projects of 1 total');
    expect(elements['#directory-result-count'].textContent).toBe('Showing 1 project of 4 total');
    expect(elements['[data-filter-return-count]'].textContent).toBe('1');
    expect(elements['[data-filter-return-label]'].textContent).toBe('result');
    expect(elements['[data-directory-empty]'].hidden).toBe(true);

    buttons[0].fire('click');
    elements['#directory-search'].value = '';
    elements['#directory-search'].fire('input');
    expect(elements['#directory-result-count'].textContent).toBe('Showing 2 projects of 4 total');
    expect(sections[1].hidden).toBe(false);
    buttons[1].fire('click');
    expect(elements['#directory-result-count'].textContent).toBe('Showing 1 project of 4 total');
    expect(sections[1].hidden).toBe(true);
  });

  it.each([
    '#directory-reset',
    '[data-empty-reset]',
  ])('clears zero results through %s', async (reset) => {
    const { elements, rows, sections, buttons } = await directoryHarness();
    elements['#directory-search'].value = 'missing';
    elements['#directory-form'].value = 'CLI';
    elements['#directory-platform'].value = 'macOS';
    buttons[2].fire('click');
    expect(elements['#directory-result-count'].textContent).toBe('Showing 0 projects of 4 total');
    expect(elements['[data-filter-return-label]'].textContent).toBe('results');
    expect(elements['[data-directory-root]'].hidden).toBe(true);
    expect(elements['[data-directory-empty]'].hidden).toBe(false);
    expect(sections.every((section) => section.hidden)).toBe(true);
    expect(sections[0].count?.textContent).toBe('0 projects of 3 total');

    elements[reset].fire('click');
    expect(rows.every((row) => !row.hidden)).toBe(true);
    expect(sections.every((section) => !section.hidden)).toBe(true);
    expect(sections.map((section) => section.count?.textContent)).toEqual([
      '3 projects',
      '1 project',
    ]);
    expect(elements['#directory-result-count'].textContent).toBe('Showing all 4 projects');
    expect(elements['[data-filter-return-count]'].textContent).toBe('4');
    expect(elements['[data-directory-root]'].hidden).toBe(false);
    expect(elements['[data-directory-empty]'].hidden).toBe(true);
    for (const selector of ['#directory-search', '#directory-form', '#directory-platform']) {
      expect(elements[selector].value).toBe('');
    }
    expect(buttons.map((button) => button.attributes['aria-pressed'])).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(elements['#directory-search'].focused).toBe(true);
  });

  it('uses singular labels when the complete directory has one project', async () => {
    const { elements, sections } = await directoryHarness(['current']);
    elements['#directory-reset'].fire('click');
    expect(elements['#directory-result-count'].textContent).toBe('Showing all 1 project');
    expect(sections[0].count?.textContent).toBe('1 project');
    expect(elements['[data-filter-return-label]'].textContent).toBe('result');
  });
});

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
      url: 'https://storage.daddyrad.com/',
    });
    // StorageDaddy is intentionally MIT open-source: its public repository
    // link is shareable anatomy, not private state.
    expect(storagedaddy).toMatchObject({
      repositoryUrl: 'https://github.com/Significant-Hobbies/storagedaddy',
      roadmapUrl: 'https://github.com/Significant-Hobbies/storagedaddy/issues',
    });
    expect(storagedaddy).not.toHaveProperty('changelogUrl');
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'web-playables')
    ).toMatchObject({ lifecycle: 'active', shareable: true, group: 'current' });
    const rolepatch = catalog.directory.find(
      (project: { id: string }) => project.id === 'rolepatch'
    );
    expect(rolepatch).toMatchObject({ lifecycle: 'active', shareable: true, group: 'current' });
    expect(rolepatch.description).toContain('guest resume-tailoring experiment');
    expect(rolepatch.purposeContract.proof).toContain(
      'Account sync and broader application tools remain unqualified'
    );
    expect(ids).not.toContain('chess');
    expect(ids).not.toContain('journal');
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'nomad-data-adventure')
    ).toMatchObject({
      lifecycle: 'active',
      category: 'experimental',
      url: 'https://nomad.significanthobbies.com/',
    });
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'ph-catalog')
    ).toMatchObject({
      lifecycle: 'active',
      category: 'experimental',
      group: 'current',
      deployed: true,
      url: 'https://ph.significanthobbies.com',
      repositoryUrl: 'https://github.com/sarthakagrawal927/ph-catalog',
    });
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
    expect(page).toContain('data-directory-section-count');
    expect(page).toContain("total {DIRECTORY_COUNT === 1 ? 'project' : 'projects'}");
    expect(page).toMatch(/Shareable does not mean finished/);
    expect(data).toMatch(/publicCatalog\.directory/);
    expect(nav).toMatch(/href="\/projects"/);
    expect(routes).toMatch(/path: '\/projects'/);
    expect(jsonRoute).toMatch(/JSON\.stringify\(directoryProjects\)/);
  });

  it('revalidates the shared project strip catalog', async () => {
    const response = getProjectStripScript();
    const script = await response.text();

    expect(response.headers.get('content-type')).toContain('text/javascript');
    expect(script).toMatch(/fetch\(catalogUrl,\s*\{/);
    expect(script).toMatch(/accept:\s*["']application\/json["']/);
    expect(script).toMatch(/cache:\s*["']no-cache["']/);
    expect(script).not.toMatch(/cache:\s*["']force-cache["']/);
  });

  it('keeps established web identities discoverable through the public form families', () => {
    for (const projectId of ['starboard', 'on-record', 'research-papers']) {
      const project = DIRECTORY_PROJECTS.find((candidate) => candidate.id === projectId);
      expect(project).toBeDefined();
      expect(directoryFormFamilies(project!)).toContain('Web');
    }
  });
});
