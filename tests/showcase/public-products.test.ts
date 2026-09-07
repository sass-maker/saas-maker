import { describe, expect, it } from 'vitest';
import { buildPublicProducts } from '../../scripts/public-products.mjs';

function catalog() {
  const projects = ['primary', 'active', 'inactive', 'unverified'].map((id) => ({
    id, name: id, domains: [`${id}.example`], repositoryVisibility: 'private',
    lifecycle: { status: id === 'unverified' ? 'active' : id, shareable: id !== 'unverified', resumeCondition: 'private decision' },
    public: { listing: 'maintained', description: 'A useful public experiment', maturity: 'experiment' },
    portfolio: { priority: 'P2', kind: 'experiment', deployed: true },
  }));
  return {
    projects,
    publicDirectory: { projects: Object.fromEntries(projects.map(({ id }) => [id, {
      makerNote: 'I made this as a working experiment.', form: 'Web app', platforms: ['Web'], technologies: ['TypeScript'],
    }])) },
    infrastructure: { projects: {} },
  };
}

describe('shareability projection boundary', () => {
  it('excludes unverified entries from every promotional surface and keeps paused experiments', () => {
    const result = buildPublicProducts(catalog());
    expect(result.directory.map((project) => [project.id, project.group])).toEqual([
      ['primary', 'featured'], ['active', 'current'], ['inactive', 'past'],
    ]);
    expect(result.products.map((project) => project.id)).not.toContain('unverified');
    expect(result.products.filter((project) => project.spotlight).map((project) => project.id)).toEqual(['primary']);
    expect(JSON.stringify(result)).not.toContain('resumeCondition');
    expect(JSON.stringify(result)).not.toContain('private decision');
  });

  it('fails closed for legacy lifecycle flags and explicit hidden listings', () => {
    const input = catalog();
    input.projects[0].public.listing = 'hidden';
    Reflect.set(input.projects[1], 'lifecycle', 'maintained');
    const result = buildPublicProducts(input);
    expect(result.directory.map((project) => project.id)).toEqual(['inactive']);
    expect(result.products.map((project) => project.id)).toEqual(['inactive']);
  });
});
