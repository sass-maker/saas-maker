/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  experimental: { useLightningcss: true },
};

module.exports = nextConfig;
