/**
 * Element anchoring — given a DOM element the user pointed at, produce the
 * strongest hint for locating it (and the source behind it). Ported from
 * pinpoint's source.js (github.com/sarthak-fleet/pinpoint), the OSS prior art
 * for click-to-comment source capture. Pure + dependency-free.
 *
 * React reality (verified): React <=18 exposes `fiber._debugSource`
 * (fileName/lineNumber) in dev, so reactSource() works there. React 19 removed
 * `_debugSource`, so it returns null by design and we fall back to a
 * `data-source` attribute (from a source-locator plugin) or just the text anchor.
 */

export interface ElementAnchor {
  /** A stable-ish CSS selector (#id anchored where possible). */
  selector: string;
  /** Lowercased tag name. */
  tag: string | null;
  /** Trimmed visible text, capped. */
  text: string;
  /** `file:line[:col]` when resolvable (React dev / data-source), else null. */
  source: string | null;
  /** The page URL the element was pointed at on. */
  url: string;
}

const SNIPPET_MAX = 140;

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(s)
    : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

/** React dev source via the fiber's _debugSource (React <=18 only; null on React 19). */
export function reactSource(el: Element): string | null {
  for (const key in el) {
    if (key.indexOf('__reactFiber$') === 0 || key.indexOf('__reactInternalInstance$') === 0) {
      let fiber: any = (el as any)[key];
      let hops = 0;
      while (fiber && hops < 30) {
        const src = fiber._debugSource || (fiber.memoizedProps && fiber.memoizedProps.__source);
        if (src && src.fileName) {
          return src.fileName + ':' + (src.lineNumber || 0) + (src.columnNumber ? ':' + src.columnNumber : '');
        }
        fiber = fiber._debugOwner || fiber.return;
        hops++;
      }
      break;
    }
  }
  return null;
}

/** A data-source / data-pp-source attribute (from a source-locator plugin), walking up. */
export function attrSource(el: Element): string | null {
  let cur: Element | null = el;
  while (cur && cur.getAttribute) {
    const v = cur.getAttribute('data-pp-source') || cur.getAttribute('data-source');
    if (v) return v;
    cur = cur.parentElement;
  }
  return null;
}

/** A stable-ish CSS selector: #id anchors where possible, else an nth-child path. */
export function stableSelector(el: Element): string {
  if (!el || !el.tagName) return '';
  if (el.id) return '#' + cssEscape(el.id);
  let path = el.tagName.toLowerCase();
  let cur: Element = el;
  let depth = 0;
  while (cur.parentElement && depth < 6) {
    const parent: HTMLElement = cur.parentElement;
    const kids: Element[] = parent.children ? Array.prototype.slice.call(parent.children) : [];
    const idx = kids.indexOf(cur) + 1;
    path = parent.tagName.toLowerCase() + ':nth-child(' + idx + ') > ' + path;
    if (parent.id) {
      path = '#' + cssEscape(parent.id) + ' > ' + path;
      break;
    }
    cur = parent;
    depth++;
  }
  return path;
}

export function textSnippet(el: Element): string {
  return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX);
}

/** Best available source hint, in priority order. May be null. */
export function resolveSource(el: Element): string | null {
  return reactSource(el) || attrSource(el) || null;
}

/** The full anchor for a pointed-at element. */
export function describeElement(el: Element): ElementAnchor {
  return {
    selector: stableSelector(el),
    tag: el && el.tagName ? el.tagName.toLowerCase() : null,
    text: textSnippet(el),
    source: resolveSource(el),
    url: typeof location !== 'undefined' ? location.pathname + location.search : '',
  };
}

/** A short human label for the anchor chip ("button: Sign up"). */
export function anchorLabel(a: ElementAnchor): string {
  const tag = a.tag || 'element';
  return a.text ? `${tag}: ${a.text.slice(0, 48)}` : tag;
}

/** A markdown block appended to the feedback description so the team (and an agent) can find the spot. */
export function formatAnchor(a: ElementAnchor): string {
  const lines = [
    '',
    '---',
    '📍 **Pinpointed element**',
    a.url ? `- URL: ${a.url}` : null,
    `- Selector: \`${a.selector}\``,
    a.text ? `- Element text: "${a.text}"` : null,
    a.source ? `- Source: ${a.source}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}
