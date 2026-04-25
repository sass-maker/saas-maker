"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@saas-maker/ui";
import { AlertCircle, Terminal, Clock, RefreshCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ErrorEvent {
  id: string;
  timestamp: string;
  message: string;
  severity: string;
  project_id: string;
  stack?: string;
}

export function ErrorFeed() {
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  async function fetchErrors() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/fleet/errors?limit=10");
      const data = await res.json();
      setErrors(data.errors || []);
    } catch (err) {
      console.error("Failed to load error feed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function dispatchAgent(error: ErrorEvent) {
    setDispatchingId(error.id);
    try {
      const res = await fetch("/api/fleet/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: error.project_id,
          message: error.message,
          stack: error.stack,
        }),
      });
      
      if (res.ok) {
        toast.success(`Foundry Agent dispatched to ${error.project_id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Dispatch failed");
      }
    } catch {
      toast.error("Failed to connect to Dispatch API");
    } finally {
      setDispatchingId(null);
    }
  }

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-destructive/80">
            Global Error Feed
          </CardTitle>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-destructive/50 hover:text-destructive"
          onClick={fetchErrors}
          disabled={refreshing}
        >
          <RefreshCcw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-y-auto divide-y divide-destructive/10">
          {errors.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground italic">
              No errors detected in the last 24 hours. Keep forging!
            </div>
          ) : (
            errors.map((error) => (
              <div key={error.id} className="p-4 hover:bg-destructive/10 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-mono font-bold text-destructive leading-tight break-all">
                      {error.message}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-bold text-primary/70 uppercase">
                        <Terminal className="h-3 w-3" />
                        {error.project_id || 'unknown-project'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[10px] gap-1.5 border-destructive/20 hover:bg-destructive/10 text-destructive font-bold uppercase tracking-tight"
                        onClick={() => dispatchAgent(error)}
                        disabled={dispatchingId === error.id}
                      >
                        {dispatchingId === error.id ? (
                          <RefreshCcw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3 fill-current" />
                        )}
                        {dispatchingId === error.id ? 'Dispatching...' : 'Fix with Foundry Agent'}
                      </Button>
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-[9px] h-4 px-1 leading-none uppercase shrink-0">
                    {error.severity}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
