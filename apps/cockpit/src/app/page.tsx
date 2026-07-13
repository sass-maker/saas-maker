import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { isLocalAuthBypassEnabled } from '@/lib/local-auth';

export const metadata: Metadata = {
  title: 'SaaS Maker Cockpit',
  description:
    'Sign in to manage SaaS Maker projects, fleet health, tasks, feedback, changelogs, testimonials, and roadmap work.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Astro owns anon GET `/` in production (landing-astro overlay + run_worker_first).
 * This route is only a fallback when a request reaches OpenNext.
 */
export default async function HomePage() {
  const requestHeaders = await headers();
  if (isLocalAuthBypassEnabled(requestHeaders.get('host'))) {
    redirect('/tasks');
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session?.user) {
    redirect('/tasks');
  }

  redirect('/login');
}
