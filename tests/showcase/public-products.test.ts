import { describe, expect, it } from 'vitest';
import { buildPublicProducts } from '../../scripts/public-products.mjs';
import { structureCatalog } from '../../scripts/catalog-schema.mjs';
import { validateProjection } from '../../scripts/sync-fleet-public-products.mjs';
import { resolveFooterArt, validateFooterArt } from '../../packages/fleet-footer/src/artwork.mjs';

function catalog() {
  const projects = ['primary', 'active', 'inactive', 'unverified'].map((id) => ({
    id,
    name: id,
    category: 'utility',
    domains: [`${id}.example`],
    repositoryVisibility: 'private',
    lifecycle: {
      status: id === 'unverified' ? 'active' : id,
      shareable: id !== 'unverified',
      resumeCondition:
        id === 'inactive' ? 'Three named pilot users request a supported release.' : null,
    },
    public: {
      listing: 'maintained',
      description: 'A useful public experiment',
      maturity: 'experiment',
    },
    portfolio: { priority: 'P2', kind: 'experiment', deployed: true },
  }));
  return {
    projects,
    publicDirectory: {
      projects: Object.fromEntries(
        projects.map(({ id }) => [
          id,
          {
            makerNote: 'I made this as a working experiment.',
            form: 'Web app',
            platforms: ['Web'],
            technologies: ['TypeScript'],
          },
        ])
      ),
    },
    infrastructure: { projects: {} },
  };
}

function standaloneRepository(overrides: Record<string, unknown> = {}) {
  return {
    originalRepository: 'owner/source-lab',
    currentRepository: 'owner/source-lab',
    projectId: null,
    futureForm: 'active-product',
    category: 'experimental',
    repositoryVisibility: 'public',
    lifecycle: { status: 'active', shareable: true, resumeCondition: null },
    githubVerification: {
      url: 'https://github.com/owner/source-lab',
      archived: false,
    },
    presentation: {
      public: {
        listing: 'maintained',
        id: 'source-lab',
        name: 'Source Lab',
        description: 'A useful public source experiment.',
        maturity: 'experiment',
      },
      directory: {
        description: 'A useful public source experiment.',
        makerNote: 'I made this as a small source experiment.',
        purposeContract: { purpose: 'Test a bounded idea.' },
        form: 'Source project',
        platforms: ['GitHub'],
        technologies: ['TypeScript'],
        firstCommitAt: '2026-01-01',
        latestCommitAt: '2026-02-01',
      },
    },
    ...overrides,
  };
}

