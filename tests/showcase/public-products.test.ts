import { describe, expect, it } from 'vitest';
import { buildPublicProducts } from '../../scripts/public-products.mjs';

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
