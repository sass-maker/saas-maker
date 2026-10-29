import {
  DIRECTORY_FORMS,
  DIRECTORY_GROUPS,
  DIRECTORY_PROJECTS,
  DIRECTORY_COLLECTIONS,
  directoryFormFamilies,
} from './directory';
import type { DirectoryCollection, DirectoryProject } from './directory';

export function directoryCollectionBlocks(
  projects: DirectoryProject[],
  collections: DirectoryCollection[]
) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const blocks = collections
    .map((collection) => ({
      collection,
      projects: collection.projectIds.flatMap((id) => {
        const project = projectById.get(id);
        return project ? [project] : [];
      }),
    }))
    .filter((block) => block.projects.length > 0);
  const members = new Set(blocks.flatMap((block) => block.projects.map((project) => project.id)));
  return [
    ...blocks,
    { collection: null, projects: projects.filter((project) => !members.has(project.id)) },
  ];
}

export const PROJECTS_DIRECTORY_COLLECTIONS = DIRECTORY_COLLECTIONS;

// The current Products view is the canonical current roster. Historical
// identities are projected and rendered separately as archivedDirectory.
export const PROJECTS_DIRECTORY = DIRECTORY_PROJECTS;
export const PROJECTS_DIRECTORY_GROUPS = DIRECTORY_GROUPS.map((group) => ({
  ...group,
  projects: PROJECTS_DIRECTORY.filter((project) => project.group === group.id),
})).filter((group) => group.projects.length > 0);
export const PROJECTS_DIRECTORY_COUNT = PROJECTS_DIRECTORY.length;
export const PROJECTS_DIRECTORY_FORMS = DIRECTORY_FORMS.filter((form) =>
  PROJECTS_DIRECTORY.some((project) => directoryFormFamilies(project).includes(form))
);
export const PROJECTS_DIRECTORY_PLATFORMS = [
  ...new Set(PROJECTS_DIRECTORY.flatMap((project) => project.platforms)),
].sort((left, right) => left.localeCompare(right));
