import { Skeleton, SkeletonContainer } from '@saas-maker/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const feedbackTableShape =
  '[&_table]:table-fixed [&_tr]:h-10 [&_th:nth-child(1)]:w-[100px] [&_th:nth-child(3)]:hidden [&_td:nth-child(3)]:hidden sm:[&_th:nth-child(3)]:table-cell sm:[&_td:nth-child(3)]:table-cell sm:[&_th:nth-child(3)]:w-1/4 [&_th:nth-child(4)]:w-[120px] [&_th:nth-child(5)]:hidden [&_td:nth-child(5)]:hidden md:[&_th:nth-child(5)]:table-cell md:[&_td:nth-child(5)]:table-cell [&_th:nth-child(5)]:w-[120px]';
export const subscribersTableShape =
  '[&_table]:table-fixed [&_tr]:h-10 [&_th:nth-child(2)]:w-[120px] [&_th:nth-child(3)]:hidden [&_td:nth-child(3)]:hidden sm:[&_th:nth-child(3)]:table-cell sm:[&_td:nth-child(3)]:table-cell sm:[&_th:nth-child(3)]:w-1/5 [&_th:nth-child(4)]:w-[120px] [&_th:nth-child(5)]:hidden [&_td:nth-child(5)]:hidden md:[&_th:nth-child(5)]:table-cell md:[&_td:nth-child(5)]:table-cell [&_th:nth-child(5)]:w-[140px] [&_th:nth-child(6)]:hidden [&_td:nth-child(6)]:hidden md:[&_th:nth-child(6)]:table-cell md:[&_td:nth-child(6)]:table-cell [&_th:nth-child(6)]:w-[140px]';

function TableSkeleton({
  columns,
  shape,
  label,
  announce = true,
}: {
  columns: string[];
  shape: string;
  label: string;
  announce?: boolean;
}) {
  return (
    <SkeletonContainer announce={announce} aria-label={`Loading ${label}`} data-table-skeleton>
      <div className={`min-h-[242px] rounded-md border ${shape}`}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((row) => (
              <TableRow key={row}>
                {columns.map((column) => (
                  <TableCell key={column}>
                    <Skeleton className="h-4 w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SkeletonContainer>
  );
}

export function FeedbackTableSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <TableSkeleton
      columns={['Type', 'Title', 'Submitter', 'Status', 'Date']}
      label="feedback"
      announce={announce}
      shape={feedbackTableShape}
    />
  );
}

export function SubscribersTableSkeleton() {
  return (
    <TableSkeleton
      columns={['Email', 'Kind', 'Source', 'State', 'Consented', 'Created']}
      label="subscribers"
      shape={subscribersTableShape}
    />
  );
}
