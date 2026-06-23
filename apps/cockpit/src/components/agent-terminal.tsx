'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@saas-maker/ui';
import { Terminal, X, Loader2, ShieldCheck } from 'lucide-react';

interface AgentTerminalProps {
  jobId: string;
  projectId: string;
  onClose: () => void;
}

export function AgentTerminal({ jobId, projectId, onClose }: AgentTerminalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'running' | 'completed' | 'error'>('running');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/fleet/logs/${jobId}`);
        if (!response.ok) throw new Error();

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n').filter((l) => l.startsWith('data: '));

          lines.forEach((line) => {
            const cleanLog = line.replace('data: ', '');
            if (cleanLog.includes('[SYSTEM] Factory Agent terminated with code 0')) {
              setStatus('completed');
            } else if (cleanLog.includes('[SYSTEM] Factory Agent terminated')) {
              setStatus('error');
            }
            setLogs((prev) => [...prev, cleanLog]);
          });
        }
      } catch (_err) {
        setLogs((prev) => [...prev, 'ERR: Connection to log stream lost.']);
        setStatus('error');
      }
    };

    fetchLogs();
  }, [jobId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-3xl h-[600px] shadow-2xl border-primary/20 flex flex-col overflow-hidden">
        <CardHeader className="bg-muted/50 border-b p-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-primary/10 rounded">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-tight">
                Autonomous Agent: {projectId}
              </CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {status === 'running' ? (
                  <Badge variant="secondary" className="text-[9px] h-4 animate-pulse">
                    Processing...
                  </Badge>
                ) : status === 'completed' ? (
                  <Badge variant="success" className="text-[9px] h-4">
                    Resolved
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[9px] h-4">
                    Failed
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground font-mono">
                  Job: {jobId.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent
          ref={scrollRef}
          className="flex-1 bg-black p-4 font-mono text-[11px] leading-relaxed text-green-500 overflow-y-auto"
        >
          {logs.map((log, i) => (
            <div key={i} className="mb-1">
              <span className="text-primary opacity-50 pr-2">$</span>
              {log}
            </div>
          ))}
          {status === 'running' && (
            <div className="flex items-center gap-2 mt-2 text-white/50 italic animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              Agent is thinking...
            </div>
          )}
        </CardContent>
        {status === 'completed' && (
          <div className="bg-green-500/10 border-t border-green-500/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700 text-xs font-bold">
              <ShieldCheck className="h-4 w-4" />
              Factory Standard Restored
            </div>
            <Button size="sm" onClick={onClose}>
              Close Terminal
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function Badge({ children, variant, className }: any) {
  const colors = {
    secondary: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-500 text-white',
    destructive: 'bg-red-500 text-white',
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colors[variant as keyof typeof colors]} ${className}`}
    >
      {children}
    </span>
  );
}
