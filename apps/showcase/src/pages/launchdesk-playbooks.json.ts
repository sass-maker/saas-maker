export const prerender = true;

const modules = import.meta.glob('../data/launchdesk-playbooks/*.json', {
  eager: true,
});

const playbooks = Object.entries(modules)
  .map(([path, mod]) => {
    const p = (mod as { default?: Record<string, unknown> }).default ?? {};
    return {
      domain: p.domain,
      name: p.name,
      zeroCostRoute: p.zeroCostRoute,
      category: p.category ?? null,
      grade: p.grade,
      retrieved: p.retrieved,
      playbookJson: `https://sassmaker.com/launchdesk/${p.domain}.json`,
      playbookPage: `https://sassmaker.com/launchdesk/${p.domain}`,
      file: path.replace('../data/', 'apps/showcase/src/data/'),
    };
  })
  .filter((p) => p.domain)
  .sort((a, b) => String(a.domain).localeCompare(String(b.domain)));

export function GET() {
  const index = {
    $schema: 'fleet.launchkit-playbook-index.v1',
    schema: 'fleet.launchdesk-playbook.v1',
    count: playbooks.length,
    playbooks,
  };
  return new Response(`${JSON.stringify(index, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
