/**
 * Fleet agent-surfaces kit — shared contract helpers for GEO / LLM indexing.
 *
 * Spec: fleet-ops/docs/agent-indexing-standard.md
 *
 * Zero runtime deps. Safe to import from Workers, Node, and build scripts.
 */

export {
  AGENT_PATHS,
  isAgentPath,
  markdownPathFor,
  htmlPathFromMarkdown,
  wantsMarkdown,
  isHtmlShell,
  textResponse,
  jsonResponse,
  markdownResponse,
  alternateLinkHeader,
} from './http.mjs';

export { buildLlmsTxt, buildLlmsFullIndex } from './llms.mjs';

export { buildApiAiCatalog, assertApiAiCatalog } from './catalog.mjs';

export { createAgentSurfaceHandler } from './handler.mjs';

export { createAgentSurfaceManifest } from './manifest.mjs';
