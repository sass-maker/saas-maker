'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { apiFetchClient, getClientToken } from '@/lib/api-client';

interface WaitlistActionsProps {
  entryId: string;
  projectId: string;
}

export function WaitlistActions({ entryId, projectId }: WaitlistActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Remove this entry from the waitlist?')) return;
    setDeleting(true);
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/waitlist/${entryId}?project_id=${projectId}`, token, {
        method: 'DELETE',
      });
      router.refresh();
    } catch (e) {
      console.error('Failed to delete waitlist entry:', e);
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={deleting}
      className="h-8 w-8"
    >
      {deleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}
