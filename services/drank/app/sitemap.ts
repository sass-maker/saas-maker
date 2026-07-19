import type { MetadataRoute } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-static';

const siteUrl = 'https://domains.sassmaker.com';

type GlobalDrFile = {
  lastUpdated?: string;
  domains?: Record<string, unknown>;
};

function loadDomainList(): string[] {
  try {
    const path = join(process.cwd(), 'data/global-dr.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as GlobalDrFile;
    return Object.keys(data.domains ?? {});
  } catch {
    try {
      const path = join(process.cwd(), 'data/global-sites.json');
      const data = JSON.parse(readFileSync(path, 'utf8')) as string[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const domains = loadDomainList();

  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/data`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/llms.txt`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/index.md`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.4,
    },
  ];

  // Homepage is the full tracker; domains are hash/query deep-links on the same
  // surface when the UI supports them. Emit domain anchors as query URLs so
  // Search Console sees a large, stable inventory of tracked properties.
  for (const domain of domains) {
    entries.push({
      url: `${siteUrl}/?domain=${encodeURIComponent(domain)}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    });
  }

  return entries;
}
