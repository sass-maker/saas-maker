'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { ScoreboardWorkbench } from '@/components/scoreboard-workbench';
import {
  importSnapshot,
  addAssessmentHistory,
  MAX_WORKSPACE_BYTES,
  parseWorkspace,
  type ScoreWorkspace,
} from '@/lib/scoreboard';
import { readWorkspaceStore, writeWorkspaceStore } from '@/lib/scoreboard-storage';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'The workspace could not be updated.';

function saveFile(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProductScoreboard({ accountId }: { accountId: string }) {
  const storageKey = `saasmaker.scoreboard.v1:${accountId}`;
  const [workspace, setWorkspace] = useState<ScoreWorkspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  const [pending, setPending] = useState<ScoreWorkspace | null>(null);
  const [pendingBackup, setPendingBackup] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await readWorkspaceStore(storageKey);
        if (cancelled) return;
        if (!stored.available) {
          setSaved(false);
          setError(
            'History storage is unavailable. A readable legacy copy may be older; export this tab before closing and retry storage.'
          );
        }
        if (stored.raw) setWorkspace(parseWorkspace(stored.raw));
      } catch (e) {
        if (!cancelled)
          setError(`Saved workspace was preserved but could not be opened: ${errorText(e)}`);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    const refresh = async () => {
      if (!saved) {
        setError('Another tab changed this workspace. Export this tab before reloading.');
        return;
      }
      try {
        const stored = await readWorkspaceStore(storageKey);
        if (!stored.available) {
          setSaved(false);
          throw new Error(
            'History storage is unavailable. Current tab data was preserved; export it before reloading.'
          );
        }
        if (stored.raw) setWorkspace(parseWorkspace(stored.raw));
      } catch (e) {
        setError(errorText(e));
      }
    };
    const receive = (event: StorageEvent) => {
      if (event.key === `${storageKey}:changed`) void refresh();
      else if (event.key === storageKey && event.newValue)
        setError(
          'An older tab changed its legacy copy. Export that tab and import its backup here to reconcile it; score history was preserved.'
        );
    };
    const channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('saasmaker-scoreboard');
    if (channel)
      channel.onmessage = (event) => {
        if (event.data === storageKey) void refresh();
      };
    window.addEventListener('storage', receive);
    return () => {
      window.removeEventListener('storage', receive);
      channel?.close();
    };
  }, [storageKey, saved]);

  async function persist(next: ScoreWorkspace) {
    setError('');
    try {
      if (!saved)
        throw new Error('Export this unsaved tab before reloading to recover history storage.');
      await writeWorkspaceStore(storageKey, next);
      setSaved(true);
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('saasmaker-scoreboard');
        channel.postMessage(storageKey);
        channel.close();
      }
    } catch (e) {
      setSaved(false);
      setError(`Changes are only in this tab. Export a backup now: ${errorText(e)}`);
    }
    setWorkspace(next);
  }
  async function updateWorkspace(
    fn: (current: ScoreWorkspace | null) => ScoreWorkspace,
    replaceInvalid = false
  ) {
    const update = async () => {
      try {
        const stored = saved
          ? await readWorkspaceStore(storageKey)
          : { raw: null, available: true };
        if (!stored.available) {
          setSaved(false);
          throw new Error(
            'History storage is unavailable. Current tab data was preserved; export it before retrying.'
          );
        }
        const { raw } = stored;
        let current = workspace;
        if (raw) {
          try {
            current = parseWorkspace(raw);
          } catch (e) {
            if (!replaceInvalid) throw e;
          }
        }
        const next = fn(current);
        if (new Blob([JSON.stringify(next, null, 2)]).size > MAX_WORKSPACE_BYTES)
          throw new Error(
            'This update would exceed the 64 MB backup limit. Export your history before starting a new workspace.'
          );
        await persist(next);
      } catch (e) {
        setError(errorText(e));
      }
    };
    if (navigator.locks) await navigator.locks.request(storageKey, update);
    else await update();
  }
  function change(fn: (current: ScoreWorkspace) => ScoreWorkspace) {
    void updateWorkspace((current) => {
      if (!current) throw new Error('Import a review first.');
      return fn(current);
    });
  }
  async function readImport(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_WORKSPACE_BYTES) throw new Error('Import is too large (maximum 64 MB).');
      const text = await file.text();
      const incoming = parseWorkspace(text);
      setPendingBackup('snapshot' in JSON.parse(text));
      const { raw } = await readWorkspaceStore(storageKey);
      if (workspace || raw) setPending(incoming);
      else await updateWorkspace((current) => importSnapshot(current, incoming));
    } catch (e) {
      setError(`Import rejected; existing data was preserved. ${errorText(e)}`);
    }
    if (input.current) input.current.value = '';
  }

  return (
    <div data-clarity-mask="true">
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Import private scoreboard"
        onChange={(e) => void readImport(e.target.files?.[0])}
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {pending && (
        <section
          className="mb-5 space-y-3 rounded-lg border border-primary/50 p-4"
          aria-label="Review import"
        >
          <h2 className="font-semibold">Import {pending.snapshot.label}?</h2>
          <p className="text-sm text-muted-foreground">
            {pending.snapshot.projects.length} products · {pending.snapshot.levers.length}{' '}
            recommendations. A baseline update keeps score history and matching progress. “Add to
            score history only” retains the current scores and lever progress. Restoring a backup or
            replacing the workspace replaces current progress; export it first if needed.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void updateWorkspace(
                  (current) => (pendingBackup ? pending : importSnapshot(current, pending)),
                  true
                );
                setPending(null);
              }}
            >
              {pendingBackup ? 'Restore backup' : 'Import and keep history'}
            </Button>
            {!pendingBackup && (
              <Button
                variant="outline"
                onClick={() => {
                  void updateWorkspace(() => pending, true);
                  setPending(null);
                }}
              >
                Replace workspace
              </Button>
            )}
            {workspace && (
              <Button
                variant="outline"
                onClick={() => {
                  void updateWorkspace((current) => {
                    if (!current) throw new Error('Import a current review first.');
                    return addAssessmentHistory(current, pending);
                  });
                  setPending(null);
                }}
              >
                Add to score history only
              </Button>
            )}
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}
      {!loaded ? (
        <p role="status">Opening your saved scoreboard…</p>
      ) : workspace ? (
        <ScoreboardWorkbench
          workspace={workspace}
          onChange={change}
          onImport={() => input.current?.click()}
          onExport={() =>
            saveFile(
              `saasmaker-scoreboard-${new Date().toISOString().slice(0, 10)}.json`,
              workspace
            )
          }
          saved={saved}
        />
      ) : (
        <div className="space-y-6">
          <PageHeader
            title="Product scoreboard"
            description="Compare the scores. Choose one useful change."
          />
          <section className="rounded-lg border border-border bg-card p-6 sm:p-10">
            <Badge variant="outline">Private owner workspace</Badge>
            <h2 className="mt-4 text-2xl font-semibold">
              Bring the review. Pick the next useful change.
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Import your review to compare six scores per product, inspect the evidence and pick
              the next lever. Your progress and outcomes stay with the review on this device.
            </p>
            <Button className="mt-6" onClick={() => input.current?.click()}>
              <Upload />
              Import review
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              No review data is uploaded. Export a backup to move devices or preserve your work.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
