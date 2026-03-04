import { PageHeader } from "@/components/page-header";
import { getAuthenticatedProject } from "../../get-project";
import { CreateForm } from "./create-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NewFormPage({ params }: Props) {
  const { slug } = await params;
  const { project } = await getAuthenticatedProject(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Form"
        description="Create a new form for your project"
      />
      <CreateForm projectId={project.id} projectSlug={slug} />
    </div>
  );
}
