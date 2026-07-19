import skillsCatalog from '../../../../catalog/generated/skills.json';
export const prerender = true;
export function GET() {
  const lines = ['# Foundry Skills', '', 'Versioned skills for operating the SaaS Maker Foundry.', '', ...skillsCatalog.skills.flatMap((skill) => [`## ${skill.name}`, '', skill.description, '', `[Read SKILL.md](https://github.com/sass-maker/saas-maker/blob/main/${skill.path})`, ''])];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
