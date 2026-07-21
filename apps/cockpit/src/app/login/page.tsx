import { MessageSquareText } from 'lucide-react';

import { GoogleSignInButton } from '@/components/google-sign-in-button';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquareText className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">SaaS Maker</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Feedback inbox</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Review customer requests and manage the project keys used by the feedback package.
        </p>
        <div className="mt-8">
          <GoogleSignInButton />
        </div>
      </section>
    </main>
  );
}
