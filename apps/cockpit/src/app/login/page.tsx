import { SaaSMakerMark } from '@/components/saas-maker-mark';
import Link from 'next/link';

import { GoogleSignInButton } from '@/components/google-sign-in-button';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <SaaSMakerMark large className="mb-8" />
        <p className="text-sm font-medium text-muted-foreground">SaaS Maker</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">SaaS Maker workspace</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Manage customer feedback or create the project key that powers the hosted widget. You can
          browse the public product directory before signing in.
        </p>
        <p className="mt-3 text-sm">
          <Link className="underline underline-offset-4" href="https://sassmaker.com/projects">
            Browse products
          </Link>
        </p>
        <div className="mt-8">
          <GoogleSignInButton />
        </div>
      </section>
    </main>
  );
}
