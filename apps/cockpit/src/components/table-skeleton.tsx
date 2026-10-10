import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function FeedbackTableSkeleton() {
  return (
    <div role="status" aria-label="Loading feedback" className="rounded-md border">
      <Table aria-hidden="true">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="hidden sm:table-cell">Submitter</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="hidden md:table-cell w-[120px]">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((row) => (
            <TableRow key={row}>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-full max-w-48" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SubscribersTableSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading subscribers"
      className="overflow-x-auto rounded-md border"
    >
      <Table aria-hidden="true">
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead className="w-[120px]">Kind</TableHead>
            <TableHead className="hidden sm:table-cell">Source</TableHead>
            <TableHead className="w-[120px]">State</TableHead>
            <TableHead className="hidden md:table-cell w-[140px]">Consented</TableHead>
            <TableHead className="hidden md:table-cell w-[140px]">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((row) => (
            <TableRow key={row}>
              <TableCell>
                <Skeleton className="h-4 w-full max-w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
