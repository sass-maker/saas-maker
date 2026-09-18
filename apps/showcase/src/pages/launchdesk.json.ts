import launchdesk from '../data/launchdesk.json';

export const prerender = true;

export function GET() {
  return new Response(`${JSON.stringify(launchdesk)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
