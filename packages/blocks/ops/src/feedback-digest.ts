export type FeedbackDigestSourceType = 'feedback' | 'testimonial' | 'app_store_review' | 'play_store_review';
export type FeedbackDigestPolarity = 'negative' | 'neutral' | 'positive';

export interface FeedbackDigestSignal {
  id: string;
  project_id: string;
  source_type: FeedbackDigestSourceType;
  source_id: string;
  occurred_at: string;
  channel: 'in_app' | 'app_store' | 'play_store' | 'public_page';
  title?: string | null;
  body: string;
  rating?: number | null;
  type?: 'bug' | 'feature' | 'feedback' | null;
}

export interface FeedbackDigestCluster {
  id: string;
  label: string;
  polarity: FeedbackDigestPolarity;
  severity: number;
  signal_count: number;
  summary: string;
  evidence: Array<{
    source_type: FeedbackDigestSourceType;
    source_id: string;
    excerpt: string;
  }>;
  suggested_task?: {
    title: string;
    task_type: 'bug' | 'feature' | 'research';
    priority: 'low' | 'medium' | 'high';
    draft_only: true;
  };
}

export interface FeedbackDigestRun {
  project_id: string;
  window: { start: string; end: string };
  headline: string;
  stats: {
    signal_count: number;
    positive_ratio: number;
    negative_count: number;
    neutral_count: number;
    positive_count: number;
  };
  clusters: FeedbackDigestCluster[];
  suggested_tasks: NonNullable<FeedbackDigestCluster['suggested_task']>[];
}

const BUCKETS: Array<{ label: string; keywords: RegExp; polarity: FeedbackDigestPolarity }> = [
  { label: 'Login and account access', keywords: /login|signin|sign in|oauth|account|auth|session/i, polarity: 'negative' },
  { label: 'Performance and reliability', keywords: /slow|crash|timeout|broken|error|failed|bug|lag/i, polarity: 'negative' },
  { label: 'Pricing and packaging', keywords: /price|pricing|plan|paid|billing|upgrade/i, polarity: 'neutral' },
  { label: 'Feature requests', keywords: /please add|feature|request|wish|missing|support/i, polarity: 'neutral' },
  { label: 'Positive product proof', keywords: /love|great|useful|helped|easy|fast|excellent/i, polarity: 'positive' },
];

export function buildFeedbackDigest(input: {
  projectId: string;
  window: { start: string; end: string };
  signals: FeedbackDigestSignal[];
}): FeedbackDigestRun {
  const inWindow = input.signals.filter((signal) => {
    const occurred = new Date(signal.occurred_at).getTime();
    return occurred >= new Date(input.window.start).getTime() && occurred <= new Date(input.window.end).getTime();
  });
  const deduped = dedupeSignals(inWindow);
  const clusters = clusterSignals(deduped);
  const negativeCount = deduped.filter((signal) => inferPolarity(signal) === 'negative').length;
  const positiveCount = deduped.filter((signal) => inferPolarity(signal) === 'positive').length;
  const neutralCount = Math.max(deduped.length - negativeCount - positiveCount, 0);
  const suggestedTasks = clusters.flatMap((cluster) => cluster.suggested_task ? [cluster.suggested_task] : []);

  return {
    project_id: input.projectId,
    window: input.window,
    headline: `${clusters.length} clusters from ${deduped.length} signals; ${suggestedTasks.length} draft tasks`,
    stats: {
      signal_count: deduped.length,
      positive_ratio: deduped.length ? round2(positiveCount / deduped.length) : 0,
      negative_count: negativeCount,
      neutral_count: neutralCount,
      positive_count: positiveCount,
    },
    clusters,
    suggested_tasks: suggestedTasks,
  };
}

export function buildDryRunTaskPayloads(digest: FeedbackDigestRun) {
  return digest.suggested_tasks.map((task) => ({
    title: task.title,
    task_type: task.task_type,
    priority: task.priority,
    project_slug: digest.project_id,
    draft_only: task.draft_only,
  }));
}

function clusterSignals(signals: FeedbackDigestSignal[]): FeedbackDigestCluster[] {
  const groups = new Map<string, FeedbackDigestSignal[]>();
  for (const signal of signals) {
    const bucket = BUCKETS.find((item) => item.keywords.test(`${signal.title ?? ''}\n${signal.body}`));
    const label = bucket?.label ?? (inferPolarity(signal) === 'positive' ? 'Positive product proof' : 'General feedback');
    groups.set(label, [...(groups.get(label) ?? []), signal]);
  }

  return Array.from(groups.entries()).map(([label, items], index) => {
    const polarity = inferClusterPolarity(label, items);
    const severity = inferSeverity(items, polarity);
    const cluster: FeedbackDigestCluster = {
      id: `fdc_${index + 1}`,
      label,
      polarity,
      severity,
      signal_count: items.length,
      summary: summarize(label, items),
      evidence: items.slice(0, 8).map((signal) => ({
        source_type: signal.source_type,
        source_id: signal.source_id,
        excerpt: signal.body.slice(0, 160),
      })),
    };
    if (polarity === 'negative' || label === 'Feature requests') {
      cluster.suggested_task = {
        title: `${polarity === 'negative' ? 'Fix' : 'Evaluate'} ${label.toLowerCase()} (${items.length} signals)`,
        task_type: polarity === 'negative' ? 'bug' : 'feature',
        priority: severity >= 3 ? 'high' : 'medium',
        draft_only: true,
      };
    }
    return cluster;
  });
}

function dedupeSignals(signals: FeedbackDigestSignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = normalize(signal.body);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferClusterPolarity(label: string, signals: FeedbackDigestSignal[]): FeedbackDigestPolarity {
  const bucket = BUCKETS.find((item) => item.label === label);
  if (bucket) return bucket.polarity;
  const counts = signals.reduce<Record<FeedbackDigestPolarity, number>>(
    (acc, signal) => {
      acc[inferPolarity(signal)] += 1;
      return acc;
    },
    { negative: 0, neutral: 0, positive: 0 },
  );
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as FeedbackDigestPolarity;
}

function inferPolarity(signal: FeedbackDigestSignal): FeedbackDigestPolarity {
  if (typeof signal.rating === 'number') {
    if (signal.rating <= 2) return 'negative';
    if (signal.rating >= 4) return 'positive';
  }
  if (signal.type === 'bug') return 'negative';
  if (/love|great|useful|excellent|helped/i.test(signal.body)) return 'positive';
  if (/broken|crash|error|failed|slow|cannot|can't/i.test(signal.body)) return 'negative';
  return 'neutral';
}

function inferSeverity(signals: FeedbackDigestSignal[], polarity: FeedbackDigestPolarity) {
  if (polarity === 'positive') return 1;
  const bugBoost = signals.some((signal) => signal.type === 'bug' || (signal.rating ?? 5) <= 2) ? 1 : 0;
  return Math.min(5, Math.max(2, Math.ceil(signals.length / 2) + bugBoost + (polarity === 'negative' ? 1 : 0)));
}

function summarize(label: string, signals: FeedbackDigestSignal[]) {
  const channels = Array.from(new Set(signals.map((signal) => signal.channel))).join(', ');
  return `${label} appeared in ${signals.length} signal${signals.length === 1 ? '' : 's'} across ${channels}. Originals stay linked in evidence.`;
}

function normalize(input: string) {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
