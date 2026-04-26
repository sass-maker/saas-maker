import {
  getLocalConfig,
  getLocalProjectId,
  getLocalProjectKey,
  saveLocalConfig,
} from './config.js';
import { getResponseError, requestApi } from './request.js';

interface ProjectRecord {
  id: string;
  slug: string;
  api_key?: string;
}

export function requireLinkedProjectKey(): string {
  const local = getLocalConfig();
  if (!local) {
    throw new Error('No project linked. Run `fnd init` first.');
  }
  const key = getLocalProjectKey(local);
  if (!key) {
    throw new Error('No project key found in .saasmaker.json. Run `fnd init` again.');
  }
  return key;
}

export async function requireLinkedProjectId(): Promise<string> {
  const local = getLocalConfig();
  if (!local) {
    throw new Error('No project linked. Run `fnd init` first.');
  }

  const localProjectId = getLocalProjectId(local);
  if (localProjectId) return localProjectId;

  const projectRes = await requestApi<ProjectRecord>({
    path: `/v1/projects/by-slug/${encodeURIComponent(local.slug)}`,
    auth: 'session',
  });

  if (!projectRes.ok || !projectRes.data) {
    throw new Error(getResponseError(projectRes));
  }

  const project = projectRes.data;
  if (!project.id) {
    throw new Error('Failed to resolve linked project id');
  }

  saveLocalConfig({
    slug: local.slug,
    projectId: project.id,
    projectKey: getLocalProjectKey(local) ?? project.api_key,
  });

  return project.id;
}
