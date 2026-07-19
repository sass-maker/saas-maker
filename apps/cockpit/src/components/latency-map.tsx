'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@foundry/ui';
import { Activity, Terminal, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LatencyMetric {
  project_id: string;
  trace_name: string;
  avg_duration_ms: number;
  p95_duration_ms: number;
  count: number;
}

export function LatencyMap() {
  const [metrics, setMetrics] = useState<LatencyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchLatency() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/fleet/latency');
      const data = await res.json();
      setMetrics(data.latency || []);
    } catch (_err) {
      console.error('Failed to load latency map');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchLatency();
    const interval = setInterval(fetchLatency, 60000);
    return () => clearInterval(interval);
  }, [fetchLatency]);

  if (loading) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary/80">
            Fleet Latency Map
          </CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-primary/50 hover:text-primary"
          onClick={fetchLatency}
          disabled={refreshing}
        >
          <RefreshCcw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-y-auto divide-y divide-primary/10">
          {metrics.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground italic">
              No performance traces recorded recently. Keep building!
            </div>
          ) : (
            metrics.map((metric, idx) => (
              <div
                key={`${metric.project_id}-${metric.trace_name}-${idx}`}
                className="p-4 hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-mono font-bold text-foreground leading-tight truncate max-w-[200px]">
                      {metric.trace_name}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-bold text-primary/70 uppercase">
                        <Terminal className="h-3 w-3" />
                        {metric.project_id}
                      </span>
                      <span>{metric.count} requests</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={metric.avg_duration_ms > 1000 ? 'destructive' : 'secondary'}
                      className="font-mono text-[10px] tabular-nums"
                    >
                      ~{metric.avg_duration_ms}ms
                    </Badge>
                    <p className="text-[9px] text-muted-foreground font-mono mt-1 pr-1">
                      p95: {metric.p95_duration_ms}ms
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
