import { Card, CardContent, CardHeader, CardTitle } from '@saas-maker/ui';
import type { BlockRenderProps } from './types.js';

/**
 * Fallback block rendered when a spec references an unknown block type.
 * Surfaces the type so the operator can debug the spec instead of seeing nothing.
 */
export function UnknownBlock({ blockId, props }: BlockRenderProps) {
  const type = (props as { __type?: string }).__type ?? 'unknown';
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Unknown block type: <code className="font-mono">{type}</code>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Block id <code className="font-mono">{blockId}</code> referenced a type the runtime does
          not have registered.
        </p>
      </CardContent>
    </Card>
  );
}
