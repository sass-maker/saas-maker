/** Adapt our compiled, self-contained browser entry for legacy classic script tags. */
export function classicBrowserBundle(bundle: string): string {
  const source = bundle.replace(/\nexport \{[^{}]*\};?\s*$/u, '');
  // Module imports or extra exports indicate a changed build contract. Fail closed.
  // Syntax validation also catches accidental scope collisions during composition.
  new Function(source);
  return source;
}
