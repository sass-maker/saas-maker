import { describe, expect, it } from 'vitest';
import {
  ARCHIVED_DIRECTORY_PROJECTS,
  ARCHIVED_REPOSITORY_PROJECTS,
  DIRECTORY_PROJECTS,
  directoryFormFamilies,
} from '../../apps/showcase/src/data/directory';
import { PUBLIC_ROUTES } from '../../apps/showcase/src/data/publicRoutes';
import {
  PROJECTS_DIRECTORY,
  PROJECTS_DIRECTORY_COUNT,
  PROJECTS_DIRECTORY_FORMS,
  PROJECTS_DIRECTORY_GROUPS,
  PROJECTS_DIRECTORY_PLATFORMS,
  PROJECTS_DIRECTORY_COLLECTIONS,
  directoryCollectionBlocks,
} from '../../apps/showcase/src/data/projects-directory';

describe('current projects browsing boundary', () => {
  it('shows the unified Mac app once and retains its four predecessor projects in history', () => {
    const previous = ['storagedaddy', 'performancedaddy', 'browserdaddy', 'contextdaddy'];
    const blocks = directoryCollectionBlocks(PROJECTS_DIRECTORY, PROJECTS_DIRECTORY_COLLECTIONS);
    const rows = blocks.flatMap((block) => block.projects);
    expect(rows.filter((project) => project.id === 'daddyrad')).toHaveLength(1);
    expect(rows.filter((project) => previous.includes(project.id))).toHaveLength(0);
    expect(ARCHIVED_DIRECTORY_PROJECTS.filter((project) => previous.includes(project.id))).toHaveLength(4);
    for (const id of previous) {
      expect(PUBLIC_ROUTES.filter((route) => route.path === '/p/' + id)).toHaveLength(1);
    }
    expect(PROJECTS_DIRECTORY_COLLECTIONS.some((collection) => collection.id === 'daddyrad')).toBe(false);
  });
  it('browses the complete current roster and keeps archived identities separate', () => {
    expect(PROJECTS_DIRECTORY_COUNT).toBe(DIRECTORY_PROJECTS.length);
    expect(DIRECTORY_PROJECTS.every((project) => project.roster === 'current')).toBe(true);
    expect(ARCHIVED_DIRECTORY_PROJECTS.every((project) => project.roster === 'archived')).toBe(
      true
    );
    expect(
      new Set([...DIRECTORY_PROJECTS, ...ARCHIVED_DIRECTORY_PROJECTS].map((project) => project.id))
        .size
    ).toBe(DIRECTORY_PROJECTS.length + ARCHIVED_DIRECTORY_PROJECTS.length);
  });
  it('keeps Featured before Current and derives every browsing count from retained rows', () => {
    expect(PROJECTS_DIRECTORY_GROUPS.map((group) => [group.id, group.projects.length])).toEqual(
      ['featured', 'current', 'past']
        .map(
          (groupId) =>
            [
              groupId,
              DIRECTORY_PROJECTS.filter((project) => project.group === groupId).length,
            ] as const
        )
        .filter(([, count]) => count > 0)
    );
    expect(PROJECTS_DIRECTORY_GROUPS.flatMap((group) => group.projects)).toHaveLength(
      PROJECTS_DIRECTORY_COUNT
    );
    expect(PROJECTS_DIRECTORY.every((project) => project.roster === 'current')).toBe(true);
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
  it('preserves historical standalone repository routes without changing roster counts', () => {
    const legacyIds = ['ai-badges', 'pinpoint', 'port-whisperer', 'society-relay'];
    expect(ARCHIVED_REPOSITORY_PROJECTS.map((project) => project.id).sort()).toEqual(legacyIds);
    const catalogIds = new Set(
      [...DIRECTORY_PROJECTS, ...ARCHIVED_DIRECTORY_PROJECTS].map((project) => project.id)
    );
    expect(legacyIds.filter((id) => catalogIds.has(id))).toEqual([]);

    for (const project of ARCHIVED_REPOSITORY_PROJECTS) {
      const route = PUBLIC_ROUTES.find((candidate) => candidate.path === project.profileUrl);
      expect(route?.markdown).toContain('Past standalone repository');
      expect(route?.markdown).toContain(project.repositoryUrl);
    }
  });
});
