import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// VoidZero ecosystem standard:
// - @vitejs/plugin-react-swc: SWC-based React transform (faster than Babel)
// - @tailwindcss/vite: Tailwind v4 Vite plugin (CSS-first config, no tailwind.config.ts)
// - Lightning CSS: Rust-based CSS transformer + minifier (replaces PostCSS)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: {
    transformer: "lightningcss",
    lightningcss: {
      drafts: { customMedia: true },
    },
  },
  build: {
    cssMinify: "lightningcss",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
