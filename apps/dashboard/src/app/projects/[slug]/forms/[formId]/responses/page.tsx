import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ResponsesContent } from "./responses-content";
import { ArrowLeft, ClipboardList, BarChart3 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../../../get-project";
import type {
  FormRecord,
  FormQuestionRecord,
  FormResponseRecord,
  FormAnswerRecord,
  FormAnalyticsResponse,
} from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface ResponseWithAnswers extends FormResponseRecord {
  answers: FormAnswerRecord[];
}

interface Props {
  params: Promise<{ slug: string; formId: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function FormResponsesPage({
  params,
  searchParams,
}: Props) {
  const { slug, formId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.limit ?? "20", 10) || 20));

  const { project, token } = await getAuthenticatedProject(slug);

  let form: FormRecord | null = null;
  let questions: FormQuestionRecord[] = [];
  let responses: ResponseWithAnswers[] = [];
  let totalResponses = 0;
  let analytics: FormAnalyticsResponse | null = null;

  // Fetch form + questions, responses, and analytics in parallel
  const [formRes, responsesRes, analyticsRes] = await Promise.allSettled([
    apiFetch(`/v1/forms/dashboard/${project.id}/${formId}`, {}, token),
    apiFetch(
      `/v1/forms/dashboard/${project.id}/${formId}/responses?page=${page}&limit=${limit}`,
      {},
      token
    ),
    apiFetch(
      `/v1/forms/dashboard/${project.id}/${formId}/analytics`,
      {},
      token
    ),
  ]);

  if (formRes.status === "fulfilled") {
    form = formRes.value.form;
    questions = formRes.value.questions ?? [];
  }

  if (responsesRes.status === "fulfilled") {
    responses = responsesRes.value.data ?? [];
    totalResponses = responsesRes.value.total ?? 0;
  }

  if (analyticsRes.status === "fulfilled") {
    analytics = analyticsRes.value;
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Form not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.title}
        description={`${totalResponses} response${totalResponses !== 1 ? "s" : ""}`}
        action={
          <Button variant="outline" asChild>
            <Link href={`/projects/${slug}/forms/${formId}`}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Form
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <StatCard
          title="Total Responses"
          value={totalResponses}
          icon={ClipboardList}
        />
        <StatCard
          title="Questions"
          value={questions.length}
          icon={BarChart3}
        />
      </div>

      <ResponsesContent
        projectId={project.id}
        formId={formId}
        questions={questions}
        responses={responses}
        totalResponses={totalResponses}
        analytics={
          analytics
            ? {
                total_responses: analytics.total_responses,
                questions: analytics.questions,
              }
            : null
        }
        page={page}
        limit={limit}
        slug={slug}
      />
    </div>
  );
}
