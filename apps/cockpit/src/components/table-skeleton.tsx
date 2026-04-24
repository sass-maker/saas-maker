interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="rounded-md border">
      <div className="border-b p-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 flex-1 animate-pulse rounded bg-muted" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b p-3 flex gap-4 items-center">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 flex-1 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}
