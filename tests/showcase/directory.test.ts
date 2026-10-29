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
async function directoryHarness(
  groups = ['current', 'current', 'current', 'past'],
  collectionIndexes: number[] = []
) {
  class Element {
    hidden = false;
    value = '';
    textContent = '';
    dataset: Record<string, string> = {};
    attributes: Record<string, string> = {};
    listeners: Record<string, () => void> = {};
    focused = false;
    bounds = { top: 0, bottom: 1 };
    scrollOptions?: { behavior: string; block: string };
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
      return this.bounds;
    }
    scrollIntoView(options: { behavior: string; block: string }) {
      this.scrollOptions = options;
    }
    querySelectorAll() {
      return this.children;
    }
    querySelector(selector: string) {
      return ['[data-directory-section-count]', '[data-collection-count]'].includes(selector)
        ? this.count
        : null;
    }
    fire(event: string) {
      this.listeners[event]?.();
    }
  }
  const selectors = [
    '[data-directory-root]',
    '[data-directory-controls]',
    'studio-footer',
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
  elements['studio-footer'].bounds = { top: 1200, bottom: 1600 };
  const windowListeners: Record<string, () => void> = {};
  const window = {
    innerHeight: 800,
    addEventListener(event: string, listener: () => void) {
      windowListeners[event] = listener;
    },
    matchMedia: () => ({ matches: true }),
    setTimeout(callback: () => void) {
      callback();
    },
  };
  const rows = groups.map((group, index) => {
    const row = new Element();
    row.dataset = {
      group,
      form: index === 1 ? 'CLI' : 'Web|Library',
      platforms: index === 2 ? 'macOS' : 'Web|Local',
      search: index === 3 ? 'beta archive' : 'alpha experiment',
    };
    if (collectionIndexes.includes(index)) {
      row.dataset.collection = 'daddyrad';
      row.dataset.search += ' daddyrad native mac utilities';
    }
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
  const collections = collectionIndexes.length ? [new Element()] : [];
  if (collections[0]) {
    collections[0].dataset.directoryCollection = 'daddyrad';
    collections[0].count = new Element();
    collections[0].count.textContent = `${collectionIndexes.length} apps`;
  }
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
            '[data-directory-collection]': collections,
          })[selector],
      },
      window,
    }
  );
  return {
    elements,
    rows,
    sections,
    buttons,
    collections,
    window,
    fireWindow: (event: string) => windowListeners[event]?.(),
  };
}

