import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = new URL("..", import.meta.url).pathname;
const distRoot = process.env.FLEET_OPS_CONSOLE_DIST ?? join(projectRoot, "dist");
const html = readFileSync(join(distRoot, "index.html"), "utf8");

mkdirSync(join(distRoot, "server"), { recursive: true });

writeFileSync(
  join(distRoot, "server", "index.js"),
  `const html = ${JSON.stringify(html)};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=120"
      }
    });
  }
};
`,
);

console.log("built Sites worker: dist/server/index.js");
