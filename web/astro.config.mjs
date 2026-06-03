import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// For GitHub Pages deploys at https://sarthakagrawal927.github.io/psi-swarm/
// set ASTRO_BASE=/psi-swarm/ in the build env. Default '/' for local dev.
const base = process.env.ASTRO_BASE || '/';

export default defineConfig({
  base,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    port: 4321,
  },
});
