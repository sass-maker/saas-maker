import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

initOpenNextCloudflareForDev();

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@saas-maker/ui'],
  reactCompiler: true,
  turbopack: {
    root: projectRoot,
  },
  images: { unoptimized: true },
};

export default nextConfig;
