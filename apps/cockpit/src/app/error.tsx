"use client";

import { useEffect } from "react";

import { captureError } from "@/lib/capture-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Full detail goes to the console + telemetry, never to the user.
    captureError(error, { scope: "root", digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <div className="max-w-md text-center">
        <h2 className="mb-3 text-2xl font-bold">Something went wrong</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          An unexpected error occurred. Your data is safe — try again, and if it
          keeps happening, come back in a few minutes.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.replace("/projects")}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Go to projects
          </button>
        </div>
        {error.digest ? (
          <p className="mt-6 text-xs text-muted-foreground/60">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
