'use client';

import type { AgentTokenRecord } from '@saas-maker/contracts';
import { useState, type FormEvent } from 'react';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { SkeletonContainer } from '@saas-maker/ui/components/skeleton';
import { useApiResource } from '@/components/cockpit-resources';
import { ResourceView } from '@/components/resource-view';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiFetchClient, getClientToken } from '@/lib/api-client';

interface ProjectCredentialsProps {
  projectId: string;
  projectKey: string;
}

export function ProjectCredentials({ projectId, projectKey }: ProjectCredentialsProps) {
  const [name, setName] = useState('Inbox agent');
  const [canWrite, setCanWrite] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resource = useApiResource<{ data: AgentTokenRecord[] }>(
    `/v1/projects/${projectId}/agent-tokens`,
    { isEmpty: (result) => (result.data ?? []).length === 0 }
  );

  async function createToken(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const session = await getClientToken();
      const created = await apiFetchClient<AgentTokenRecord & { token: string }>(
        `/v1/projects/${projectId}/agent-tokens`,
        session,
        {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), can_write: canWrite }),
        }
      );
      setPlaintext(created.token);
      // Keep the one-time plaintext token outside the resource cache.
      const { token: _plaintext, ...record } = created;
      resource.mutate((current) => ({ data: [record, ...(current?.data ?? [])] }));
      void resource.retry();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create agent token');
    }
  }

  async function revokeToken(tokenId: string) {
    setError(null);
    try {
      const session = await getClientToken();
      await apiFetchClient(`/v1/projects/${projectId}/agent-tokens/${tokenId}`, session, {
        method: 'DELETE',
      });
      resource.mutate((current) => ({
        data: (current?.data ?? []).filter((item) => item.id !== tokenId),
      }));
      void resource.retry();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to revoke token');
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-medium">Project key</h2>
        <p className="text-sm text-muted-foreground">
          Publishable identifier for hosted widget submissions. It cannot read the inbox.
        </p>
        <div className="mt-2 flex items-start gap-2">
          <code className="flex-1 break-all rounded-md border bg-muted/40 p-2 text-xs">
            {projectKey}
          </code>
          <CopyButton value={projectKey} label="Copy key" />
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div>
          <h2 className="text-sm font-medium">Agent tokens</h2>
          <p className="text-sm text-muted-foreground">
            Scoped Bearer tokens for the same JSON API. New tokens are read-only unless write access
            is enabled.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-3" onSubmit={createToken}>
          <div className="grid gap-1">
            <Label htmlFor="agent-token-name">Name</Label>
            <Input
              id="agent-token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-56"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={canWrite} onCheckedChange={setCanWrite} />
            Allow status updates
          </label>
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Create token
          </Button>
        </form>
        {plaintext ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <code className="flex-1 break-all text-xs">{plaintext}</code>
            <CopyButton value={plaintext} label="Copy token" />
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <ResourceView
          resource={resource}
          skeleton={
            <SkeletonContainer>
              <Skeleton className="h-8 w-full max-w-56" />
            </SkeletonContainer>
          }
          empty={
            <EmptyState className="items-start px-0 py-0 text-left" title="no agent tokens yet" />
          }
        >
          {(result) => (
            <ul className="space-y-2">
              {(result.data ?? []).map((token) => (
                <li key={token.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {token.name} · {token.token_prefix}… ·{' '}
                    {token.can_write ? 'read/write' : 'read-only'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void revokeToken(token.id)}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ResourceView>
      </div>
    </section>
  );
}
