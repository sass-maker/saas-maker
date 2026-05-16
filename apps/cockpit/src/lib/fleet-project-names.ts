type ProjectIdentity = {
  name?: string | null;
  slug?: string | null;
};

export const ACTIVE_FLEET_PROJECTS = {
  anime_list: { name: "MAL Explorer" },
  CodeVetter: { name: "CodeVetter" },
  "email-manager": { name: "Email Manager" },
  "free-ai": { name: "Free AI Gateway" },
  "high-signal": { name: "High Signal" },
  linkchat: { name: "Linkchat" },
  looptv: { name: "LoopTV" },
  "open-historia": { name: "Open Historia" },
  reader: { name: "Reader" },
  "resume-tailor": { name: "RolePatch" },
  "saas-maker": { name: "SaaS Maker" },
  significanthobbies: { name: "Significant Hobbies" },
  starboard: { name: "Starboard" },
  "swe-interview-prep": { name: "Interview Coder" },
  "today-little-log": { name: "Today Little Log" },
  truehire: { name: "TrueHire" },
} as const;

export type ActiveFleetProjectSlug = keyof typeof ACTIVE_FLEET_PROJECTS;

export const HIDDEN_FLEET_PROJECT_ALIASES = new Set([
  "a",
  "back-propogate",
  "back-propagate",
  "chess",
  "clash royale meta",
  "clash-royale-meta",
  "dev learning",
  "dev_learning",
  "dev-learning",
  "ludo",
  "personal site",
  "personalsite",
  "port-whisperer",
  "reel maker",
  "reel-maker",
  "sarthak blog",
  "sarthak-blog",
  "vaulthealth",
]);

function normalizeIdentity(value?: string | null) {
  return value?.trim().toLowerCase();
}

export function isHiddenFleetProject(project: ProjectIdentity) {
  const name = normalizeIdentity(project.name);
  const slug = normalizeIdentity(project.slug);

  return (
    (name !== undefined && HIDDEN_FLEET_PROJECT_ALIASES.has(name)) ||
    (slug !== undefined && HIDDEN_FLEET_PROJECT_ALIASES.has(slug))
  );
}

export function getCanonicalProjectName(slug?: string | null, fallback?: string | null) {
  if (slug && slug in ACTIVE_FLEET_PROJECTS) {
    return ACTIVE_FLEET_PROJECTS[slug as ActiveFleetProjectSlug].name;
  }

  return fallback?.trim() || slug?.trim() || "Unassigned";
}

export function formatProjectLabel(slug?: string | null) {
  if (!slug) return "Unassigned";
  const name = getCanonicalProjectName(slug);
  return name === slug ? slug : `${name} (${slug})`;
}

export function sortProjectSlugs(slugs: string[]) {
  return [...slugs].sort((a, b) => {
    const labelA = getCanonicalProjectName(a);
    const labelB = getCanonicalProjectName(b);
    return labelA.localeCompare(labelB) || a.localeCompare(b);
  });
}
