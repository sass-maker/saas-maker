import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://domains.sassmaker.com',
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
