"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Terminal, Clock, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    fetchErrors();
    // Refresh every minute
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
                  <div className="space-y-1">
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
                  </div>
                  <Badge variant="destructive" className="text-[9px] h-4 px-1 leading-none uppercase">
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
