import { isIP } from 'node:net';

export function appHealthMonitoringManifests(catalog) {
  const projects = [];
  const journeys = [];
  const identities = new Set();
  for (const project of catalog.projects) {
    if (project.lifecycle?.portfolioStatus !== 'active') continue;
    const id = project.id;
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id) || identities.has(id))
      throw new Error(`Invalid or duplicate monitoring project: ${id}`);
    identities.add(id);
    const policy = project.systems?.probe;
    if (!policy) throw new Error(`Missing monitoring policy: ${id}`);
    const names = new Set();
    if (policy.absent !== undefined) {
      if (!['local', 'private'].includes(policy.scope) || !policy.absent.trim())
        throw new Error(`Monitoring exemption needs local/private scope and reason: ${id}`);
      if (policy.journeys !== undefined)
        throw new Error(`Monitoring exemption cannot also declare public journeys: ${id}`);
    } else {
      if (!Array.isArray(policy.journeys) || !policy.journeys.length || policy.journeys.length > 10)
        throw new Error(`Monitoring needs one to ten public journeys: ${id}`);
      for (const journey of policy.journeys) {
        if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(journey.journey) || names.has(journey.journey))
          throw new Error(`Invalid or duplicate monitoring journey: ${id}`);
        const allowed = ['journey', 'url', 'budget_ms', 'timeout_ms', 'warm_check', 'expect'];
        if (Object.keys(journey).some((key) => !allowed.includes(key)))
          throw new Error(`Monitoring journeys must be credential-free GET requests: ${id}`);
        const url = new URL(journey.url);
        if (
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          isIP(url.hostname) ||
          !url.hostname.includes('.') ||
          /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)
        )
          throw new Error(`Monitoring journey needs a public HTTPS hostname: ${id}`);
        names.add(journey.journey);
        journeys.push({ project: id, ...journey });
      }
    }
    projects.push({
      catalog_id: id,
      name: project.identity?.publicName ?? project.name,
      scope: policy.absent === undefined ? 'public' : policy.scope,
      reason: policy.absent ?? policy.coverageReason ?? null,
      journeys: [...names],
    });
  }
  if (!projects.length || projects.length > 60)
    throw new Error('Monitoring roster must contain one to sixty active projects');
  return {
    coverage: { schema_version: 1, projects },
    probes: {
      schema_version: 1,
      generated_from:
        'site-health/catalog/projects.json projects[].systems.probe (pnpm catalog:sync)',
      purpose: catalog.systems?.probeJourneys?.purpose,
      source_issue: catalog.systems?.probeJourneys?.sourceIssue,
      journeys,
    },
  };
}
