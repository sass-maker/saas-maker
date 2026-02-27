export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="mt-2 h-4 w-32 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Quick Setup card */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-6 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="h-9 w-[140px] animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-[160px] animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-[120px] animate-pulse rounded-md bg-muted" />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="border-b p-3 flex gap-4">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted flex-1" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted hidden sm:block" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border-b p-3 flex gap-4 items-center">
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted flex-1" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted hidden sm:block" />
            <div className="h-4 w-8 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