describe('directory visible counts', () => {
  it('filters family members without counting the collection heading and hides an empty family', async () => {
    const { elements, rows, collections } = await directoryHarness(undefined, [0, 2]);
    elements['#directory-search'].value = 'DaddyRad';
    elements['#directory-search'].fire('input');
    expect(rows.map((row) => row.hidden)).toEqual([false, true, false, true]);
    expect(elements['#directory-result-count'].textContent).toBe('Showing 2 projects of 4 total');
    expect(collections[0].count?.textContent).toBe('2 apps');
    elements['#directory-platform'].value = 'macOS';
    elements['#directory-platform'].fire('change');
    expect(collections[0].hidden).toBe(false);
    expect(collections[0].count?.textContent).toBe('1 of 2 apps');
    expect(elements['#directory-result-count'].textContent).toBe('Showing 1 project of 4 total');
    elements['#directory-search'].value = 'missing';
    elements['#directory-search'].fire('input');
    expect(collections[0].hidden).toBe(true);
    elements['#directory-reset'].fire('click');
    expect(collections[0].hidden).toBe(false);
    expect(collections[0].count?.textContent).toBe('2 apps');
    expect(elements['#directory-result-count'].textContent).toBe('Showing all 4 projects');
  });
  it('keeps Filters useful through the list and clears the footer on scroll, resize and filtering', async () => {
    const { elements, window, fireWindow } = await directoryHarness();
    const controls = elements['[data-directory-controls]'];
    const footer = elements['studio-footer'];
    const returnButton = elements['[data-directory-filter-return]'];
    expect(returnButton.hidden).toBe(true);

    controls.bounds = { top: -200, bottom: -20 };
    fireWindow('scroll');
    expect(returnButton.hidden).toBe(false);
    returnButton.fire('click');
    expect(controls.scrollOptions).toEqual({ behavior: 'auto', block: 'start' });
    expect(elements['#directory-search'].focused).toBe(true);

    footer.bounds = { top: 799, bottom: 1200 };
    fireWindow('scroll');
    expect(returnButton.hidden).toBe(true);
    footer.bounds.top = 800;
    fireWindow('scroll');
    expect(returnButton.hidden).toBe(false);
    window.innerHeight = 1000;
    fireWindow('resize');
    expect(returnButton.hidden).toBe(true);

    footer.bounds = { top: 1200, bottom: 1600 };
    window.innerHeight = 800;
    fireWindow('scroll');
    expect(returnButton.hidden).toBe(false);
    footer.bounds = { top: 400, bottom: 1000 };
    elements['#directory-search'].value = 'alpha';
    elements['#directory-search'].fire('input');
    expect(returnButton.hidden).toBe(true);
  });

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
  it('projects the complete current roster with privacy-safe anatomy', async () => {
    const catalog = JSON.parse(await readRepository('catalog/generated/public.json'));
    const ids = catalog.directory.map((project: { id: string }) => project.id);
    expect(ids).not.toContain('on-record');
    const counts = (catalog.directory as Array<{ group: string }>).reduce<Record<string, number>>(
      (result, project) => {
        result[project.group] = (result[project.group] ?? 0) + 1;
        return result;
      },
      {}
    );
    expect(catalog.schemaVersion).toBe(6);
    expect(ids).toHaveLength(38);
    expect(ids).not.toContain('significanthobbies');
    expect(new Set(ids).size).toBe(catalog.directory.length);
    const archivedIds = catalog.archivedDirectory.map((project: { id: string }) => project.id);
    expect(archivedIds).toHaveLength(41);
    expect(archivedIds).toEqual(
      expect.arrayContaining(['significanthobbies', 'chatgpt-connections', 'unified-portfolio'])
    );
    expect(ids).toContain('domain-inbox');
    for (const id of ['chatgpt-connections', 'unified-portfolio']) {
      expect(ids).not.toContain(id);
      const archived = catalog.archivedDirectory.find(
        (project: { id: string }) => project.id === id
      );
      expect(archived).toMatchObject({ roster: 'archived', availability: 'archived' });
      expect(archived).not.toHaveProperty('publicUrl');
    }
    const saasMaker = catalog.directory.find(
      (project: { id: string }) => project.id === 'saas-maker'
    );
    expect(saasMaker.technologies).toContain('MCP');
    expect(saasMaker.purposeContract.mechanism).toContain('Shared read-only MCP connections');
    expect(saasMaker.purposeContract.proof).toContain('apps/mcp');
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'domain-inbox')
    ).toMatchObject({ name: 'Fleet Mail', roster: 'current', availability: 'internal-private' });
    expect(new Set([...ids, ...archivedIds]).size).toBe(ids.length + archivedIds.length);
    expect(
      catalog.directory.every((project: { roster: string }) => project.roster === 'current')
    ).toBe(true);
    expect(
      catalog.archivedDirectory.every(
        (project: { roster: string; availability: string }) =>
          project.roster === 'archived' && project.availability === 'archived'
      )
    ).toBe(true);
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
    });
    expect(storagedaddy.url).toBe(storagedaddy.publicUrl);
    expect(storagedaddy.domains[0]).toBe('storage.daddyrad.com');
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
    // These retained source components are grouped under TechData instead of
    // being published as four separate Fleet products.
    for (const componentId of [
      'research-papers',
      'ph-catalog',
      'reddit-insights',
      'nomad-data-adventure',
    ]) {
      expect(ids).not.toContain(componentId);
    }
    for (const heldId of [
      'psi-swarm',
      'everythingrated',
      'veg-protein-food',
      'reel-pipeline',
      'forecast-lab',
      'companion-robot',
      'open-historia',
      'truehire',
      'mobile-dev-cockpit',
    ]) {
      expect(ids).not.toContain(heldId);
    }
    expect(ids).toContain('motion');
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'motion')
    ).toMatchObject({
      availability: 'unreleased-prototype',
      publicUrl: 'https://motion.significanthobbies.com',
      publicUrlLabel: 'Landing page',
      group: 'current',
    });
    for (const id of ['site-health', 'domain-inbox', 'nutrition-formula-engine', 'fleet-social']) {
      expect(catalog.directory.find((project: { id: string }) => project.id === id)).toMatchObject({
        availability: 'internal-private',
      });
      expect(
        catalog.directory.find((project: { id: string }) => project.id === id)
      ).not.toHaveProperty('publicUrl');
    }
    for (const id of ['techdata', 'meme-lab', 'every-song-is-a-website']) {
      expect(catalog.directory.find((project: { id: string }) => project.id === id)).toMatchObject({
        availability: 'public-link',
        publicUrlLabel: 'Visit website',
      });
    }
    for (const id of ['reader', 'ai-game', 'agent-inbox']) {
      expect(catalog.directory.find((project: { id: string }) => project.id === id)).toMatchObject({
        availability: 'preview-not-qualified',
        publicUrlLabel: 'Preview site',
      });
    }
    expect(
      catalog.directory.find((project: { id: string }) => project.id === 'chatgpt-memory-insights')
        .description
    ).toContain('browser-local experiment');

    for (const project of catalog.directory) {
      if (project.availability === 'public-link') expect(project.publicUrl).toMatch(/^https:\/\//);
      expect(project.name).toBeTruthy();
      expect(project.description).toBeTruthy();
      expect(project.makerNote.trim()).not.toBe('');
      expect(project.form).toBeTruthy();
      expect(project.platforms.length).toBeGreaterThan(0);
      expect(project.technologies.length).toBeGreaterThan(0);
      if (project.purposeContract) {
        expect(Object.keys(project.purposeContract)).toEqual(
          expect.arrayContaining(['audience', 'mechanism', 'outcome', 'purpose'])
        );
        expect(
          Object.keys(project.purposeContract).every((key: string) =>
            ['purpose', 'audience', 'outcome', 'mechanism', 'proof', 'nextAction'].includes(key)
          )
        ).toBe(true);
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
    expect(page).toMatch(/Search name, purpose, or stack/);
    expect(page).toMatch(/First retained commit/);
    expect(page).toMatch(/Latest retained commit/);
    expect(page).toMatch(/Prominent tools/);
    expect(page).toMatch(/data-directory-filter-return/);
    expect(page).toContain('data-directory-section-count');
    expect(page).toContain('of ${rows.length} total');
    expect(page).toMatch(/A profile is not a public access promise/);
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
    for (const projectId of ['starboard', 'karte']) {
      const project = DIRECTORY_PROJECTS.find((candidate) => candidate.id === projectId);
      expect(project).toBeDefined();
      expect(directoryFormFamilies(project!)).toContain('Web');
    }
  });
});
