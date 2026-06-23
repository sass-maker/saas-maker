'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/copy-button';
import { CheckCircle2, Code2, FolderPlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const STEPS = [
  { id: 1, label: 'Create project', icon: FolderPlus },
  { id: 2, label: 'Install widget', icon: Code2 },
  { id: 3, label: 'Done', icon: CheckCircle2 },
];

async function getToken(): Promise<string> {
  const res = await fetch('/api/token');
  if (!res.ok) throw new Error('Failed to get auth token');
  const data = await res.json();
  return data.token;
}

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('YOUR_KEY');

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const project = await apiFetch(
        '/v1/projects',
        {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), url: url.trim() || undefined }),
        },
        token
      );
      if (project?.apiKey) setApiKey(project.apiKey);
      else if (project?.key) setApiKey(project.key);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  const widgetSnippet = [
    '<script',
    ` src="https://cdn.sassmaker.com/widget.js" data-key="${apiKey}"`,
    '></script>',
  ].join('');

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  done
                    ? 'bg-green-500/20 text-green-400'
                    : active
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={['h-px w-6 shrink-0', done ? 'bg-green-500/50' : 'bg-border'].join(
                    ' '
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Create your first project</CardTitle>
            <CardDescription>Give your project a name to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onboard-name">Project Name</Label>
                <Input
                  id="onboard-name"
                  placeholder="My SaaS App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-url">
                  Website URL <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="onboard-url"
                  placeholder="https://myapp.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
                {loading ? 'Creating...' : 'Create Project'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Install the widget</CardTitle>
            <CardDescription>
              Paste this snippet before the closing{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;/body&gt;</code> tag of
              your site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 text-xs font-mono text-foreground break-all whitespace-pre-wrap">
                {widgetSnippet}
              </code>
              <CopyButton value={widgetSnippet} />
            </div>
            <p className="text-xs text-muted-foreground">
              Replace <code className="bg-muted px-1 rounded">YOUR_KEY</code> with your project API
              key if it wasn&apos;t auto-filled.
            </p>
            <Button className="w-full" onClick={() => setStep(3)}>
              Done — I&apos;ve added it
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card>
          <CardHeader className="flex flex-col items-center text-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">You&apos;re all set!</CardTitle>
            <CardDescription className="max-w-xs">
              Your project is live. Head to the dashboard to see feedback, changelogs, testimonials,
              and more as they roll in.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.refresh()}>Go to dashboard</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
