import { describe, expect, it } from "vitest";
import {
  disableTailscaleServe,
  enableTailscaleServe,
  type TailscaleRunner,
} from "../src/tailscale";

function fixtureRunner(
  status: unknown = {
    BackendState: "Running",
    Self: { DNSName: "studio.example-tailnet.ts.net." },
  },
): { calls: string[][]; run: TailscaleRunner } {
  const calls: string[][] = [];
  return {
    calls,
    run: (args) => {
      calls.push(args);
      return args[0] === "status" ? JSON.stringify(status) : "configured";
    },
  };
}

describe("Tailscale Serve integration", () => {
  it("configures a scoped private HTTPS proxy and reports its WSS URL", () => {
    const fixture = fixtureRunner();
    expect(enableTailscaleServe("127.0.0.1", 4782, fixture.run)).toEqual({
      url: "wss://studio.example-tailnet.ts.net/mobile-dev-cockpit",
      disableCommand: "mobile-dev-cockpit-bridge tailscale-off",
    });
    expect(fixture.calls).toEqual([
      ["status", "--json"],
      [
        "serve",
        "--bg",
        "--yes",
        "--https=443",
        "--set-path=/mobile-dev-cockpit",
        "http://127.0.0.1:4782",
      ],
    ]);
  });

  it("rejects non-loopback binding and disconnected Tailscale", () => {
    const unsafe = fixtureRunner();
    expect(() => enableTailscaleServe("0.0.0.0", 4782, unsafe.run)).toThrow(
      "requires the bridge to bind",
    );
    expect(unsafe.calls).toEqual([]);

    const offline = fixtureRunner({ BackendState: "Stopped" });
    expect(() => enableTailscaleServe("127.0.0.1", 4782, offline.run)).toThrow(
      "tailscale up",
    );
    expect(offline.calls).toEqual([["status", "--json"]]);
  });

  it("disables only the cockpit Serve path", () => {
    const fixture = fixtureRunner();
    disableTailscaleServe(fixture.run);
    expect(fixture.calls).toEqual([
      [
        "serve",
        "--yes",
        "--https=443",
        "--set-path=/mobile-dev-cockpit",
        "off",
      ],
    ]);
  });
});
