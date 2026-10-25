import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getLocalDevSession, isLocalAuthBypassEnabled } from '@/lib/local-auth';

/** Reuse the session lookup across the authenticated layout and its page in one request. */
export const getDashboardSession = cache(async () => {
  const requestHeaders = await headers();
  return isLocalAuthBypassEnabled(requestHeaders.get('host'))
    ? getLocalDevSession()
    : auth.api.getSession({ headers: requestHeaders });
});
