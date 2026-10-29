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
    portfolio: {
      status: id === 'unverified' ? 'archived' : 'active',
      priority: 'P2',
      kind: 'experiment',
      deployed: true,
    },
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
            purposeContract: {
              purpose: 'Publish a useful public experiment.',
              audience: 'People evaluating experiments.',
              outcome: 'Understand a focused product idea.',
              mechanism: 'A small web app with a clear workflow.',
            },
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

function collectionCatalog() {
  const input = catalog();
  return {
    ...input,
    systems: {
      rootBrands: {
        brands: [
          {
            rootDomain: 'family.example',
            canonicalName: 'Family',
            priority: 'P1',
            priorityDecision: { reason: 'Private investment rationale.' },
            collection: {
              id: 'family',
              description: 'Two useful Mac utilities.',
              websiteUrl: 'https://family.example/',
              projectIds: ['primary', 'active'],
            },
          },
        ],
      },
    },
  };
}

describe('non-product brand collections', () => {
  it('retains independent GitHub, App Store and documentation destinations for domained products', () => {
    for (const destination of [
      'https://github.com/owner/tool',
      'https://apps.apple.com/app/id123',
      'https://docs.example/quickstart',
    ]) {
      const input = catalog();
      Object.assign(input.projects[0].public, {
        url: 'https://primary.example/product/?ref=original#details',
      });
      Object.assign(input.publicDirectory.projects.primary, { publicDestinationUrl: destination });
      const output = buildPublicProducts(input);
      const product = output.products.find((p) => p.id === 'primary')!;
      const profile = output.directory.find((p) => p.id === 'primary')!;
      expect(product.url).toBe('https://primary.example/product/?ref=original#details');
      expect(profile.url).toBe(product.url);
      expect(profile.publicUrl).toBe(destination);
      expect(product.changelogUrl).toBe('https://primary.example/product/changelog');
      expect(() => validateProjection(output, 'fixture')).not.toThrow();
    }
  });
  it('projects only public collection fields without changing product or archive membership', () => {
    const input = collectionCatalog();
    const before = structuredClone(input);
    const output = buildPublicProducts(input);
    expect(output.collections).toEqual([
      {
        id: 'family',
        name: 'Family',
        description: 'Two useful Mac utilities.',
        websiteUrl: 'https://family.example/',
        projectIds: ['primary', 'active'],
      },
    ]);
    expect(output.directory.map((p) => p.id)).toEqual(
      buildPublicProducts(catalog()).directory.map((p) => p.id)
    );
    expect(output.archivedDirectory).toEqual(buildPublicProducts(catalog()).archivedDirectory);
    expect(output.products.some((p) => p.id === 'family')).toBe(false);
    expect(JSON.stringify(output.collections)).not.toMatch(/priority|Private investment|reason/);
    expect(() => validateProjection(output, 'fixture')).not.toThrow();
    expect(input).toEqual(before);
  });

  it('rejects invalid or archived membership, repeated children and unsafe websites', () => {
    for (const invalid of [
      { projectIds: ['primary', 'missing'] },
      { projectIds: ['primary', 'unverified'] },
      { projectIds: ['primary', 'primary'] },
      { projectIds: ['primary'] },
      { websiteUrl: 'http://family.example/' },
      { websiteUrl: 'https://other.example/' },
      { websiteUrl: 'https://user:pass@family.example/' },
      { websiteUrl: 'https://family.example:444/' },
      { websiteUrl: 'https://family.example:443/' },
      { websiteUrl: 'https://family.example/?key=value' },
      { notes: 'Private rationale.' },
    ]) {
      const input = collectionCatalog();
      Object.assign(input.systems.rootBrands.brands[0].collection, invalid);
      expect(() => buildPublicProducts(input)).toThrow();
    }
    const output = buildPublicProducts(collectionCatalog());
    Object.assign(output.collections[0], { priority: 'P1' });
    expect(() => validateProjection(output, 'fixture')).toThrow(
      'unsupported public collection field'
    );
    const repeated = buildPublicProducts(collectionCatalog());
    repeated.collections.push({ ...repeated.collections[0], id: 'another-family' });
    expect(() => validateProjection(repeated, 'fixture')).toThrow(
      'unique current public project ids'
    );
  });

  it('uses one approved collection destination for product and directory URLs while retaining native hosts', () => {
    const input = collectionCatalog();
    Object.assign(input.projects[0].public, { url: 'https://primary.example/old/' });
    Object.assign(input.publicDirectory.projects.primary, {
      publicDestinationUrl: 'https://family.example/storage/',
    });
    const output = buildPublicProducts(input);
    const product = output.products.find((p) => p.id === 'primary')!;
    const directory = output.directory.find((p) => p.id === 'primary')!;
    expect(product.url).toBe('https://family.example/storage/');
    expect(directory.publicUrl).toBe(product.url);
    expect(directory.url).toBe(product.url);
    expect(directory.domains).toEqual(['primary.example']);
    expect(product.changelogUrl).toBe('https://family.example/storage/changelog');
    expect(() => validateProjection(output, 'fixture')).not.toThrow();
  });

  it('adopts a destination on the same native host without changing deployment hosts', () => {
    const input = catalog();
    Object.assign(input.publicDirectory.projects.primary, {
      publicDestinationUrl: 'https://primary.example/new/?from=directory#download',
    });
    const output = buildPublicProducts(input);
    expect(output.products.find((project) => project.id === 'primary')?.url).toBe(
      'https://primary.example/new/?from=directory#download'
    );
    expect(output.directory.find((project) => project.id === 'primary')).toMatchObject({
      publicUrl: 'https://primary.example/new/?from=directory#download',
      domains: ['primary.example'],
    });
  });

  it('rejects unsafe adopted collection destinations and keeps non-members independent', () => {
    for (const destination of [
      'https://user:pass@family.example/storage/',
      'https://family.example:444/storage/',
      'https://family.example:443/storage/',
    ]) {
      const input = collectionCatalog();
      Object.assign(input.publicDirectory.projects.primary, { publicDestinationUrl: destination });
      expect(() => buildPublicProducts(input)).toThrow();
    }
    const input = collectionCatalog();
    Object.assign(input.publicDirectory.projects.inactive, {
      publicDestinationUrl: 'https://family.example/unrelated/',
    });
    const output = buildPublicProducts(input);
    expect(output.products.find((project) => project.id === 'inactive')?.url).toBe(
      'https://inactive.example'
    );
    expect(output.directory.find((project) => project.id === 'inactive')?.publicUrl).toBe(
      'https://family.example/unrelated/'
    );
  });

  it('keeps explicit no-homepage profiles without synthesizing a shared website', () => {
    const input = catalog();
    input.projects[1].public.listing = 'hidden';
    Object.assign(input.publicDirectory.projects.active, { publicDestinationUrl: null });
    const output = buildPublicProducts(input);
    const profile = output.directory.find((p) => p.id === 'active')!;
    expect(profile).not.toHaveProperty('publicUrl');
    expect(profile).not.toHaveProperty('url');
    expect(output.products.some((p) => p.id === 'active')).toBe(false);
  });
});

