import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@saas-maker/ui';
import { cn } from '../lib/utils.js';
import type { BlockRenderProps } from './types.js';

interface MetricCardProps {
  label?: string;
  description?: string;
  field?: string;
  aggregate?: 'sum' | 'count' | 'avg' | 'min' | 'max';
  prefix?: string;
  suffix?: string;
  format?: 'number' | 'currency' | 'percent';
  trendField?: string;
  className?: string;
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 1,
});

function aggregate(rows: unknown[], field: string | undefined, op: MetricCardProps['aggregate']) {
  if (op === 'count' || !field) return rows.length;
  const values = rows
    .map((row) => (row as Record<string, unknown>)[field])
    .filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return 0;
  switch (op) {
    case 'avg':
      return values.reduce((acc, v) => acc + v, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'sum':
    default:
      return values.reduce((acc, v) => acc + v, 0);
  }
}

function formatValue(value: number, format: MetricCardProps['format']): string {
  switch (format) {
    case 'percent':
      return percentFormatter.format(value);
    case 'currency':
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    case 'number':
    default:
      return numberFormatter.format(value);
  }
}

export function MetricCardBlock({ data, loading, error, props }: BlockRenderProps) {
  const config = props as MetricCardProps;
  const value = aggregate(data, config.field, config.aggregate ?? 'sum');
  const display = `${config.prefix ?? ''}${formatValue(value, config.format)}${config.suffix ?? ''}`;

  return (
    <Card className={cn('overflow-hidden', config.className)}>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wider">
          {config.label ?? 'Metric'}
        </CardDescription>
        {config.description ? (
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {config.description}
          </CardTitle>
        ) : null}
      </CardHeader>
      <CardContent>
        {error ? (
          <span className="text-destructive text-sm">{error.message}</span>
        ) : loading ? (
          <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
        ) : (
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{display}</span>
        )}
      </CardContent>
    </Card>
  );
}