describe('shareability projection boundary', () => {
  it('optionally projects explicitly presented standalone repositories', () => {
    const input = catalog();
    input.repositoryReview = {
      repositories: [
        standaloneRepository(),
        standaloneRepository({
          originalRepository: 'owner/finished-lab',
          currentRepository: 'owner/finished-lab',
          futureForm: 'finished-experiment',
          lifecycle: { status: 'inactive', shareable: true, resumeCondition: null },
          githubVerification: { url: 'https://github.com/owner/finished-lab', archived: true },
          presentation: {
            public: {
              listing: 'past',
              id: 'finished-lab',
              name: 'Finished Lab',
              description: 'A finished public experiment.',
            },
            directory: {
              description: 'A finished public experiment.',
              makerNote: 'I retained this completed experiment.',
              form: 'Source project',
              platforms: ['GitHub'],
              technologies: ['JavaScript'],
            },
          },
        }),
      ],
    };

    const result = buildPublicProducts(input);
    expect(result.products.find(({ id }) => id === 'source-lab')).toMatchObject({
      url: 'https://github.com/owner/source-lab',
      repositoryUrl: 'https://github.com/owner/source-lab',
      roadmapUrl: 'https://github.com/owner/source-lab/issues',
      lifecycle: 'active',
      spotlight: false,
    });
    expect(result.pastProjects.find(({ id }) => id === 'finished-lab')).toMatchObject({
      repositoryUrl: 'https://github.com/owner/finished-lab',
      lifecycle: 'inactive',
    });
    expect(result.directory.find(({ id }) => id === 'source-lab')).toMatchObject({
      url: 'https://github.com/owner/source-lab',
      deployed: false,
      deploymentProviders: [],
      domains: [],
    });
  });

  it('excludes standalone rows without explicit safe publication eligibility', () => {
    const input = catalog();
    input.repositoryReview = {
      repositories: [
        standaloneRepository({ lifecycle: { status: 'active', shareable: false } }),
        standaloneRepository({ presentation: undefined }),
        standaloneRepository({ repositoryVisibility: undefined }),
        standaloneRepository({
          repositoryVisibility: 'private',
          currentRepository: 'owner/private-lab',
          githubVerification: { url: 'https://github.com/owner/private-lab' },
        }),
        standaloneRepository({
          presentation: {
            public: { listing: 'hidden' },
            directory: { makerNote: 'Must remain hidden.' },
          },
        }),
      ],
    };
    const serialized = JSON.stringify(buildPublicProducts(input));
    expect(serialized).not.toContain('source-lab');
    expect(serialized).not.toContain('private-lab');
    expect(serialized).not.toContain('Must remain hidden');
  });

  it('rejects mismatched standalone GitHub verification without leaking review fields', () => {
    const input = catalog();
    input.repositoryReview = {
      repositories: [
        standaloneRepository({
          reason: 'private owner rationale',
          ownerReview: { authorization: 'private review evidence' },
          githubVerification: { url: 'https://github.com/other/source-lab' },
        }),
      ],
    };
    expect(() => buildPublicProducts(input)).toThrow('GitHub verification URL mismatch');
    input.repositoryReview.repositories[0].githubVerification.url =
      'https://github.com/owner/source-lab';
    const serialized = JSON.stringify(buildPublicProducts(input));
    expect(serialized).not.toContain('private owner rationale');
    expect(serialized).not.toContain('private review evidence');
  });

  it('projects the canonical purpose category instead of legacy presentation labels', () => {
    const input = catalog();
    input.projects[0].category = 'media';
    Reflect.set(input.projects[0].public, 'category', 'personal');
    const result = buildPublicProducts(input);
    expect(result.products.find(({ id }) => id === 'primary')?.category).toBe('media');
    expect(result.directory.find(({ id }) => id === 'primary')?.category).toBe('media');
    input.projects[0].category = 'personal';
    expect(() => buildPublicProducts(input)).toThrow('invalid canonical category');
  });

  it('preserves an explicit canonical subpath across product and directory URLs', () => {
    const input = catalog();
    input.projects[0].public.url = 'https://primary.example/storagedaddy/';
    const result = buildPublicProducts(input);
    expect(result.products.find(({ id }) => id === 'primary')).toMatchObject({
      url: 'https://primary.example/storagedaddy/',
      changelogUrl: 'https://primary.example/storagedaddy/changelog',
    });
    expect(result.directory.find(({ id }) => id === 'primary')).toMatchObject({
      url: 'https://primary.example/storagedaddy/',
      changelogUrl: 'https://primary.example/storagedaddy/changelog',
    });
  });

  it('rejects public URL overrides without the canonical HTTPS host', () => {
    for (const url of [
      'http://primary.example/storagedaddy/',
      'https://other.example/storagedaddy/',
      'https://user:pass@primary.example/storagedaddy/',
    ]) {
      const input = catalog();
      input.projects[0].public.url = url;
      expect(() => buildPublicProducts(input)).toThrow(
        'primary: public.url must be an absolute HTTPS URL on the canonical domain'
      );
    }
  });

  it('excludes unverified entries from every promotional surface and keeps paused experiments', () => {
    const result = buildPublicProducts(catalog());
    expect(result.directory.map((project) => [project.id, project.group])).toEqual([
      ['primary', 'featured'],
      ['active', 'current'],
      ['inactive', 'past'],
    ]);
    expect(result.products.map((project) => project.id)).not.toContain('unverified');
    expect(
      result.products.filter((project) => project.spotlight).map((project) => project.id)
    ).toEqual(['primary']);
    expect(JSON.stringify(result)).not.toContain('resumeCondition');
    expect(JSON.stringify(result)).not.toContain('Three named pilot users');
  });

  it('fails closed for legacy lifecycle flags and explicit hidden listings', () => {
    const input = catalog();
    input.projects[0].public.listing = 'hidden';
    Reflect.set(input.projects[1], 'lifecycle', 'maintained');
    const result = buildPublicProducts(input);
    expect(result.directory.map((project) => project.id)).toEqual(['inactive']);
    expect(result.products.map((project) => project.id)).toEqual(['inactive']);
  });

  it('keeps all four inactive flag combinations independent without publishing restart conditions', () => {
    for (const shareable of [false, true]) {
      for (const resumeCondition of [
        null,
        'Three named pilot users request a supported release.',
      ]) {
        const input = catalog();
        const project = input.projects.find(({ id }) => id === 'inactive')!;
        project.lifecycle = { status: 'inactive', shareable, resumeCondition };
        const before = structuredClone(input);
        const result = buildPublicProducts(input);
        expect(result.directory.some(({ id }) => id === 'inactive')).toBe(shareable);
        expect(result.products.some(({ id }) => id === 'inactive')).toBe(shareable);
        expect(JSON.stringify(result)).not.toContain('resumeCondition');
        expect(JSON.stringify(result)).not.toContain('Three named pilot users');
        expect(input).toEqual(before);
      }
    }
  });
});

