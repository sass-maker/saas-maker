import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectsLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading projects">
      <PageHeader
        title="Project keys"
        description="Manage the product identities accepted by the SaaS Maker feedback package."
        action={<Skeleton className="h-9 w-32 shrink-0" />}
      />
      <div className="flex flex-col gap-3 pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Feedback projects</h2>
          <p className="text-sm text-muted-foreground">
            Each project has a key used only to submit and review feedback.
          </p>
        </div>
      </div>
      <div className="grid gap-3" aria-hidden="true">
        {[1, 2, 3].map((row) => (
          <div key={row} className="overflow-hidden rounded-xl border bg-card">
            <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-11 shrink-0" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-64 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-9 w-20" />
            </div>
            <div className="grid gap-2 border-t bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3].map((field) => (
                <Skeleton key={field} className="h-4 w-32" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
