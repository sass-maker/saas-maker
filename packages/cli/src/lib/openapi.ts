import spec from '../openapi.json';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ValidationResult {
  ok: boolean;
  message?: string;
}

function normalizeInputPath(pathInput: string): string {
  const withoutOrigin = pathInput.replace(/^https?:\/\/[^/]+/i, '');
  const withoutQuery = withoutOrigin.split('?')[0]?.split('#')[0] ?? '';
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  const compact = withLeadingSlash.replace(/\/+/g, '/');
  if (compact === '/') return compact;
  return compact.endsWith('/') ? compact.slice(0, -1) : compact;
}

function templateToRegex(template: string): RegExp {
  const escaped = template.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const withParams = escaped.replace(/\\\{[A-Za-z0-9_]+\\\}/g, '[^/]+');
  return new RegExp(`^${withParams}$`);
}

function findMatchingPath(path: string): string | null {
  for (const template of Object.keys(spec.paths)) {
    if (templateToRegex(template).test(path)) {
      return template;
    }
  }
  return null;
}

function listSimilarPaths(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  const prefix = segments.length >= 2 ? `/${segments[0]}/${segments[1]}` : `/${segments[0] ?? ''}`;
  return Object.keys(spec.paths)
    .filter((p) => p.startsWith(prefix))
    .slice(0, 6);
}

export function validateApiOperation(methodInput: string, pathInput: string): ValidationResult {
  const method = methodInput.toLowerCase() as HttpMethod;
  if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
    return { ok: false, message: `Unsupported HTTP method: ${methodInput}` };
  }

  const path = normalizeInputPath(pathInput);
  const matchedTemplate = findMatchingPath(path);

  if (!matchedTemplate) {
    const similar = listSimilarPaths(path);
    const suggestions = similar.length > 0 ? ` Similar routes: ${similar.join(', ')}` : '';
    return { ok: false, message: `Path "${path}" is not in OpenAPI spec.${suggestions}` };
  }

  const operation = (spec.paths as Record<string, Record<string, unknown>>)[matchedTemplate];
  if (!(method in operation)) {
    const methods = Object.keys(operation)
      .map((m) => m.toUpperCase())
      .join(', ');
    return {
      ok: false,
      message: `Method ${method.toUpperCase()} is not defined for "${matchedTemplate}". Allowed: ${methods}`,
    };
  }

  return { ok: true };
}
