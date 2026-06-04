import { FoundryError } from './error.js';

export interface TraceOptions {
  silent?: boolean;
  project?: string;
  projectId?: string;
  context?: Record<string, any>;
}

function traceContext(
  name: string,
  duration: number,
  options: TraceOptions
): Record<string, any> {
  const context: Record<string, any> = {
    ...options.context,
    traceName: name,
    traceDuration: duration,
  };

  const projectId = options.projectId ?? options.project;
  if (projectId) {
    context['project_id'] = projectId;
  }

  return context;
}

export async function trace<T>(
  name: string,
  fn: () => Promise<T>,
  options: TraceOptions = {}
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    // Log success (can be extended to ship to PostHog)
    if (!options.silent) {
      console.info(`[Foundry Trace] ${name} completed in ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (err) {
    const duration = performance.now() - start;
    
    if (!options.silent) {
      console.error(`[Foundry Trace] ${name} failed after ${duration.toFixed(2)}ms`);
    }

    if (err instanceof FoundryError) {
      err.context = { ...err.context, ...traceContext(name, duration, options) };
      throw err;
    }

    throw new FoundryError(err instanceof Error ? err.message : String(err), {
      context: traceContext(name, duration, options),
    });
  }
}
