/**
 * Bounded synthetic API probe runner.
 * Only GET/HEAD against catalog-declared surfaces. Schedules stay inert until host approval.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateProbeSegment, percentileSet } from './performance-evidence.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const SAFE_METHODS = new Set(['GET', 'HEAD']);

export async function loadPerformanceSurfaces(catalogPath = path.join(REPO_ROOT, 'catalog/generated/performance-surfaces.json')) {
  const raw = JSON.parse(await readFile(catalogPath, 'utf8'));
  const surfaces = [];
  for (const project of raw.projects ?? []) {
    for (const surface of project.surfaces ?? []) {
      if (surface.kind === 'api') surfaces.push({ ...surface, projectName: project.name });
    }
  }
  return { policy: raw.policy, surfaces };
}

function assertSafeSurface(surface) {
  const method = String(surface.method ?? 'GET').toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    throw new Error(`refusing unsafe method ${method} for surface ${surface.id}`);
  }
  if (typeof surface.url !== 'string' || !surface.url.startsWith('https://')) {
    throw new Error(`surface ${surface.id} must use https URL`);
  }
  if (surface.url.includes('?')) {
    throw new Error(`surface ${surface.id} URL must not include query strings`);
  }
  return method;
}

/**
 * Probe a single URL. phases unavailable are left undefined (not zero).
 */
export async function probeOnce(url, { method = 'GET', timeoutMs = 10_000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  let status = null;
  let ok = false;
  let timedOut = false;
  let errorCode = null;
  let ttfb = null;
  try {
    const response = await fetchImpl(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'foundry-synthetic-probe/1.0' },
    });
    status = response.status;
    ok = response.ok;
    ttfb = performance.now() - started;
    // Drain body without retaining it.
    await response.arrayBuffer().catch(() => undefined);
  } catch (error) {
    timedOut = error?.name === 'AbortError';
    errorCode = timedOut ? 'timeout' : 'network_error';
    ok = false;
  } finally {
    clearTimeout(timer);
  }
  const total = performance.now() - started;
  return {
    ok,
    status,
    timedOut,
    errorCode,
    timingsMs: {
      // DNS/connect/TLS are unavailable in plain fetch; mark by omission.
      ttfb: ttfb == null ? undefined : Number(ttfb.toFixed(3)),
      total: Number(total.toFixed(3)),
    },
  };
}

export async function runSurfaceProbe(surface, options = {}) {
  const method = assertSafeSurface(surface);
  const coldSamples = options.coldSamples ?? 5;
  const warmSamples = options.warmSamples ?? 15;
  const timeoutMs = surface.timeoutMs ?? options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const expected = new Set(surface.expectedStatuses ?? [200]);

  const cold = [];
  for (let i = 0; i < coldSamples; i++) {
    cold.push(await probeOnce(surface.url, { method, timeoutMs, fetchImpl }));
  }

  const warm = [];
  // Bounded concurrency warm pool
  let index = 0;
  async function worker() {
    while (index < warmSamples) {
      const i = index++;
      warm[i] = await probeOnce(surface.url, { method, timeoutMs, fetchImpl });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, warmSamples) }, () => worker()));

  const annotate = (samples, mode) =>
    samples.map((sample) => ({
      ...sample,
      ok: sample.ok && expected.has(sample.status),
      probeMode: mode,
    }));

  const coldSeg = aggregateProbeSegment(annotate(cold, 'cold'));
  const warmSeg = aggregateProbeSegment(annotate(warm, 'warm'));
  const all = [...cold, ...warm];
  const totals = all.map((s) => s.timingsMs?.total).filter((v) => typeof v === 'number');
  const errorCount = all.filter((s) => !(s.ok && expected.has(s.status))).length;

  const observedAt = new Date().toISOString();
  const receipt = {
    schema_version: 1,
    idempotency_key: `synthetic-api:${surface.id}:${observedAt.slice(0, 13)}`,
    project_id: surface.projectId,
    kind: 'api',
    surface: surface.id,
    environment: options.environment ?? 'production',
    source: 'synthetic-api',
    revision: options.revision ?? null,
    window_start: observedAt,
    window_end: observedAt,
    sample_count: all.length,
    error_count: errorCount,
    sampling_rate: 1,
    probe_mode: 'mixed',
    method,
    route_template: new URL(surface.url).pathname,
    latency_ms: percentileSet(totals),
    phases: {
      ttfb: coldSeg.timings.ttfb,
      total: coldSeg.timings.total,
      dns: coldSeg.timings.dns,
      connect: coldSeg.timings.connect,
      tls: coldSeg.timings.tls,
    },
    diagnostic_ref: null,
  };

  return {
    surfaceId: surface.id,
    projectId: surface.projectId,
    cold: coldSeg,
    warm: warmSeg,
    receipt,
    probeOrigin: options.probeOrigin ?? 'local-ops',
  };
}

export async function runCatalogApiProbes(options = {}) {
  const { policy, surfaces } = await loadPerformanceSurfaces(options.catalogPath);
  if (policy?.synthetic?.schedulesActive && !options.force) {
    // schedulesActive true is blocked by catalog validation; still guard here.
    throw new Error('synthetic schedules are active — refusing dual-run without --force');
  }
  if (policy?.synthetic?.schedulesActive === false && options.requireActive) {
    throw new Error('schedules remain inert; pass requireActive:false for manual runs');
  }

  const selected = options.only
    ? surfaces.filter((s) => options.only.includes(s.id) || options.only.includes(s.projectId))
    : surfaces;

  const results = [];
  for (const surface of selected) {
    results.push(
      await runSurfaceProbe(surface, {
        coldSamples: policy?.synthetic?.api?.coldSamples ?? 5,
        warmSamples: policy?.synthetic?.api?.warmSamples ?? 15,
        ...options,
      })
    );
  }
  return { policy, results };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('api-probe-runner.mjs')) {
  const onlyArg = process.argv.find((a, i) => process.argv[i - 1] === '--only');
  const fixture = process.argv.includes('--fixture');
  if (fixture) {
    const fakeFetch = async () =>
      new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
    const demo = await runSurfaceProbe(
      {
        id: 'demo-api',
        projectId: 'saas-maker',
        url: 'https://api.sassmaker.com/health',
        method: 'GET',
        expectedStatuses: [200],
        timeoutMs: 5000,
      },
      { coldSamples: 2, warmSamples: 3, fetchImpl: fakeFetch }
    );
    console.log(JSON.stringify(demo, null, 2));
  } else {
    const out = await runCatalogApiProbes({
      only: onlyArg ? onlyArg.split(',') : undefined,
      coldSamples: 1,
      warmSamples: 1,
    });
    console.log(JSON.stringify({ count: out.results.length, results: out.results }, null, 2));
  }
}
