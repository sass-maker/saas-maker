import ideasData from './ideas.json';

export type Idea = {
  adj: number;
  best_bet: boolean;
  best_bet_why: string;
  c: number;
  customer: 'b2b-tech' | 'dev' | 'non-dev';
  f: number;
  f_feas: number;
  f_feas_why: string;
  fun: number;
  idea: string;
  m: number;
  m_eff: number;
  money: number;
  source: string;
  t: number;
};

export const IDEAS = (ideasData as Idea[]).filter((idea) => idea.source !== 'starterstory');

export function ideaTitle(idea: Idea): string {
  const bold = idea.idea.trim().match(/^\*\*(.+?)\*\*/);
  if (bold) return bold[1].replace(/\.+$/, '');
  const plain = idea.idea.replace(/[`*[\]()]/g, ' ');
  return plain.split(/\.\s/)[0].trim().replace(/\.+$/, '');
}

export function ideaSlug(idea: Idea, index: number): string {
  const base = ideaTitle(idea)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return base || `idea-${index}`;
}

// Deduplicate slugs deterministically in catalog order.
const seen = new Set<string>();
export const IDEA_ENTRIES = IDEAS.map((idea, index) => {
  let slug = ideaSlug(idea, index);
  while (seen.has(slug)) slug = `${slug}-${index}`;
  seen.add(slug);
  return { idea, slug, index };
});
