'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';

interface Project {
  slug: string; name: string; framework: string; db: string;
  auth: string; deploy: string; test_frameworks: string;
  saasmaker_count: number; foundry_linked: number; last_scanned: string;
}

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
  'CF': 'bg-orange-950 text-orange-300',
  'Vercel': 'bg-slate-800 text-slate-200',
  'Vitest': 'bg-yellow-950 text-yellow-300',
  'PW': 'bg-cyan-950 text-cyan-300',
};

function Pill({ label }: { label: string }) {
  const color = Object.entries(BADGE_COLORS).find(([k]) => label.includes(k))?.[1] ?? 'bg-gray-800 text-gray-300';
  return <span className={cn('inline-block rounded px-1.5 py-0.5 text-xs font-medium mr-1 mb-1', color)}>{label}</span>;
}

function Pills({ value }: { value: string }) {
  if (!value || value === '-') return <span className="text-gray-600 text-xs">—</span>;
  return <>{value.split('+').map(v => <Pill key={v} label={v.trim()} />)}</>;
}

export function FleetMatrix({ projects }: { projects: Project[] }) {
  const [search, setSearch] = useState('');
  const visibleProjects = visibleDashboardProjects(projects);
  const filtered = visibleProjects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.framework.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Filter projects..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Project','Framework','DB','Auth','Deploy','Tests','SM','Foundry'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-sm">
                No projects found. Run <code className="bg-muted px-1 rounded">fnd fleet scan</code> first.
              </td></tr>
            )}
            {filtered.map((p, i) => (
              <tr key={p.slug} className={cn('border-b border-border/50 hover:bg-muted/20 transition-colors', i % 2 === 0 ? '' : 'bg-muted/10')}>
                <td className="px-3 py-2.5 font-medium text-white">{p.name}</td>
                <td className="px-3 py-2.5"><Pills value={p.framework} /></td>
                <td className="px-3 py-2.5"><Pills value={p.db} /></td>
                <td className="px-3 py-2.5"><Pills value={p.auth} /></td>
                <td className="px-3 py-2.5"><Pills value={p.deploy} /></td>
                <td className="px-3 py-2.5"><Pills value={p.test_frameworks} /></td>
                <td className="px-3 py-2.5 text-center">
                  {p.saasmaker_count > 0
                    ? <span className="text-emerald-400 font-medium">{p.saasmaker_count}</span>
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {p.foundry_linked
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                    : <XCircle className="h-4 w-4 text-gray-600 mx-auto" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {visibleProjects.length} projects · Last scan: {visibleProjects[0]?.last_scanned ? new Date(visibleProjects[0].last_scanned).toLocaleDateString() : 'never'}
      </p>
    </div>
  );
}
