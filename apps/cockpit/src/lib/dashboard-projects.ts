import type { ProjectRecord } from '@saas-maker/contracts';

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

export type DashboardProject = Pick<
  ProjectRecord,
  'id' | 'name' | 'slug' | 'readme' | 'source' | 'created_at'
>;
export type ProjectDetails = Pick<ProjectRecord, 'id' | 'name' | 'slug' | 'api_key'>;
