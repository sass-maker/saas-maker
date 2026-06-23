import { getCanonicalProjectName, isHiddenFleetProject } from './fleet-project-names';

type ProjectIdentity = {
  name?: string | null;
  slug?: string | null;
};

export function isHiddenDashboardProject(project: ProjectIdentity) {
  return isHiddenFleetProject(project);
}

export function visibleDashboardProjects<T extends ProjectIdentity>(projects: T[]) {
  return projects
    .filter((project) => !isHiddenDashboardProject(project))
    .map((project) => ({
      ...project,
      name: getCanonicalProjectName(project.slug, project.name),
    }));
}
