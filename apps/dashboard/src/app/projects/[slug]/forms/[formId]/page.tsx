import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../../get-project";
import { FormBuilder } from "./form-builder";
import type { FormRecord, FormQuestionRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; formId: string }>;
}

export default async function FormBuilderPage({ params }: Props) {
  const { slug, formId } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let form: FormRecord | null = null;
  let questions: FormQuestionRecord[] = [];

  try {
    const res = await apiFetch(
      `/v1/forms/dashboard/${project.id}/${formId}`,
      {},
      token
    );
    form = res.form;
    questions = res.questions ?? [];
  } catch {
    // Fetch failed
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Form not found.</p>
      </div>
    );
  }

  return (
    <FormBuilder
      form={form}
      initialQuestions={questions}
      projectId={project.id}
      projectSlug={slug}
    />
  );
}
