import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// VoidZero ecosystem standard for content/marketing/landing surfaces:
// - Astro: island architecture, zero JS by default, fast LCP
// - @tailwindcss/vite: Tailwind v4 (CSS-first config, no tailwind.config.ts)
// - Lightning CSS: Rust-based CSS transformer + minifier
// - inlineStylesheets: "always" — flat-inlines per-page CSS for fastest LCP
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    css: {
      transformer: "lightningcss",
      lightningcss: {
        drafts: { customMedia: true },
      },
    },
    build: {
      cssMinify: "lightningcss",
    },
  },
  build: {
    inlineStylesheets: "always",
  },
});
