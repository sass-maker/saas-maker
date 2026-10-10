'use client';

import type * as React from 'react';
import { cn } from '@/lib/utils';

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@saas-maker/ui/components/sheet';

// The shared sheet has no body slot; retain the cockpit's scrolling region.
function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn('flex-1 overflow-y-auto px-4 py-2', className)}
      {...props}
    />
  );
}

export { SheetBody };
