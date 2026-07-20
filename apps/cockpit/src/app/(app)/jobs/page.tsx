'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from '@foundry/ui';
import { PageHeader } from '@/components/page-header';
import { Bot, Clock, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface FoundryJob {
  id: string;
  project_id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
  created_at: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<FoundryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function loadJobs() {
    try {
      const token = await getClientToken();
      const res = await apiFetchClient<{ data: FoundryJob[] }>('/v1/jobs', token);
      setJobs(res.data || []);
      setLoadError(false);
    } catch (err) {
      console.error('[jobs] failed to load agent activity', err);
      // Only surface a toast on the first failure — background polling that
      // fails transiently shouldn't spam the user.
      setLoadError((prev) => {
        if (!prev) toast.error('Failed to load agent activity');
        return true;
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 30000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Activity"
        description="Audit log of all autonomous factory tasks and self-healing events."
      />

      <div className="grid gap-4">
        {loading ? (
          <div className="p-12 text-center animate-pulse text-muted-foreground">
            Loading activity log...
          </div>
        ) : loadError && jobs.length === 0 ? (
          <Card className="border-dashed border-red-500/30">
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <XCircle className="h-6 w-6 text-red-500" />
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load agent activity. Check your connection and try again.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  loadJobs();
                }}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : jobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground italic">
              No autonomous activity recorded. Dispatched agents will appear here.
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id} className="group hover:border-primary/30 transition-all">
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-md ${
                      job.status === 'completed'
                        ? 'bg-green-500/10 text-green-500'
                        : job.status === 'failed'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-blue-500/10 text-blue-500'
                    }`}
                  >
                    {job.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : job.status === 'failed' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-bold uppercase tracking-tight">
                        {job.type}: {job.project_id}
                      </CardTitle>
                      <Badge variant="secondary" className="text-[9px] h-4">
                        ID: {job.id.slice(0, 8)}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs font-mono line-clamp-1">
                      {job.message || 'Autonomous maintenance task'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">
                      Started
                    </div>
                    <div className="text-xs flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(job.created_at))} ago
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Card className="bg-muted/30 border-muted">
        <CardContent className="p-4 flex items-center gap-3 text-xs text-muted-foreground">
          <Bot className="h-4 w-4" />
          <span>
            Factory workers are managed via the{' '}
            <code className="text-primary">fnd fleet supervise</code> daemon.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
