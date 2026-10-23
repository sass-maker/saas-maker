'use client';

import { notFound, useParams } from 'next/navigation';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjectDetails } from '@/lib/dashboard-projects';
import { PageHeader } from '@/components/page-header';
import { ProjectCredentials } from '@/components/project-credentials';
import { ProjectDetailSkeleton } from '@/components/project-skeleton';
import { ResourceView } from '@/components/resource-view';
import { useApiResource, type ResourceSeed } from '@/components/cockpit-resources';
import { InboxContent } from './inbox-content';

export function ProjectContent(options: ResourceSeed<ProjectDetails>) {
  const { slug } = useParams<{ slug: string }>();
  const resource = useApiResource<ProjectDetails>(
    `/v1/projects/by-slug/${encodeURIComponent(slug)}`,
    options
  );
  if (resource.error && 'status' in resource.error && resource.error.status === 404) notFound();

  return (
    <ResourceView resource={resource} skeleton={<ProjectDetailSkeleton />}>
      {(project) => (
        <div className="space-y-6">
          <PageHeader
            title={project.name}
            description={`Feedback for ${project.slug}`}
            action={
              <Button variant="outline" asChild>
                <a href={`/projects?view=scoreboard&q=${encodeURIComponent(project.name)}`}>
                  <ListChecks /> Product quality
                </a>
              </Button>
            }
          />
          <ProjectCredentials projectId={project.id} projectKey={project.api_key} />
          <InboxContent projectId={project.id} />
        </div>
      )}
    </ResourceView>
  );
}
