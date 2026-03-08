"use client";

import { AnalyticsDashboard } from "@saas-maker/analytics-ui";

export function AnalyticsWrapper({ apiKey }: { apiKey: string }) {
  return <AnalyticsDashboard apiKey={apiKey} />;
}
