const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isLocalHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith('[')) {
    return host.startsWith('[::1]');
  }
  return LOCAL_HOSTS.has(host.split(':')[0] ?? '');
}

export function isLocalAuthBypassEnabled(hostHeader: string | null | undefined): boolean {
  if (process.env.LOCAL_AUTH_BYPASS === 'true') return true;
  return isLocalHost(hostHeader) && process.env.DISABLE_LOCAL_AUTH_BYPASS !== 'true';
}
