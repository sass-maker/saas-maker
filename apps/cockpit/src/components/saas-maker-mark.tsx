import { cn } from '@/lib/utils';

/** The existing showcase S mark, with the same border, surface and copper tokens. */
export function SaaSMakerMark({
  large = false,
  className,
}: {
  large?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-[10px] border border-[#222222] bg-[#171717] font-bold text-[#ef9b66]',
        large ? 'size-12 text-[21px]' : 'size-8 text-sm',
        className
      )}
    >
      S
    </span>
  );
}
