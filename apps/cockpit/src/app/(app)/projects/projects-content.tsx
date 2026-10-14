'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateProjectDialog } from '@/components/create-project-dialog';
import { PageHeader } from '@/components/page-header';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { useProjectsResource, type ResourceSeed } from '@/components/cockpit-resources';
import { ResourceView } from '@/components/resource-view';
import { ProjectsSkeleton } from '@/components/project-skeleton';
import { visibleDashboardProjects, type DashboardProject } from '@/lib/dashboard-projects';
import { ArrowRight, Boxes, CalendarDays, Cloud, KeyRound, NotebookText } from 'lucide-react';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function ProjectsContent(options: ResourceSeed<{ data: DashboardProject[] }>) {
  const resource = useProjectsResource(options);
  const projects = visibleDashboardProjects(resource.data?.data ?? []);
  const [showCreatedKey, setShowCreatedKey] = useState(false);
  const onboarding = (
    <OnboardingFlow
      onCreated={() => setShowCreatedKey(true)}
      onOpen={() => setShowCreatedKey(false)}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project keys"
        description="Manage the product identities accepted by the SaaS Maker feedback package."
        action={
          resource.status !== 'empty' && !showCreatedKey ? <CreateProjectDialog /> : undefined
        }
      />

      <div className="flex flex-col gap-3 pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold tracking-tight">Feedback projects</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Each project has a key used only to submit and review feedback.
          </p>
        </div>
        {projects.length > 0 && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </Badge>
        )}
      </div>

      <ResourceView resource={resource} skeleton={<ProjectsSkeleton />} empty={onboarding}>
        {() =>
          showCreatedKey ? (
            onboarding
          ) : (
            <div className="grid gap-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.slug}`} className="group block">
                  <Card className="overflow-hidden py-0 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-md">
                    <CardHeader className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-sm font-semibold uppercase text-muted-foreground">
                          {project.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <CardTitle className="truncate text-base">{project.name}</CardTitle>
                            <Badge variant="outline" className="capitalize text-[10px]">
                              {project.source}
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-1 font-mono text-xs">
                            <Boxes className="h-3 w-3" />
                            <span className="truncate">{project.slug}</span>
                          </CardDescription>
                          {project.readme && (
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {project.readme}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="text-right">
                          <div className="text-xs font-medium">API key</div>
                          <div className="text-[11px] text-muted-foreground">Issued</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                      </div>
                    </CardHeader>

                    <CardContent className="grid gap-2 border-t bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>Created {formatDate(project.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <NotebookText className="h-3.5 w-3.5" />
                        <span>{project.readme ? 'Readme added' : 'No readme'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <KeyRound className="h-3 w-3" />
                          Key issued
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )
        }
      </ResourceView>
    </div>
  );
}
