export { SaasMakerBadge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeTheme } from './Badge';

// Plain HTML snippet helper (for non-React projects)
export function getBadgeHtml(options: { variant?: 'flat' | 'outlined' | 'small'; theme?: 'light' | 'dark' } = {}): string {
  const { variant = 'flat', theme = 'light' } = options;
  const logoSvg = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="3.5" fill="url(%23smg)"/><text x="8" y="11.5" text-anchor="middle" fill="white" font-size="8" font-weight="900" font-family="-apple-system,sans-serif">SM</text><defs><linearGradient id="smg" x1="0" y1="0" x2="16" y2="16"><stop stop-color="%233b82f6"/><stop offset="1" stop-color="%237c3aed"/></linearGradient></defs></svg>`;
  const styles: Record<string, string> = {
    flat: 'display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;font-size:12px;font-weight:500;color:#475569;',
    outlined: 'display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:transparent;border:1px solid #e2e8f0;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;font-size:12px;font-weight:500;color:#475569;',
    small: 'display:inline-flex;align-items:center;padding:4px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;text-decoration:none;',
  };
  const darkStyles: Record<string, string> = {
    flat: 'display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:#1e1e2e;border:1px solid #363649;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;font-size:12px;font-weight:500;color:#94a3b8;',
    outlined: 'display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:transparent;border:1px solid #363649;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;font-size:12px;font-weight:500;color:#94a3b8;',
    small: 'display:inline-flex;align-items:center;padding:4px;background:#1e1e2e;border:1px solid #363649;border-radius:5px;text-decoration:none;',
  };
  const style = theme === 'dark' ? darkStyles[variant] : styles[variant];
  const text = variant !== 'small' ? 'Built with SaasMaker' : '';
  return `<a href="https://sassmaker.com/made-with" target="_blank" rel="noopener noreferrer" style="${style}" aria-label="Built with SaasMaker">${logoSvg}${text ? `<span style="line-height:1">${text}</span>` : ''}</a>`;
}
