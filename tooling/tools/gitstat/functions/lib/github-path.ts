const GITHUB_ORIGIN = 'https://api.github.com'

export function githubRestUrl(path: string | null): string | null {
  if (!path?.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(path)) return null

  const url = new URL(path, GITHUB_ORIGIN)
  if (url.origin !== GITHUB_ORIGIN || url.username || url.password || url.port || url.hash) return null
  return url.href
}
