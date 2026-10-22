'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { ScoreboardWorkbench } from '@/components/scoreboard-workbench';
import {
  importSnapshot,
  parseWorkspace,
  readScoreboardStorage,
  type ScoreWorkspace,
} from '@/lib/scoreboard';

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
    try {
      const stored = readScoreboardStorage(() => localStorage.getItem(storageKey));
      if (!stored.available) {
        setSaved(false);
        setError(
          'Browser storage is unavailable. You can import a review and export this tab before closing it.'
        );
      }
      if (stored.raw) setWorkspace(parseWorkspace(stored.raw));
    } catch (e) {
      setError(`Saved workspace was preserved but could not be opened: ${errorText(e)}`);
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      if (!saved) {
        setError('Another tab changed this workspace. Export this tab before reloading.');
        return;
      }
      try {
        setWorkspace(parseWorkspace(event.newValue));
      } catch (e) {
        setError(errorText(e));
      }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [storageKey, saved]);

  function persist(next: ScoreWorkspace) {
    setError('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(true);
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
    const update = () => {
      try {
        const { raw } = readScoreboardStorage(() =>
          saved ? localStorage.getItem(storageKey) : null
        );
        let current = workspace;
        if (raw) {
          try {
            current = parseWorkspace(raw);
          } catch (e) {
            if (!replaceInvalid) throw e;
          }
        }
        persist(fn(current));
      } catch (e) {
        setError(errorText(e));
      }
    };
    if (navigator.locks) await navigator.locks.request(storageKey, update);
    else update();
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
      if (file.size > 8_000_000) throw new Error('Import is too large (maximum 8 MB).');
      const text = await file.text();
      const incoming = parseWorkspace(text);
      setPendingBackup('snapshot' in JSON.parse(text));
      const { raw } = readScoreboardStorage(() => localStorage.getItem(storageKey));
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
            recommendations. A baseline update keeps history and matching progress. Restoring a
            backup or replacing the workspace replaces current progress; export it first if needed.
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
