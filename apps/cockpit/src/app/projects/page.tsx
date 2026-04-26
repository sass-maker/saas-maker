import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@saas-maker/ui";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { PageHeader } from "@/components/page-header";
import { FleetMonitor } from "@/components/fleet-monitor";
import { ErrorFeed } from "@/components/error-feed";
import { LatencyMap } from "@/components/latency-map";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { AlertCircle, Cloud } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiFetch, getServerToken } from "@/lib/api";
import type { ProjectRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const token = await getServerToken();
  let projects: ProjectRecord[] = [];
  let error: string | null = null;

  try {
    const res = await apiFetch("/v1/projects", {}, token);
    projects = res.data ?? [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load projects";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet"
        description="Monitor and manage your project fleet."
        action={<CreateProjectDialog />}
      />

      <FleetMonitor />

      <div className="grid gap-6 md:grid-cols-2">
        <ErrorFeed />
        <LatencyMap />
      </div>

      <div className="flex items-center gap-2 pt-8">
        <Cloud className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Cloud Blocks</h2>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <CardTitle className="text-base text-destructive">
                Failed to load fleet
              </CardTitle>
              <CardDescription className="mt-1 text-xs font-mono break-all">
                {error}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      ) : projects.length === 0 ? (
        <OnboardingFlow />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.slug}`}>
              <Card className="transition-colors hover:border-foreground/20 hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription>{project.slug}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
