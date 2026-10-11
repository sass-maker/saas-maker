'use client';

import { notFound, useParams } from 'next/navigation';
import type { ProjectRecord } from '@saas-maker/contracts';
import { PageHeader } from '@/components/page-header';
import { ProjectCredentials } from '@/components/project-credentials';
import { ProjectDetailSkeleton } from '@/components/project-skeleton';
import { ResourceView } from '@/components/resource-view';
import { useApiResource } from '@/components/cockpit-resources';
import { InboxContent } from './inbox-content';

export function ProjectContent() {
  const { slug } = useParams<{ slug: string }>();
  const resource = useApiResource<ProjectRecord>(
    `/v1/projects/by-slug/${encodeURIComponent(slug)}`
  );
  if (resource.error && 'status' in resource.error && resource.error.status === 404) notFound();

  return (
    <ResourceView resource={resource} skeleton={<ProjectDetailSkeleton />}>
      {(project) => (
        <div className="space-y-6">
          <PageHeader title={project.name} description={`Feedback for ${project.slug}`} />
          <ProjectCredentials projectId={project.id} projectKey={project.api_key} />
          <InboxContent projectId={project.id} />
        </div>
      )}
    </ResourceView>
  );
}
