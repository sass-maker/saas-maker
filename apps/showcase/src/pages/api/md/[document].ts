export function getStaticPaths() { return [{ params: { document: '_catalog' } }]; }
import { MARKDOWN_ROUTES } from '../../../data/agentDocuments';
export const prerender = true;
export function GET() {
  return new Response(JSON.stringify(MARKDOWN_ROUTES), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
