'use client';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search, CheckCircle2, XCircle, SlidersHorizontal, ShieldCheck, ShieldAlert, EyeOff, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACTIVE_FLEET_PROJECTS,
  getActiveFleetProjectDetails,
  getCanonicalProjectName,
  isActiveFleetProject,
} from '@/lib/fleet-project-names';

interface Project {
  slug: string; name: string; framework: string; db: string;
  framework_version: string | null;
  auth: string; deploy: string; test_frameworks: string;
  saasmaker_count: number; foundry_linked: number; last_scanned: string;
}

type BaselineStatus = 'on-baseline' | 'review' | 'unknown' | 'manual';
type SortKey = 'name' | 'framework' | 'last-scanned' | 'external-deps';

const FRAMEWORK_BASELINES: Record<string, { label: string; major?: number; note: string }> = {
  'Next.js': { label: 'Next.js 16', major: 16, note: 'Fleet LTS baseline' },
  Vite: { label: 'Vite 8', major: 8, note: 'Fleet LTS baseline' },
  Astro: { label: 'Astro 5', major: 5, note: 'Fleet LTS baseline' },
  Node: { label: 'Node 24 LTS', major: 24, note: 'Fleet runtime baseline' },
  Remotion: { label: 'Manual review', note: 'No fleet LTS baseline tracked' },
};

const BADGE_COLORS: Record<string, string> = {
  'Next.js': 'bg-black border border-white/20 text-white',
  'Vite': 'bg-purple-950 text-purple-300',
  'Astro': 'bg-orange-950 text-orange-300',
  'Remotion': 'bg-pink-950 text-pink-300',
  'Turso': 'bg-emerald-950 text-emerald-300',
  'Drizzle': 'bg-emerald-900 text-emerald-200',
  'Firebase': 'bg-amber-950 text-amber-300',
  'NextAuth': 'bg-blue-950 text-blue-300',
  'BetterAuth': 'bg-violet-950 text-violet-300',
  'PostHog': 'bg-fuchsia-950 text-fuchsia-300',
  'Google': 'bg-blue-950 text-blue-300',
  'GitHub': 'bg-slate-800 text-slate-200',
  'OpenAI': 'bg-teal-950 text-teal-300',
  'Anthropic': 'bg-zinc-800 text-zinc-200',
  'Gemini': 'bg-blue-950 text-blue-300',
  'Cloudflare': 'bg-orange-950 text-orange-300',
  'Workers AI': 'bg-orange-950 text-orange-300',
  'free-ai': 'bg-emerald-950 text-emerald-300',
  'YouTube': 'bg-red-950 text-red-300',
  'Gmail': 'bg-red-950 text-red-300',
};

function Pill({ label }: { label: string }) {
  const color = Object.entries(BADGE_COLORS).find(([k]) => label.includes(k))?.[1] ?? 'bg-gray-800 text-gray-300';
  return <span className={cn('inline-block rounded px-1.5 py-0.5 text-xs font-medium mr-1 mb-1', color)}>{label}</span>;
}

function splitLabels(value: string | null | undefined) {
  if (!value || value === '-') return [];
  return value.split('+').map((label) => label.trim()).filter(Boolean);
}

function Pills({ value }: { value: string }) {
  const labels = splitLabels(value);
  if (labels.length === 0) return <span className="text-gray-600 text-xs">—</span>;
  return <>{labels.map(v => <Pill key={v} label={v} />)}</>;
}

function getPrimaryFramework(project: Project) {
  return splitLabels(project.framework)[0] ?? 'Unknown';
}

function getProjectDetails(project: Project) {
  return getActiveFleetProjectDetails(project) ?? getActiveFleetProjectDetails({ slug: project.slug });
}

function getExternalDependencies(project: Project) {
  const details = getProjectDetails(project);
  if (details) return [...details.externalDeps];

  return Array.from(new Set([...splitLabels(project.db), ...splitLabels(project.auth)]));
}

function getFrameworkVersion(project: Project) {
  const version = project.framework_version?.trim();
  if (version && version !== project.framework) return version;
  return getPrimaryFramework(project);
}

