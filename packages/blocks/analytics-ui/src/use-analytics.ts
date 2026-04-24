import { useState, useEffect } from 'react';

export type Period = 'today' | '7d' | '30d' | '90d' | 'all';

export interface DashboardSummary {
  page_views: number;
  unique_visitors: number;
  bounce_rate: number;
  avg_session_pages: number;
  bot_count: number;
  bot_percentage: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  timeseries: { date: string; views: number; visitors: number }[];
  pages: { pathname: string; views: number }[];
  referrers: { referrer: string; count: number }[];
  countries: { country: string; count: number }[];
  devices: { device: string; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
  events: { name: string; count: number }[];
  bots: { name: string; count: number }[];
}

const DEFAULT_API_BASE = 'https://api.sassmaker.com';

export function useAnalytics(apiKey: string, period: Period, apiBaseUrl?: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = apiBaseUrl ?? DEFAULT_API_BASE;

    setLoading(true);
    setError(null);

    fetch(`${base}/v1/analytics/dashboard?period=${period}`, {
      headers: { 'X-Project-Key': apiKey },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, period, apiBaseUrl]);

  return { loading, error, data };
}
