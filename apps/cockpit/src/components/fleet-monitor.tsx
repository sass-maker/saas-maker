"use client";

import { useEffect, useState } from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Badge 
} from "@saas-maker/ui";
import { Laptop, AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck, Zap, Activity } from "lucide-react";
import Link from "next/link";

interface FleetProject {
  name: string;
  path: string;
  slug: string;
  type: 'next' | 'vite' | 'node';
  isLegacy: boolean;
  lastModified: string;
  compliance: {
    score: number;
    total: number;
    checks: {
      config: boolean;
      eslint: boolean;
      tsconfig: boolean;
      prettier: boolean;
      ci: boolean;
      health: boolean;
    }
  }
}

interface FleetHealth {
  percentage: number;
  compliant: number;
  legacy: number;
}

export function FleetMonitor() {
  const [fleet, setFleet] = useState<FleetProject[]>([]);
  const [health, setHealth] = useState<FleetHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function scanFleet() {
      try {
        const res = await fetch("/api/fleet/scan");
        if (!res.ok) throw new Error("Failed to scan local fleet");
        const data = await res.json();
        setFleet(data.fleet || []);
        setHealth(data.health);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scanner unavailable");
      } finally {
        setLoading(false);
      }
    }
    scanFleet();
  }, []);

  if (loading) return null;
  if (error) return null;

  return (
    <div className="space-y-6">
      {/* Fleet Health Summary */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary/70">Compliance Rate</CardTitle>
                <div className="text-2xl font-bold">{health.percentage}%</div>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary/40" />
            </CardHeader>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-600/70">Fully Compliant</CardTitle>
                <div className="text-2xl font-bold">{health.compliant}</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500/40" />
            </CardHeader>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-yellow-600/70">Legacy Units</CardTitle>
                <div className="text-2xl font-bold">{health.legacy}</div>
              </div>
              <AlertTriangle className="h-5 w-5 text-yellow-500/40" />
            </CardHeader>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Active Units</h2>
          <Badge variant="outline" className="ml-auto font-mono text-[10px]">
            {fleet.length} units detected
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fleet.map((project) => (
            <Card key={project.path} className="group transition-all hover:border-primary/50">
              <CardHeader className="p-4 pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-bold truncate leading-tight">{project.name}</CardTitle>
                    <CardDescription className="text-[10px] font-mono truncate opacity-60">
                      {project.slug}
                    </CardDescription>
                  </div>
                  <Badge variant={project.isLegacy ? "secondary" : "default"} className="capitalize text-[9px] px-1.5 py-0 shrink-0 ml-2">
                    {project.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Factory Score</span>
                    <span className="text-[10px] font-mono">{project.compliance.score}/{project.compliance.total}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {Object.entries(project.compliance.checks).map(([key, val]) => (
                      <div 
                        key={key} 
                        className={`h-1 flex-1 rounded-full ${val ? 'bg-green-500' : 'bg-muted'}`}
                        title={`${key}: ${val ? 'Pass' : 'Fail'}`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                   <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                     {project.isLegacy ? (
                       <Zap className="h-2.5 w-2.5 text-yellow-500" />
                     ) : (
                       <ShieldCheck className="h-2.5 w-2.5 text-green-500" />
                     )}
                     {project.isLegacy ? "Legacy" : "Standard"}
                   </span>
                   <Link 
                     href={`/projects/${project.slug}`}
                     className="text-[11px] font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                   >
                     Inspect <ArrowRight className="h-3 w-3" />
                   </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
