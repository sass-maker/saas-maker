import {
  DIRECTORY_FORMS,
  DIRECTORY_GROUPS,
  DIRECTORY_PROJECTS,
  directoryFormFamilies,
} from './directory';

// The browsing view excludes archived work; retained profile routes and the
// public catalog continue to use the complete, checked-in projection.
export const PROJECTS_DIRECTORY = DIRECTORY_PROJECTS.filter(
  (project) => project.lifecycle !== 'inactive'
);
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
