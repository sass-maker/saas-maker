import { publicMcpCatalog } from '../data/publicMcpCatalog';

export const prerender = true;

export function GET() {
  return new Response(JSON.stringify(publicMcpCatalog), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
