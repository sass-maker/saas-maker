import { absoluteMarkdownLinks } from '../../../../tooling/lib/agent-surfaces/format.mjs';
import { createAgentSurfaceManifest } from '../../../../tooling/lib/agent-surfaces/manifest.mjs';
import { createAgentSurfaceHandler } from '../../../../tooling/lib/agent-surfaces/handler.mjs';
import { listMarkdownRoutes } from '../../../../tooling/lib/agent-surfaces/documents.mjs';
import { PUBLIC_ROUTES } from './publicRoutes';
import { AGENT_IDENTITY } from './agentIdentity';

export function pageMarkdown(route: (typeof PUBLIC_ROUTES)[number]) {
  const canonical = new URL(route.path, AGENT_IDENTITY.url).href;
  const lines = route.markdown.trim().split('\n');
  const title = lines[0].startsWith('# ') ? lines.shift() : `# ${route.title || route.id}`;
  const content = lines;
  return absoluteMarkdownLinks(
    `${title}\n\n> ${route.description}\n\nCanonical: ${canonical}\n${content.join('\n')}\n`,
    canonical
  );
}

export const AGENT_MANIFEST = createAgentSurfaceManifest({
  ...AGENT_IDENTITY,
  pages: Object.fromEntries(PUBLIC_ROUTES.map((route) => [route.path, pageMarkdown(route)])),
});
export const MARKDOWN_ROUTES = listMarkdownRoutes(AGENT_MANIFEST);
export const handleAgentDocument = createAgentSurfaceHandler({ manifest: AGENT_MANIFEST });
