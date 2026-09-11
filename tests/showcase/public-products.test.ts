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

describe('shareability projection boundary', () => {
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
