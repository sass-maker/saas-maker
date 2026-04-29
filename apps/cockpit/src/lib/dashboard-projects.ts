type ProjectIdentity = {
  name?: string | null;
  slug?: string | null;
};

const HIDDEN_DASHBOARD_PROJECTS = new Set(["a", "port-whisperer"]);

export function isHiddenDashboardProject(project: ProjectIdentity) {
  const name = project.name?.trim().toLowerCase();
  const slug = project.slug?.trim().toLowerCase();

  return (
    (name !== undefined && HIDDEN_DASHBOARD_PROJECTS.has(name)) ||
    (slug !== undefined && HIDDEN_DASHBOARD_PROJECTS.has(slug))
  );
}

export function visibleDashboardProjects<T extends ProjectIdentity>(
  projects: T[]
) {
  return projects.filter((project) => !isHiddenDashboardProject(project));
}
