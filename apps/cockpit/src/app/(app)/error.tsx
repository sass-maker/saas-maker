"use client";

import { useEffect } from "react";

import { captureError } from "@/lib/capture-error";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { scope: "unknown", digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="mb-3 text-xl font-bold">Couldn&apos;t load this page</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Something went wrong while loading the cockpit. Your data is safe —
          try again.
        </p>
        <button
          onClick={reset}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Try again
        </button>
        {error.digest ? (
          <p className="mt-6 text-xs text-muted-foreground/60">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
