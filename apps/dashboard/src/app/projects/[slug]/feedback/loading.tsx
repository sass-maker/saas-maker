export default function PublicFeedbackLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="flex gap-3">
        <div className="h-9 w-[140px] animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-[160px] animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-[120px] animate-pulse rounded-md bg-muted" />
      </div>

      <div className="rounded-md border">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border-b p-3 flex gap-4 items-center">
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted flex-1" />
            <div className="h-4 w-8 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
