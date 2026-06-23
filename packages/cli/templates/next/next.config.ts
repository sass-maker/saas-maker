import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deploy via OpenNext on Cloudflare Workers.
  // For static-only Next.js apps, use output: "export" instead.
  output: "standalone",
};

export default nextConfig;
