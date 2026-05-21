import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <div className="max-w-md text-center">
        <p className="mb-2 text-sm font-medium text-muted-foreground">404</p>
        <h2 className="mb-3 text-2xl font-bold">Page not found</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link
          href="/projects"
          className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Back to projects
        </Link>
      </div>
    </div>
  );
}
