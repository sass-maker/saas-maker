import { defineConfig } from "blume";

export default defineConfig({
  title: "Reel Pipeline",
  description:
    "AI reel generation and autopost orchestration for fleet products.",
  content: {
    root: "docs",
  },
  search: {
    provider: "orama",
  },
  ai: {
    llmsTxt: true,
  },
  seo: {
    og: { enabled: true },
    sitemap: true,
    robots: true,
  },
  deployment: {
    output: "static",
  },
});
