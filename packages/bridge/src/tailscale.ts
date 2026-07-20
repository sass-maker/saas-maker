import { execFileSync } from "node:child_process";

const TAILSCALE_SERVE_PATH = "/mobile-dev-cockpit";

export type TailscaleRunner = (args: string[]) => string;

interface TailscaleStatus {
  BackendState?: unknown;
  Self?: { DNSName?: unknown };
}

const defaultRunner: TailscaleRunner = (args) =>
  execFileSync("tailscale", args, {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 256_000,
  });

export function assertTailscaleHost(host: string): void {
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      "Tailscale mode requires the bridge to bind to 127.0.0.1 or localhost",
    );
  }
}

function magicDnsName(raw: string): string {
  let status: TailscaleStatus;
  try {
    status = JSON.parse(raw) as TailscaleStatus;
  } catch {
    throw new Error("Tailscale returned an invalid status response");
  }
  if (status.BackendState !== "Running") {
    throw new Error("Tailscale is not connected; run `tailscale up` first");
  }
  const dnsName = status.Self?.DNSName;
  if (typeof dnsName !== "string" || !dnsName.trim()) {
    throw new Error("Tailscale MagicDNS is unavailable for this machine");
  }
  return dnsName.trim().replace(/\.$/, "");
}

export function enableTailscaleServe(
  host: string,
  port: number,
  run: TailscaleRunner = defaultRunner,
): { url: string; disableCommand: string } {
  assertTailscaleHost(host);
  const dnsName = magicDnsName(run(["status", "--json"]));
  run([
    "serve",
    "--bg",
    "--yes",
    "--https=443",
    `--set-path=${TAILSCALE_SERVE_PATH}`,
    `http://127.0.0.1:${port}`,
  ]);
  return {
    url: `wss://${dnsName}${TAILSCALE_SERVE_PATH}`,
    disableCommand: "mobile-dev-cockpit-bridge tailscale-off",
  };
}

export function disableTailscaleServe(
  run: TailscaleRunner = defaultRunner,
): void {
  run([
    "serve",
    "--yes",
    "--https=443",
    `--set-path=${TAILSCALE_SERVE_PATH}`,
    "off",
  ]);
}
