import { describe, expect, it } from 'vitest';
import { DIRECTORY_PROJECTS, directoryFormFamilies } from '../../apps/showcase/src/data/directory';
import {
  PROJECTS_DIRECTORY,
  PROJECTS_DIRECTORY_COUNT,
  PROJECTS_DIRECTORY_FORMS,
  PROJECTS_DIRECTORY_GROUPS,
  PROJECTS_DIRECTORY_PLATFORMS,
} from '../../apps/showcase/src/data/projects-directory';

describe('current projects browsing boundary', () => {
  it('excludes the four archived rows from browsing while retaining profile inputs', () => {
    const archived = ['ai-badges', 'pinpoint', 'port-whisperer', 'society-relay'];
    expect(
      DIRECTORY_PROJECTS.filter((project) => project.lifecycle === 'inactive').map(
        (project) => project.id
      )
    ).toEqual(archived);
    expect(PROJECTS_DIRECTORY_COUNT).toBe(33);
    for (const id of archived) {
      expect(PROJECTS_DIRECTORY.some((project) => project.id === id)).toBe(false);
      expect(DIRECTORY_PROJECTS.some((project) => project.id === id)).toBe(true);
    }
  });
  it('keeps Featured before Current and derives every browsing count from retained rows', () => {
    expect(PROJECTS_DIRECTORY_GROUPS.map((group) => [group.id, group.projects.length])).toEqual([
      ['featured', 2],
      ['current', 31],
    ]);
    expect(PROJECTS_DIRECTORY_GROUPS.flatMap((group) => group.projects)).toHaveLength(
      PROJECTS_DIRECTORY_COUNT
    );
    expect(PROJECTS_DIRECTORY.every((project) => project.lifecycle !== 'inactive')).toBe(true);
  });
  it('only offers filters that describe at least one retained row', () => {
    for (const form of PROJECTS_DIRECTORY_FORMS) {
      expect(
        PROJECTS_DIRECTORY.some((project) => directoryFormFamilies(project).includes(form))
      ).toBe(true);
    }
    expect(PROJECTS_DIRECTORY_PLATFORMS).toEqual(
      [...new Set(PROJECTS_DIRECTORY.flatMap((project) => project.platforms))].sort((left, right) =>
        left.localeCompare(right)
      )
    );
  });
});
