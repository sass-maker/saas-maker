import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

initOpenNextCloudflareForDev();

const projectRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(projectRoot, '../..');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ['@saas-maker/ui'],
  reactCompiler: true,
  turbopack: {
    root: workspaceRoot,
  },
  images: { unoptimized: true },
};

export default nextConfig;
