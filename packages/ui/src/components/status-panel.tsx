import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Inbox,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils.js';

export type StatusPanelState = 'loading' | 'empty' | 'stale' | 'blocked' | 'error' | 'success';

const stateConfig = {
  loading: {
    label: 'Loading',
    icon: CircleDashed,
    className: 'border-sky-500/25 bg-sky-500/5 text-sky-200',
  },
  empty: {
    label: 'No evidence',
    icon: Inbox,
    className: 'border-border bg-muted/20 text-muted-foreground',
  },
  stale: {
    label: 'Stale',
    icon: Clock3,
    className: 'border-amber-500/25 bg-amber-500/5 text-amber-200',
  },
  blocked: {
    label: 'Blocked',
    icon: Ban,
    className: 'border-orange-500/25 bg-orange-500/5 text-orange-200',
  },
  error: {
    label: 'Failed',
    icon: AlertTriangle,
    className: 'border-red-500/25 bg-red-500/5 text-red-200',
  },
  success: {
    label: 'Verified',
    icon: CheckCircle2,
    className: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-200',
  },
} as const;

export interface StatusPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  state: StatusPanelState;
  title: string;
  description?: string;
  meta?: string;
}

export function StatusPanel({
  state,
  title,
  description,
  meta,
  className,
  children,
  ...props
}: StatusPanelProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <div
      className={cn('rounded-xl border p-4', config.className, className)}
      role={state === 'error' || state === 'blocked' ? 'alert' : 'status'}
      aria-live={state === 'loading' ? 'polite' : undefined}
      {...props}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn('mt-0.5 h-4 w-4 shrink-0', state === 'loading' && 'animate-spin')}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-current">{title}</p>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
              {config.label}
            </span>
          </div>
          {description ? <p className="mt-1 text-sm leading-6 opacity-75">{description}</p> : null}
          {meta ? <p className="mt-2 font-mono text-[11px] opacity-60">{meta}</p> : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
