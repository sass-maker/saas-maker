import source from '../../../../packages/widgets/feedback-widget/dist/browser/launcher.global.js?raw';

export function GET() {
  return new Response(source, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      'Content-Type': 'text/javascript; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
