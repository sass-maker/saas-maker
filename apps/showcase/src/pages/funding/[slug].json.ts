import type { APIRoute, GetStaticPaths } from 'astro';
import { FUNDING, FUNDING_PROGRAMS } from '../../data/funding';

export const getStaticPaths: GetStaticPaths = () =>
  FUNDING_PROGRAMS.map((program) => ({ params: { slug: program.slug } }));

export const GET: APIRoute = ({ params }) => {
  const program = FUNDING_PROGRAMS.find((entry) => entry.slug === params.slug);
  if (!program) return new Response(null, { status: 404 });

  const named = Object.fromEntries(
    Object.entries(program.fields)
      .map(([key, value]) => [FUNDING.schema[key]?.name ?? key, value])
      .filter(
        ([, value]) =>
          value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
      )
  );

  return new Response(
    JSON.stringify(
      {
        slug: program.slug,
        name: program.name,
        fields: named,
        html: `/funding/${program.slug}`,
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
};
