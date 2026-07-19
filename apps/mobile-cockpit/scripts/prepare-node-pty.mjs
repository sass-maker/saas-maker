import { chmodSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

if (process.platform !== "win32") {
  const requireFromBridge = createRequire(
    new URL("../packages/bridge/package.json", import.meta.url),
  );
  const packageRoot = dirname(
    requireFromBridge.resolve("node-pty/package.json"),
  );
  const helper = join(
    packageRoot,
    "prebuilds",
    `${process.platform}-${process.arch}`,
    "spawn-helper",
  );
  if (existsSync(helper)) {
    chmodSync(helper, statSync(helper).mode | 0o111);
  }
}
