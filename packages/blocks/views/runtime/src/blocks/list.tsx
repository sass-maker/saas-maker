import { Card, CardContent, CardHeader, CardTitle } from '@saas-maker/ui';
import { cn } from '../lib/utils.js';
import type { BlockRenderProps } from './types.js';

interface ListProps {
  title?: string;
  primary: string;
  secondary?: string;
  meta?: string;
  emptyText?: string;
  className?: string;
}

function getString(row: Record<string, unknown>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toLocaleString();
  return JSON.stringify(value);
}

export function ListBlock({ data, loading, error, props }: BlockRenderProps) {
  const config = props as unknown as ListProps;

  return (
    <Card className={cn('overflow-hidden', config.className)}>
      {config.title ? (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="px-0 pb-0">
        {error ? (
          <p className="text-destructive text-sm px-6 py-4">{error.message}</p>
        ) : loading ? (
          <div className="space-y-3 px-6 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-sm px-6 py-6 text-center">
            {config.emptyText ?? 'Nothing here yet.'}
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((row, i) => {
              const r = row as Record<string, unknown>;
              const key = getString(r, 'id') ?? String(i);
              return (
                <li
                  key={key}
                  className="flex items-baseline gap-3 px-6 py-3 text-sm hover:bg-muted/40 transition-colors"
                >
                  <span className="font-medium truncate flex-1">
                    {getString(r, config.primary) ?? '—'}
                  </span>
                  {config.secondary ? (
                    <span className="text-muted-foreground truncate flex-1">
                      {getString(r, config.secondary) ?? ''}
                    </span>
                  ) : null}
                  {config.meta ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {getString(r, config.meta) ?? ''}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
