#!/usr/bin/env node
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { discoverRepositories } from "./discover.js";
import { BridgeServer } from "./server.js";
import {
  assertTailscaleHost,
  disableTailscaleServe,
  enableTailscaleServe,
} from "./tailscale.js";

function configArgument(args: string[]): string {
  const index = args.indexOf("--config");
  if (index < 0 || !args[index + 1])
    throw new Error("Usage: mobile-dev-cockpit-bridge --config <path>");
  return resolve(process.env.INIT_CWD ?? process.cwd(), args[index + 1]);
}

try {
  const args = process.argv
    .slice(2)
    .filter((argument, index) => !(argument === "--" && index === 0));
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Mobile Dev Cockpit bridge

Usage:
  mobile-dev-cockpit-bridge --config <path> [--tailscale]
  mobile-dev-cockpit-bridge discover --root <path> [--root <path>]
  mobile-dev-cockpit-bridge tailscale-off

Options:
  --tailscale      Publish the loopback bridge privately with Tailscale Serve
  -h, --help       Show this help
  -V, --version    Show the bridge version`);
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-V")) {
    console.log("0.1.0");
    process.exit(0);
  }
  if (args[0] === "discover") {
    const roots = args.flatMap((argument, index) =>
      argument === "--root" && args[index + 1]
        ? [resolve(process.env.INIT_CWD ?? process.cwd(), args[index + 1]!)]
        : [],
    );
    if (!roots.length)
      throw new Error(
        "Usage: mobile-dev-cockpit-bridge discover --root <path> [--root <path>]",
      );
    console.log(
      JSON.stringify({ projects: discoverRepositories(roots) }, null, 2),
    );
    process.exit(0);
  }
  if (args[0] === "tailscale-off") {
    disableTailscaleServe();
    console.log("Disabled Tailscale Serve path /mobile-dev-cockpit");
    process.exit(0);
  }
  const configPath = configArgument(args);
  const config = loadConfig(configPath);
  if (args.includes("--tailscale")) assertTailscaleHost(config.host);
  const server = new BridgeServer(config);
  const port = await server.listen();
  console.log(
    `Mobile Dev Cockpit bridge listening on ws://${server.config.host}:${port}`,
  );
  if (args.includes("--tailscale")) {
    try {
      const tailscale = enableTailscaleServe(server.config.host, port);
      console.log(`Tailnet URL: ${tailscale.url}`);
      console.log(`Disable with: ${tailscale.disableCommand}`);
    } catch (error) {
      await server.close();
      throw error;
    }
  }
  console.log(
    `Pairing token (expires ${server.pairingExpiresAt.toISOString()}): ${server.pairingToken}`,
  );
  if (
    server.config.host !== "127.0.0.1" &&
    server.config.host !== "localhost"
  ) {
    console.warn(
      "Plain WebSocket is exposed beyond loopback. Put this bridge behind Tailscale or a TLS reverse proxy before remote use.",
    );
  }

  const stop = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
