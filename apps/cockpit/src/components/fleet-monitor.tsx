"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Laptop, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
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
    }
  }
}

export function FleetMonitor() {
  const [fleet, setFleet] = useState<FleetProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function scanFleet() {
      try {
        const res = await fetch("/api/fleet/scan");
        if (!res.ok) throw new Error("Failed to scan local fleet");
        const data = await res.json();
        setFleet(data.fleet || []);
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Laptop className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Local Fleet</h2>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          {fleet.length} detected
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fleet.map((project) => (
          <Card key={project.path} className="group transition-all hover:border-primary/50">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base font-bold">{project.name}</CardTitle>
                  <CardDescription className="text-[10px] font-mono truncate max-w-[180px]">
                    {project.slug}
                  </CardDescription>
                </div>
                <Badge variant={project.isLegacy ? "warning" : "secondary"} className="capitalize">
                  {project.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Standard Compliance</span>
                  <span className="text-[10px] font-mono">{project.compliance.score}/{project.compliance.total}</span>
                </div>
                <div className="flex gap-1">
                  {Object.entries(project.compliance.checks).map(([key, val]) => (
                    <div 
                      key={key} 
                      className={`h-1.5 flex-1 rounded-full ${val ? 'bg-success' : 'bg-muted'}`}
                      title={`${key}: ${val ? 'Pass' : 'Fail'}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                 <span className="text-[10px] text-muted-foreground">
                   {project.isLegacy ? "Legacy Config" : "Foundry Standard"}
                 </span>
                 <Link 
                   href={`/projects/${project.slug}`}
                   className="text-xs font-medium text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                 >
                   Open <ArrowRight className="h-3 w-3" />
                 </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
