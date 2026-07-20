import * as React from 'react';

import { cn } from '../lib/utils.js';

export interface PillarHeaderProps extends React.HTMLAttributes<HTMLElement> {
  eyebrow: 'Build' | 'Market' | 'Learn' | 'Visibility' | 'Control';
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export function PillarHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: PillarHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 border-b border-border/70 pb-5 md:flex-row md:items-end md:justify-between',
        className
      )}
      {...props}
    >
      <div className="max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
