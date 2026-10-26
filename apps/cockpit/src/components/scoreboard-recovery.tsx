'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { readWorkspaceStore } from '@/lib/scoreboard-storage';
import { parseWorkspace } from '@/lib/scoreboard';

/** Export-only bridge. Portfolio editing is owned by the local Site Health app. */
export function ScoreboardRecovery({ accountId }: { accountId: string }) {
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);

  async function exportBackup() {
    setExporting(true);
    setMessage('');
    try {
      const { raw } = await readWorkspaceStore(`saasmaker.scoreboard.v1:${accountId}`);
      if (!raw) {
        setMessage('No previous portfolio workspace was found in this browser and account.');
        return;
      }
      // Validate without rewriting the stored backup or losing any original fields.
      parseWorkspace(raw);
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `saasmaker-portfolio-recovery-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage('Backup exported. Import it in Site Health → Readiness, then verify its history.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The previous workspace could not be exported.'
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5 p-6" aria-labelledby="portfolio-recovery-title">
      <p className="text-sm font-medium text-muted-foreground">Previous portfolio workspace</p>
      <h1 id="portfolio-recovery-title" className="text-2xl font-semibold tracking-tight">
        Portfolio readiness now lives in Site Health
      </h1>
      <p className="text-muted-foreground">
        Your private checklist, scores, evidence and review history belong in your local owner
        dashboard. This page only exports the previous workspace saved in this browser and signed-in
        account.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={exportBackup} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export previous workspace'}
        </Button>
        <Button variant="outline" asChild>
          <a href="http://127.0.0.1:4321/readiness">Open local Site Health</a>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        The original workspace stays here as a recovery copy. Nothing is uploaded or deleted.
      </p>
      <p role="status" className="text-sm">
        {message}
      </p>
    </section>
  );
}
