import { Card, CardContent, CardHeader, CardTitle } from '@saas-maker/ui';
import { cn } from '../lib/utils.js';
import type { BlockRenderProps } from './types.js';

interface ColumnDef {
  field: string;
  label?: string;
  align?: 'left' | 'right' | 'center';
}

interface TableProps {
  title?: string;
  columns: ColumnDef[];
  emptyText?: string;
  className?: string;
}

function format(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (value instanceof Date) return value.toLocaleString();
  return JSON.stringify(value);
}

export function TableBlock({ data, loading, error, props }: BlockRenderProps) {
  const config = props as unknown as TableProps;
  const columns = Array.isArray(config.columns) ? config.columns : [];

  return (
    <Card className={cn('overflow-hidden', config.className)}>
      {config.title ? (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="p-0">
        {error ? (
          <p className="text-destructive text-sm px-6 py-4">{error.message}</p>
        ) : loading ? (
          <div className="space-y-2 px-6 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-sm px-6 py-6 text-center">
            {config.emptyText ?? 'No rows.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  {columns.map((col) => (
                    <th
                      key={col.field}
                      className={cn(
                        'px-6 py-2 font-medium',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        (!col.align || col.align === 'left') && 'text-left',
                      )}
                    >
                      {col.label ?? col.field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const r = row as Record<string, unknown>;
                  return (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-muted/40">
                      {columns.map((col) => (
                        <td
                          key={col.field}
                          className={cn(
                            'px-6 py-2 truncate',
                            col.align === 'right' && 'text-right tabular-nums',
                            col.align === 'center' && 'text-center',
                          )}
                        >
                          {format(r[col.field])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
