import { getCanonicalProjectName } from './fleet-project-names';

export interface FleetComplianceChecks {
  config: boolean;
  eslint: boolean;
  tsconfig: boolean;
  prettier: boolean;
  ci: boolean;
  health: boolean;
}

export interface FleetHealthProject {
  name: string;
  slug: string;
  type: 'next' | 'vite' | 'node';
  isLegacy?: boolean;
  compliance: {
    score: number;
    total: number;
    checks: FleetComplianceChecks;
  };
}

export interface FleetCommandProject {
  slug: string;
  name: string;
  type: FleetHealthProject['type'];
  readiness: number;
  score: number;
  total: number;
  status: 'ready' | 'attention' | 'critical';
  issues: string[];
  actions: string[];
  isRegistered: boolean;
  isLegacy: boolean;
}

export interface FleetCommandCenter {
  health: {
    percentage: number;
    compliant: number;
    legacy: number;
    registered: number;
    localOnly: number;
    needsAttention: number;
    critical: number;
  };
  projects: FleetCommandProject[];
  actionDigest: string[];
}

type FleetCommandStatus = FleetCommandProject['status'];

const CHECK_LABELS: Record<keyof FleetComplianceChecks, string> = {
  config: 'Foundry config',
  eslint: 'ESLint standard',
  tsconfig: 'TypeScript config',
  prettier: 'Prettier standard',
  ci: 'GitHub Actions CI',
  health: 'Fallow health check',
};

const CHECK_ACTIONS: Record<keyof FleetComplianceChecks, string> = {
  config: 'Add foundry.json before it can be treated as a fleet unit.',
  eslint: 'Install the shared ESLint config.',
  tsconfig: 'Adopt the shared TypeScript config.',
  prettier: 'Use the shared Prettier preset.',
  ci: 'Add the standard CI workflow.',
  health: 'Run and fix fallow health checks.',
};

export function buildFleetCommandCenter(
  projects: FleetHealthProject[],
  registeredProjectSlugs: string[] = []
): FleetCommandCenter {
  const registered = new Set(registeredProjectSlugs);

  const commandProjects = projects
    .map((project) => {
      const missingChecks = Object.entries(project.compliance.checks)
        .filter(([, passed]) => !passed)
        .map(([check]) => check as keyof FleetComplianceChecks);
      const readiness = Math.round((project.compliance.score / project.compliance.total) * 100);
      const isRegistered = registered.has(project.slug);
      const issues = missingChecks.map((check) => CHECK_LABELS[check]);
      const actions = missingChecks.map((check) => CHECK_ACTIONS[check]);

      if (!isRegistered) {
        issues.push('Not registered in SaaS Maker');
        actions.push('Create or sync the project record.');
      }

      const status: FleetCommandStatus =
        readiness < 60 || !project.compliance.checks.ci
          ? 'critical'
          : issues.length > 0
            ? 'attention'
            : 'ready';

      return {
        slug: project.slug,
        name: getCanonicalProjectName(project.slug, project.name),
        type: project.type,
        readiness,
        score: project.compliance.score,
        total: project.compliance.total,
        status,
        issues,
        actions,
        isRegistered,
        isLegacy: Boolean(project.isLegacy),
      };
    })
    .sort((a, b) => {
      const statusWeight: Record<FleetCommandStatus, number> = {
        critical: 0,
        attention: 1,
        ready: 2,
      };
      return statusWeight[a.status] - statusWeight[b.status] || a.readiness - b.readiness;
    });

  const compliant = commandProjects.filter((project) => project.issues.length === 0).length;
  const legacy = commandProjects.filter((project) => project.isLegacy).length;
  const registeredCount = commandProjects.filter((project) => project.isRegistered).length;
  const needsAttention = commandProjects.filter((project) => project.status !== 'ready').length;
  const totalChecks = projects.reduce((sum, project) => sum + project.compliance.total, 0);
  const passedChecks = projects.reduce((sum, project) => sum + project.compliance.score, 0);

  return {
    health: {
      percentage: totalChecks === 0 ? 0 : Math.round((passedChecks / totalChecks) * 100),
      compliant,
      legacy,
      registered: registeredCount,
      localOnly: commandProjects.length - registeredCount,
      needsAttention,
      critical: commandProjects.filter((project) => project.status === 'critical').length,
    },
    projects: commandProjects,
    actionDigest: buildActionDigest(commandProjects),
  };
}

function buildActionDigest(projects: FleetCommandProject[]) {
  return projects
    .filter((project) => project.status !== 'ready')
    .slice(0, 5)
    .map((project) => {
      const action = project.actions[0] ?? 'Inspect the project.';
      return `${getCanonicalProjectName(project.slug, project.name)}: ${action}`;
    });
}