describe('shareability projection boundary', () => {
  it('retains the established public profile evidence while keeping it off internal profiles', () => {
    const input = catalog();
    input.publicDirectory.projects.primary = {
      ...input.publicDirectory.projects.primary,
      logoUrl: 'https://primary.example/logo.svg',
      purposeContract: {
        ...input.publicDirectory.projects.primary.purposeContract,
        proof: 'A public proof point.',
        nextAction: 'Try the maintained site.',
      },
      firstCommitAt: '2026-01-01',
      latestCommitAt: '2026-02-01',
    };
    input.projects[1].lifecycle.shareable = false;
    input.projects[1].public.listing = 'hidden';
    const result = buildPublicProducts(input);
    const listed = result.directory.find(({ id }) => id === 'primary');
    const internal = result.directory.find(({ id }) => id === 'active');

    expect(listed).toMatchObject({
      logoUrl: 'https://primary.example/logo.svg',
      domains: ['primary.example'],
      deployed: true,
      firstCommitAt: '2026-01-01',
      latestCommitAt: '2026-02-01',
      purposeContract: {
        proof: 'A public proof point.',
        nextAction: 'Try the maintained site.',
      },
    });
    expect(internal).not.toHaveProperty('logoUrl');
    expect(internal).not.toHaveProperty('domains');
    expect(internal?.purposeContract).not.toHaveProperty('proof');
    expect(internal?.purposeContract).not.toHaveProperty('nextAction');
  });

  it('publishes every active-roster profile with status and isolates archived identities', () => {
    const input = catalog();
    input.projects[1].lifecycle.shareable = false;
    const result = buildPublicProducts(input);
    const internal = result.directory.find(({ id }) => id === 'active');
    const archived = result.archivedDirectory.find(({ id }) => id === 'unverified');

    expect(internal).toMatchObject({ roster: 'current', availability: 'not-publicly-available' });
    expect(internal).not.toHaveProperty('url');
    expect(internal).not.toHaveProperty('domains');
    expect(internal).not.toHaveProperty('repositoryUrl');
    expect(internal?.purposeContract).toEqual({
      purpose: 'Publish a useful public experiment.',
      audience: 'People evaluating experiments.',
      outcome: 'Understand a focused product idea.',
      mechanism: 'A small web app with a clear workflow.',
    });
    expect(archived).toMatchObject({
      roster: 'archived',
      availability: 'archived',
      profileUrl: 'https://sassmaker.com/p/unverified',
    });
    expect(archived).not.toHaveProperty('repositoryUrl');
    expect(archived).not.toHaveProperty('purposeContract');
    expect(() => validateProjection(result, 'fixture')).not.toThrow();
  });

  it('keeps public destinations separate from product availability and internal profiles', () => {
    const input = catalog();
    input.publicDirectory.projects.active.availabilityLabel = 'preview-not-qualified';
    input.publicDirectory.projects.active.publicDestinationUrl = 'https://preview.example';
    input.publicDirectory.projects.active.publicDestinationLabel = 'Preview site';
    input.publicDirectory.projects.primary.availabilityLabel = 'internal-private';
    input.projects[0].lifecycle.shareable = false;
    input.projects[0].public.listing = 'hidden';
    const result = buildPublicProducts(input);
    expect(result.directory.find(({ id }) => id === 'active')).toMatchObject({
      availability: 'preview-not-qualified',
      publicUrl: 'https://preview.example',
      publicUrlLabel: 'Preview site',
    });
    expect(result.directory.find(({ id }) => id === 'primary')).toMatchObject({
      availability: 'internal-private',
    });
    expect(result.directory.find(({ id }) => id === 'primary')).not.toHaveProperty('publicUrl');
    expect(() => validateProjection(result, 'fixture')).not.toThrow();
  });

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
    expect(result.directory.some(({ id }) => id === 'source-lab')).toBe(false);
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
    expect(result.directory.map((project) => project.id)).toEqual([
      'primary',
      'active',
      'inactive',
    ]);
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
        expect(result.directory.some(({ id }) => id === 'inactive')).toBe(true);
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
    expect(output.schemaVersion).toBe(6);
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
