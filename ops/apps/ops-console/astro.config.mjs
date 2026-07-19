import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  build: {
    inlineStylesheets: "always"
  },
  vite: {
    preview: {
      allowedHosts: ["fleet.sassmaker.com"]
    }
  }
});
