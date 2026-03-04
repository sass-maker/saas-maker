import type { Metadata } from "next";
import { SurveyRenderer } from "./survey-renderer";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchForm(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/v1/forms/public/${slug}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await fetchForm(slug);

  return {
    title: form ? form.title : "Survey not found",
    description: form?.description ?? "Take this survey",
  };
}

export default async function PublicSurveyPage({ params }: Props) {
  const { slug } = await params;
  const form = await fetchForm(slug);

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Survey not found
          </h1>
          <p className="mt-2 text-gray-500">
            This survey may have been removed or is no longer accepting
            responses.
          </p>
        </div>
      </div>
    );
  }

  return <SurveyRenderer form={form} />;
}
