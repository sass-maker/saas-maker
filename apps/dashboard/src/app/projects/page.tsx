import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { FolderOpen } from "lucide-react";

// Mock data until API is wired up
const MOCK_PROJECTS = [
  {
    id: "1",
    name: "Acme SaaS",
    slug: "acme-saas",
    api_key: "pk_live_abc123",
    owner_id: "user-1",
    created_at: "2026-02-20T10:00:00Z",
  },
  {
    id: "2",
    name: "Widget Pro",
    slug: "widget-pro",
    api_key: "pk_live_def456",
    owner_id: "user-1",
    created_at: "2026-02-18T08:00:00Z",
  },
  {
    id: "3",
    name: "Data Dashboard",
    slug: "data-dashboard",
    api_key: "pk_live_ghi789",
    owner_id: "user-1",
    created_at: "2026-02-15T15:00:00Z",
  },
];

export default function ProjectsPage() {
  const projects = MOCK_PROJECTS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your projects and collect feedback.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <CardHeader className="text-center">
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Create your first project to start collecting feedback.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.slug}`}>
              <Card className="transition-colors hover:border-foreground/20 hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription>
                    Created{" "}
                    {new Date(project.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