function artwork(id = 'primary') {
  return {
    src: `/footer-art/${id}.webp`,
    width: 2048,
    height: 683,
    alt: 'A local evidence workshop with an inspection lens and source receipts.',
    focalX: 50,
    focalY: 52.5,
    credit: 'Original pixel artwork for this product.',
    sha256: 'a'.repeat(64),
  };
}

describe('optional public footer artwork', () => {
  it('roundtrips canonical presentation artwork without changing source or schema', () => {
    const input = structureCatalog(catalog());
    input.projects[0].presentation.footerArt = artwork();
    const before = structuredClone(input);
    const output = buildPublicProducts(input);
    expect(output.schemaVersion).toBe(5);
    expect(output.products.find(({ id }) => id === 'primary')?.footerArt).toEqual(artwork());
    expect(output.directory.find(({ id }) => id === 'primary')?.footerArt).toEqual(artwork());
    expect(input).toEqual(before);
    expect(resolveFooterArt(output, 'primary')).toEqual(artwork());
    expect(resolveFooterArt(output, 'active')).toBeUndefined();
    expect(JSON.stringify(output)).not.toContain('presentation');
    const legacy = catalog();
    Reflect.set(legacy.projects[0], 'footerArt', artwork());
    expect(
      buildPublicProducts(legacy).products.find(({ id }) => id === 'primary')?.footerArt
    ).toEqual(artwork());
  });

  it('keeps unconfigured artwork absent and never publishes hidden source artwork', () => {
    const input = structureCatalog(catalog());
    input.projects[3].presentation.footerArt = { src: '/Users/fictional/private.png' };
    const output = buildPublicProducts(input);
    expect(output.products.every((entry) => !Object.hasOwn(entry, 'footerArt'))).toBe(true);
    expect(output.directory.every((entry) => !Object.hasOwn(entry, 'footerArt'))).toBe(true);
    expect(resolveFooterArt(output, 'unverified')).toBeUndefined();
    expect(validateFooterArt(undefined, 'primary')).toBeUndefined();
    expect(() => validateFooterArt(null, 'primary')).toThrow('metadata object');
  });

  it('uses one canonical family for every evidenced caller alias, including PNG', () => {
    for (const [caller, owner] of [
      ['memory-map', 'chatgpt-memory-insights'],
      ['high-signal-podcasts', 'on-record'],
      ['portfolio', 'sarthakagrawal-personal'],
      ['aliveville', 'ai-game'],
    ]) {
      const art = { ...artwork(owner), src: `/footer-art/${owner}.png` };
      const projection = { directory: [{ id: owner, footerArt: art }] };
      expect(resolveFooterArt(projection, caller)).toEqual(art);
      expect(resolveFooterArt(projection, owner)).toEqual(art);
      expect(validateFooterArt(art, caller)).toEqual(art);
    }
    expect(
      resolveFooterArt(
        { products: [{ id: 'aliveville', footerArt: artwork('ai-game') }] },
        'aliveville'
      )
    ).toEqual(artwork('ai-game'));
    expect(
      resolveFooterArt(
        {
          directory: [
            { id: 'primary', footerArt: { ...artwork(), src: 'https://example.invalid/art.png' } },
          ],
        },
        'primary'
      )
    ).toBeUndefined();
    expect(resolveFooterArt({}, 'unknown')).toBeUndefined();
  });

  it('rejects remote, secret, private, traversal and mismatched asset paths', () => {
    for (const src of [
      'https://example.invalid/art.png?token=fictional',
      'https://user:fictional@example.invalid/art.png',
      '//example.invalid/art.png',
      'data:image/png;base64,AAAA',
      'file:///Users/fictional/art.png',
      '/Users/fictional/art.png',
      '/footer-art/../primary.png',
      '/footer-art/%2e%2e/primary.png',
      '/footer-art/primary.png?token=fictional',
      '/footer-art/primary.png#fragment',
      '/footer-art/other.png',
      '/footer-art/primary.svg',
    ]) {
      const input = structureCatalog(catalog());
      input.projects[0].presentation.footerArt = { ...artwork(), src };
      expect(() => buildPublicProducts(input)).toThrow('canonical relative public asset path');
    }
  });

  it('rejects invalid dimensions, focal coordinates, hashes and nonpublic text', () => {
    for (const invalid of [
      { width: 0 },
      { width: 4097 },
      { height: -1 },
      { height: 1.5 },
      { width: '2048' },
      { focalX: -1 },
      { focalY: 101 },
      { focalX: Number.NaN },
      { focalY: Number.POSITIVE_INFINITY },
      { focalX: '50' },
      { sha256: 'a'.repeat(63) },
      { sha256: 'z'.repeat(64) },
      { alt: '<img src=x>' },
      { alt: '' },
      { alt: 'A'.repeat(321) },
      { credit: 'Bearer fictional-token' },
      { credit: '/Users/fictional/art.png' },
      { credit: 'https://example.invalid?secret=fictional' },
      { credit: 'token=fictional' },
      { credit: 'Original\nprivate note' },
    ]) {
      expect(() => validateFooterArt({ ...artwork(), ...invalid }, 'primary')).toThrow(
        'footerArt:'
      );
    }
    expect(
      validateFooterArt({ ...artwork(), width: 1, height: 4096, focalX: 0, focalY: 100 }, 'primary')
    ).toMatchObject({ width: 1, height: 4096, focalX: 0, focalY: 100 });
    expect(() =>
      validateFooterArt({ ...artwork(), internalSource: '/private/fictional' }, 'primary')
    ).toThrow('unsupported field');
    const missing = artwork();
    Reflect.deleteProperty(missing, 'sha256');
    expect(() => validateFooterArt(missing, 'primary')).toThrow('missing sha256');
  });

  it('validates existing public projection schemas without import-time sync writes', () => {
    const product = {
      id: 'primary',
      name: 'Primary',
      description: 'A useful product.',
      url: 'https://primary.example',
      footerArt: artwork(),
    };
    expect(() =>
      validateProjection({ schemaVersion: 1, products: [product] }, 'fixture')
    ).not.toThrow();
    expect(() =>
      validateProjection(
        {
          schemaVersion: 1,
          products: [{ ...product, footerArt: { ...artwork(), ownerNotes: 'fictional' } }],
        },
        'fixture'
      )
    ).toThrow('unsupported field');
    const purposeContract = Object.fromEntries(
      ['purpose', 'audience', 'outcome', 'mechanism', 'proof', 'nextAction'].map((field) => [
        field,
        'Explicit bounded fixture evidence.',
      ])
    );
    const directory = {
      id: 'primary',
      name: 'Primary',
      description: 'A useful product.',
      makerNote: 'A bounded fixture.',
      form: 'Web app',
      group: 'current',
      lifecycle: 'active',
      purposeContract,
      footerArt: artwork(),
    };
    expect(() =>
      validateProjection(
        { schemaVersion: 5, products: [product], directory: [directory], pastProjects: [] },
        'fixture'
      )
    ).not.toThrow();
    expect(() =>
      validateProjection(
        {
          schemaVersion: 5,
          products: [product],
          directory: [{ ...directory, footerArt: { ...artwork(), focalX: 101 } }],
        },
        'fixture'
      )
    ).toThrow('focalX');
    expect(() =>
      validateProjection(
        {
          schemaVersion: 5,
          products: [product],
          directory: [directory],
          pastProjects: [{ id: 'primary', footerArt: { ...artwork(), src: '/tmp/fictional.png' } }],
        },
        'fixture'
      )
    ).toThrow('canonical relative public asset path');
  });
});
