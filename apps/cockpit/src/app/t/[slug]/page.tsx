import type { Metadata } from "next";
import { TestimonialForm } from "./testimonial-form";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.sassmaker.com";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let projectName = slug;

  try {
    const res = await fetch(`${API_BASE}/v1/testimonials/by-project/${slug}`, {
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const data = await res.json();
      projectName = data.project?.name ?? slug;
    }
  } catch {
    // fallback to slug
  }

  return {
    title: `Share your experience with ${projectName}`,
    description: `Leave a testimonial for ${projectName}`,
  };
}

export default async function PublicTestimonialPage({ params }: Props) {
  const { slug } = await params;

  let projectName = slug;
  try {
    const res = await fetch(`${API_BASE}/v1/testimonials/by-project/${slug}`, {
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const data = await res.json();
      projectName = data.project?.name ?? slug;
    }
  } catch {
    // fallback
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{projectName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;d love to hear about your experience
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <TestimonialForm slug={slug} projectName={projectName} />
      </main>
    </div>
  );
}
