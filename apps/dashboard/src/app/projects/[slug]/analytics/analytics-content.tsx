"use client";

import { EmptyState } from "@/components/empty-state";
import { BarChart3 } from "lucide-react";

interface AnalyticsContentProps {
  projectId: string;
}

export function AnalyticsContent({ projectId: _projectId }: AnalyticsContentProps) {
  return (
    <EmptyState
      icon={BarChart3}
      title="Analytics coming soon"
      description="Privacy-friendly page views and custom event tracking will appear here."
    />
  );
}
