import { cache } from 'react';
import { getDashboardSession } from '@/lib/server-session';
import { redirect, notFound } from 'next/navigation';
import { getServerToken, getProjectBySlug } from '@/lib/api';
import type { ProjectRecord } from '@saas-maker/contracts';

/**
 * Cached per-request helper that authenticates the user and resolves the
 * project by slug.  React.cache() ensures that even when the layout AND
 * the page call this in the same render, the underlying work only runs once.
 */
export const getAuthenticatedProject = cache(
  async (slug: string): Promise<{ project: ProjectRecord; token: string }> => {
    const session = await getDashboardSession();
    if (!session?.user) redirect('/login');

    const token = await getServerToken();
    const project = await getProjectBySlug(slug, token);
    if (!project) notFound();

    return { project, token: token! };
  }
);
