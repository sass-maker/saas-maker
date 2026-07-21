type ProjectIdentity = {
  name?: string | null;
  slug?: string | null;
};

export function isHiddenDashboardProject(project: ProjectIdentity) {
  return !project.slug?.trim();
}

export function visibleDashboardProjects<T extends ProjectIdentity>(projects: T[]) {
  return projects
    .filter((project) => !isHiddenDashboardProject(project))
    .map((project) => ({ ...project, name: project.name?.trim() || project.slug || 'Project' }));
}
