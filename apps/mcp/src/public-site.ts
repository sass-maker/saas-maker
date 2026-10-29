import { HOSTED_ROUTES } from "./hosted.js";
import { createAgentSurfaceManifest } from "./agent-surfaces/manifest.mjs";
import { createAgentSurfaceHandler } from "./agent-surfaces/handler.mjs";

const ROUTE_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "/personal-apps/mcp": "Personal apps",
  "/anime-list/mcp": "Anime list",
  "/anime-list-public/mcp": "Public anime list",
};

export interface LandingRow {
  path: string;
  name: string;
  description: string;
  endpoint: string;
  audience: "personal" | "public";
  status: "live" | "prepared";
}

export function landingRows(): LandingRow[] {
  return Object.entries(HOSTED_ROUTES).map(([path, route]) => {
    const name = ROUTE_DISPLAY_NAMES[path] ?? (route.kind === "adapter" ? route.app.name : route.serverName);
    const description =
      route.kind === "adapter"
        ? route.app.instructions.split(/(?<=[.!?])\s/)[0] ?? route.app.instructions
        : `Read-only MCP connection proxied to ${new URL(route.upstreamUrl).hostname}.`;
    return {
      path,
      name,
      description,
      endpoint: `https://${route.hosts[0]}${path}`,
      audience: route.audience,
      status: route.productionStatus === "prepared" ? "prepared" : "live",
    };
  });
}

export const publicCopy = {
  name: "ChatGPT Connections",
  title: "ChatGPT Connections — SaaS Maker MCP endpoints",
  summary: "Hosted read-only MCP connections for ChatGPT and other MCP clients: the list of active endpoints, their audiences, and status.",
  intro: "Each endpoint below is a hosted MCP server for one Fleet product. Add its URL to ChatGPT and it can **read** from that product. It cannot save, edit or delete anything. **Public** endpoints need no account. **Owner sign-in** endpoints are the owner's personal connectors.",
  steps: [
    { title: "Copy an endpoint", body: "Pick a product from the directory and copy its full URL, ending in `/mcp`." },
    { title: "Add it to ChatGPT", body: "Create a custom connector in ChatGPT, or in any MCP client, and paste the URL." },
    { title: "Ask, and it reads", body: "Public endpoints answer right away. Owner sign-in endpoints ask the product to confirm it's the owner first." },
  ],
  boundaries: [
    { title: "No writes", body: "No tool can save, edit, share or delete product data." },
    { title: "No admin surfaces", body: "Operator controls and raw databases stay out of reach." },
    { title: "No private fields", body: "Responses are sanitized to each product's approved read contract." },
    { title: "No shared credentials", body: "ChatGPT never receives a product API key or a shared application token." },
  ],
};

const excludedPaths = ['/admin', '/auth', '/dashboard', '/oauth', '/api', ...Object.keys(HOSTED_ROUTES)];
function homepageMarkdown(origin: string) {
  const rows = landingRows();
  const publicRows = rows.filter((row) => row.audience === 'public');
  const personalRows = rows.filter((row) => row.audience === 'personal');
  const group = (title: string, items: LandingRow[]) => [
    `## ${title}`, '',
    ...[...items.filter((row) => row.status === 'live'), ...items.filter((row) => row.status !== 'live')].flatMap((row) => [
      `### ${row.name}`, '', row.description, '',
      `Endpoint: ${row.endpoint}`, `Status: ${row.status === 'live' ? 'Live' : 'Prepared'}`,
      `Access: ${row.audience === 'public' ? 'Public' : 'Owner sign-in'}`, '',
    ]),
  ];
  return [
    `# ${publicCopy.title}`, '', `> ${publicCopy.summary}`, '', `Canonical: ${origin}/`, '',
    '## Connect ChatGPT to your Fleet apps.', '', publicCopy.intro, '',
    `${rows.length} endpoints · ${rows.filter((row) => row.status === 'live').length} live · ${publicRows.length} public · ${personalRows.length} owner sign-in · 0 write tools`, '',
    '## Request path', '',
    'ChatGPT → ChatGPT Connections (Cloudflare Worker) → Fleet products. MCP · read-only tools.', '',
    'Example question: What did High Signal flag today? The question is an example, not a recorded conversation.', '',
    'Public: Anonymous. Reads only approved public APIs or exports.',
    "Owner sign-in: The owner's sign-in is verified before any product data is read.", '',
    '## How to connect', '',
    ...publicCopy.steps.flatMap((step, i) => [`### ${i + 1}. ${step.title}`, '', step.body, '']),
    'Every route is fixed in code: one product, one hostname, one approved read contract. Prepared routes exist in code but are not live yet.', '',
    ...group('Public · no account', publicRows),
    ...group('Owner sign-in · personal connectors', personalRows),
    '## Built to read. Nothing else.', '',
    ...publicCopy.boundaries.flatMap((item) => [`### ${item.title}`, '', item.body, '']),
    '## Related', '', `- [Connection directory](${origin}/#directory)`, `- [How to connect](${origin}/#how)`, '',
  ].join('\n');
}

const handlers = new Map<string, ReturnType<typeof createAgentSurfaceHandler>>();
export async function handlePublicDocument(request: Request): Promise<Response | null> {
  const origin = new URL(request.url).origin;
  let handler = handlers.get(origin);
  if (!handler) {
    const manifest = createAgentSurfaceManifest({
      name: publicCopy.name, url: origin, summary: publicCopy.summary,
      contact: 'https://github.com/sass-maker/chatgpt-connections/issues',
      updatedAt: '2026-10-26', trainingAllowed: true, excludedPaths,
      sitemap: `${origin}/sitemap.xml`, pages: { '/': homepageMarkdown(origin) },
    });
    handler = createAgentSurfaceHandler({ manifest });
    // Hosts are normally the finite hosted-route set; bound local/test aliases too.
    if (handlers.size >= 64) handlers.clear();
    handlers.set(origin, handler);
  }
  return handler(request);
}

const robotsAgents = ['*', 'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider'];
export function publicRobots(request: Request): Response {
  const origin = new URL(request.url).origin;
  const body = ['# Keep in sync with /llms.txt and /ai.txt.', '', ...robotsAgents.flatMap((agent) => [
    `User-agent: ${agent}`, 'Allow: /', ...excludedPaths.map((path) => `Disallow: ${path}`), 'Allow: /api/ai$', 'Allow: /api/md/', '',
  ]), `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
  return new Response(request.method === 'HEAD' ? null : body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
export function publicSitemap(request: Request): Response {
  const origin = new URL(request.url).origin;
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`;
  return new Response(request.method === 'HEAD' ? null : body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