function getFrameworkMajor(project: Project) {
  const version = getFrameworkVersion(project);
  const match = version.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function getBaseline(project: Project): {
  status: BaselineStatus;
  label: string;
  detail: string;
  className: string;
} {
  const framework = getPrimaryFramework(project);
  const baseline = FRAMEWORK_BASELINES[framework];

  if (!baseline) {
    return {
      status: 'manual',
      label: 'Track manually',
      detail: 'No baseline configured',
      className: 'border-slate-700 bg-slate-900/60 text-slate-300',
    };
  }

  if (!baseline.major) {
    return {
      status: 'manual',
      label: baseline.label,
      detail: baseline.note,
      className: 'border-cyan-900 bg-cyan-950/40 text-cyan-300',
    };
  }

  const major = getFrameworkMajor(project);
  if (!major) {
    return {
      status: 'unknown',
      label: 'Version unknown',
      detail: baseline.label,
      className: 'border-yellow-900 bg-yellow-950/30 text-yellow-300',
    };
  }

  if (major >= baseline.major) {
    return {
      status: 'on-baseline',
      label: 'On baseline',
      detail: baseline.label,
      className: 'border-emerald-900 bg-emerald-950/40 text-emerald-300',
    };
  }

  return {
    status: 'review',
    label: 'Review upgrade',
    detail: baseline.label,
    className: 'border-amber-900 bg-amber-950/40 text-amber-300',
  };
}

function sortProjects(projects: Project[], sortKey: SortKey) {
  return [...projects].sort((a, b) => {
    if (sortKey === 'framework') {
      return getPrimaryFramework(a).localeCompare(getPrimaryFramework(b)) || a.name.localeCompare(b.name);
    }
    if (sortKey === 'last-scanned') {
      return new Date(b.last_scanned || 0).getTime() - new Date(a.last_scanned || 0).getTime();
    }
    if (sortKey === 'external-deps') {
      return getExternalDependencies(b).length - getExternalDependencies(a).length || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}

function getLastScanned(projects: Project[]) {
  const latest = projects.reduce((latestSeen, project) => {
    const scannedAt = new Date(project.last_scanned || 0).getTime();
    return Number.isFinite(scannedAt) && scannedAt > latestSeen ? scannedAt : latestSeen;
  }, 0);

  return latest ? new Date(latest).toISOString().slice(0, 10) : 'never';
}

function normalizeRepoUrl(url: string) {
  const match = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (!match) return url;
  return `https://github.com/${match[1]}/${match[2]}`;
}

function emptyManifestProject(slug: string): Project {
  const details = getActiveFleetProjectDetails({ slug });

  return {
    slug,
    name: details?.name ?? slug,
    framework: '-',
    framework_version: null,
    db: '-',
    auth: '-',
    deploy: '?',
    test_frameworks: '-',
    saasmaker_count: 0,
    foundry_linked: 0,
    last_scanned: '',
  };
}

export function FleetMatrix({ projects }: { projects: Project[] }) {
  const [search, setSearch] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState('all');
  const [baselineFilter, setBaselineFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [showHidden, setShowHidden] = useState(false);

  const activeProjects = useMemo(() => {
    const projectsBySlug = new Map(projects.map((project) => [project.slug.toLowerCase(), project]));

    return Object.keys(ACTIVE_FLEET_PROJECTS).map((slug) => {
      const scannedProject = projectsBySlug.get(slug.toLowerCase());
      const project = scannedProject ?? emptyManifestProject(slug);

      return {
        ...project,
        slug,
        name: getCanonicalProjectName(slug, project.name),
      };
    });
  }, [projects]);

  const scannedExtras = useMemo(() => {
    return projects
      .filter((project) => !isActiveFleetProject(project))
      .map((project) => ({ ...project, name: project.name || project.slug }));
  }, [projects]);

  const managedProjects = showHidden ? [...activeProjects, ...scannedExtras] : activeProjects;
  const hiddenCount = scannedExtras.length;

  const frameworkOptions = useMemo(() => {
    return Array.from(new Set(managedProjects.map(getPrimaryFramework))).sort((a, b) => a.localeCompare(b));
  }, [managedProjects]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return sortProjects(
      managedProjects.filter((project) => {
        const baseline = getBaseline(project);
        const fields = [
          project.name,
          project.slug,
          getProjectDetails(project)?.desc ?? '',
          getProjectDetails(project)?.tier ?? '',
          getProjectDetails(project)?.url ?? '',
          getExternalDependencies(project).join(' '),
          project.framework,
          project.framework_version ?? '',
        ].join(' ').toLowerCase();

        if (query && !fields.includes(query)) return false;
        if (frameworkFilter !== 'all' && getPrimaryFramework(project) !== frameworkFilter) return false;
        if (baselineFilter !== 'all' && baseline.status !== baselineFilter) return false;
        return true;
      }),
      sortKey
    );
  }, [baselineFilter, frameworkFilter, managedProjects, search, sortKey]);

  const baselineCounts = useMemo(() => {
    return managedProjects.reduce<Record<BaselineStatus, number>>(
      (counts, project) => {
        counts[getBaseline(project).status] += 1;
        return counts;
      },
      { 'on-baseline': 0, review: 0, unknown: 0, manual: 0 }
    );
  }, [managedProjects]);

  const tierCounts = useMemo(() => {
    return managedProjects.reduce<Record<string, number>>((counts, project) => {
      const tier = getProjectDetails(project)?.tier ?? 'unregistered';
      counts[tier] = (counts[tier] ?? 0) + 1;
      return counts;
    }, {});
  }, [managedProjects]);

  const externalDependencyCount = useMemo(() => {
    return new Set(managedProjects.flatMap(getExternalDependencies)).size;
  }, [managedProjects]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Managed projects</div>
          <div className="mt-2 text-2xl font-semibold text-white">{managedProjects.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {showHidden ? `${hiddenCount} scanned extras included` : `${hiddenCount} scanned extras excluded`}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            LTS baseline
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">{baselineCounts['on-baseline']}</div>
          <div className="mt-1 text-xs text-muted-foreground">Projects at or above fleet target</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            Needs review
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">{baselineCounts.review + baselineCounts.unknown}</div>
          <div className="mt-1 text-xs text-muted-foreground">Upgrade or version scan required</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">External deps</div>
          <div className="mt-2 text-2xl font-semibold text-white">{externalDependencyCount}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(tierCounts).map(([tier, count]) => (
              <Badge key={tier} variant="outline" className="border-border bg-background/40 text-xs">
                {tier} {count}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/10 p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Project list
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_12rem_12rem_12rem_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter projects..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All frameworks</SelectItem>
              {frameworkOptions.map((framework) => (
                <SelectItem key={framework} value={framework}>{framework}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={baselineFilter} onValueChange={setBaselineFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Baseline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All baselines</SelectItem>
              <SelectItem value="on-baseline">On baseline</SelectItem>
              <SelectItem value="review">Review upgrade</SelectItem>
              <SelectItem value="unknown">Version unknown</SelectItem>
              <SelectItem value="manual">Manual tracking</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="framework">Framework</SelectItem>
              <SelectItem value="last-scanned">Last scanned</SelectItem>
              <SelectItem value="external-deps">External deps</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="show-hidden-projects" className="whitespace-nowrap text-xs text-muted-foreground">
              Include extras
            </Label>
            <Switch id="show-hidden-projects" size="sm" checked={showHidden} onCheckedChange={setShowHidden} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Project','Framework','LTS','External dependencies','Foundry'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No projects found. Run <code className="rounded bg-muted px-1">fnd fleet scan</code> first.
                </td></tr>
              )}
            {filtered.map((project, i) => {
              const baseline = getBaseline(project);
              const details = getProjectDetails(project);
              const repoUrl = details?.url ? normalizeRepoUrl(details.url) : null;
              const externalDeps = getExternalDependencies(project);

              return (
                <tr key={project.slug} className={cn('border-b border-border/50 hover:bg-muted/20 transition-colors', i % 2 === 0 ? '' : 'bg-muted/10')}>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{project.name}</span>
                      {details?.tier ? (
                        <Badge variant="outline" className="border-border bg-background/40 text-xs">
                          {details.tier}
                        </Badge>
                      ) : null}
                    </div>
                    {details?.desc ? (
                      <div className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{details.desc}</div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{project.slug}</span>
                      {repoUrl ? (
                        <a
                          href={repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Repo
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </td>
                    <td className="px-3 py-2.5">
                      <div><Pills value={project.framework} /></div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{getFrameworkVersion(project)}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn('whitespace-nowrap text-xs', baseline.className)}>
                        {baseline.label}
                      </Badge>
                      <div className="mt-1 text-xs text-muted-foreground">{baseline.detail}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {externalDeps.length > 0 ? (
                        <div className="flex max-w-xl flex-wrap gap-1">
                          {externalDeps.map((dependency) => (
                            <Pill key={dependency} label={dependency} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None detected</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {project.foundry_linked
                        ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-400" />
                        : <XCircle className="mx-auto h-4 w-4 text-gray-600" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {managedProjects.length} projects · Last scan: {getLastScanned(managedProjects)}
      </p>
    </div>
  );
}
