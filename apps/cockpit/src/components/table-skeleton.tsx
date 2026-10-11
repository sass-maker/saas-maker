import { DataTableSkeleton } from '@saas-maker/ui/components/data-table';

export const feedbackTableShape =
  '[&_table]:table-fixed [&_tr]:h-10 [&_th:nth-child(1)]:w-[100px] [&_th:nth-child(3)]:hidden [&_td:nth-child(3)]:hidden sm:[&_th:nth-child(3)]:table-cell sm:[&_td:nth-child(3)]:table-cell sm:[&_th:nth-child(3)]:w-1/4 [&_th:nth-child(4)]:w-[120px] [&_th:nth-child(5)]:hidden [&_td:nth-child(5)]:hidden md:[&_th:nth-child(5)]:table-cell md:[&_td:nth-child(5)]:table-cell [&_th:nth-child(5)]:w-[120px]';
export const subscribersTableShape =
  '[&_table]:table-fixed [&_tr]:h-10 [&_th:nth-child(2)]:w-[120px] [&_th:nth-child(3)]:hidden [&_td:nth-child(3)]:hidden sm:[&_th:nth-child(3)]:table-cell sm:[&_td:nth-child(3)]:table-cell sm:[&_th:nth-child(3)]:w-1/5 [&_th:nth-child(4)]:w-[120px] [&_th:nth-child(5)]:hidden [&_td:nth-child(5)]:hidden md:[&_th:nth-child(5)]:table-cell md:[&_td:nth-child(5)]:table-cell [&_th:nth-child(5)]:w-[140px] [&_th:nth-child(6)]:hidden [&_td:nth-child(6)]:hidden md:[&_th:nth-child(6)]:table-cell md:[&_td:nth-child(6)]:table-cell [&_th:nth-child(6)]:w-[140px]';

// DataTableSkeleton includes a column-picker toolbar; these tables have filters above them.
const skeletonShape =
  '[&>div.flex]:hidden [&>div]:rounded-md [&_table]:border-collapse [&_th]:px-2 [&_th]:text-sm [&_td]:p-2';

export function FeedbackTableSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <DataTableSkeleton
      columns={[
        { id: 'type', header: 'type' },
        { id: 'title', header: 'title' },
        { id: 'submitter', header: 'submitter' },
        { id: 'status', header: 'status' },
        { id: 'date', header: 'date' },
      ]}
      rows={5}
      label="feedback"
      announce={announce}
      className={`${skeletonShape} ${feedbackTableShape}`}
    />
  );
}

export function SubscribersTableSkeleton() {
  return (
    <DataTableSkeleton
      columns={[
        { id: 'email', header: 'email' },
        { id: 'kind', header: 'kind' },
        { id: 'source', header: 'source' },
        { id: 'state', header: 'state' },
        { id: 'consented', header: 'consented' },
        { id: 'created', header: 'created' },
      ]}
      rows={5}
      label="subscribers"
      className={`${skeletonShape} ${subscribersTableShape}`}
    />
  );
}
