/**
 * Simple {{variable}} template renderer.
 * No dependencies — just string interpolation.
 */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    const value = trimmed.split('.').reduce<unknown>((obj, part) => {
      if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[part];
      return undefined;
    }, data as unknown);
    return value != null ? String(value) : '';
  });
}

export function renderHtml(template: string, data: Record<string, unknown>): string {
  return renderTemplate(template, data);
}

export function renderText(template: string, data: Record<string, unknown>): string {
  return renderTemplate(template, data);
}
