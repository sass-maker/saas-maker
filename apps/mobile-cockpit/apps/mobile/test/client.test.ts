import { beforeEach, describe, expect, it } from "vitest";
import { CockpitClient } from "../src/lib/client";
import { getCredential, getLastBridgeUrl } from "../src/lib/credential-store";

const storage = new Map<string, string>();

class FakeWebSocket {
  static readonly OPEN = 1;
  static requests: string[] = [];
  static rejectAuthentication = false;
  readyState = 0;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  onclose?: () => void;

  constructor(readonly url: string) {
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(raw: string): void {
    const request = JSON.parse(raw) as { type: string; requestId: string };
    FakeWebSocket.requests.push(request.type);
    if (request.type === "authenticate" && FakeWebSocket.rejectAuthentication) {
      queueMicrotask(() =>
        this.onmessage?.({
          data: JSON.stringify({
            version: 1,
            type: "response",
            requestId: request.requestId,
            ok: false,
            error: {
              code: "authentication_failed",
              message: "Session expired",
            },
          }),
        }),
      );
      return;
    }
    const data =
      request.type === "pair"
        ? {
            sessionToken: "stored-session",
            sessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            snapshot: machineSnapshot,
          }
        : { snapshot: machineSnapshot };
    queueMicrotask(() =>
      this.onmessage?.({
        data: JSON.stringify({
          version: 1,
          type: "response",
          requestId: request.requestId,
          ok: true,
          data,
        }),
      }),
    );
  }

  close(): void {
    if (this.readyState !== FakeWebSocket.OPEN) return;
    this.readyState = 3;
    queueMicrotask(() => this.onclose?.());
  }
}

const machineSnapshot = {
  machineName: "Mac",
  bridgeVersion: "0.1.0",
  protocolVersion: 1,
  projects: [],
};

beforeEach(() => {
  storage.clear();
  FakeWebSocket.requests = [];
  FakeWebSocket.rejectAuthentication = false;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    value: FakeWebSocket,
  });
});

describe("CockpitClient credentials", () => {
  it("pairs once, remembers the bridge, and authenticates a later client from storage", async () => {
    const callbacks = {
      onStatus: () => {},
      onEvent: () => {},
      onError: () => {},
    };
    const first = new CockpitClient(callbacks);
    await first.connect("ws://machine.test:4782", "pair-token");
    expect(await getCredential("ws://machine.test:4782")).toBe(
      "stored-session",
    );
    expect(await getLastBridgeUrl()).toBe("ws://machine.test:4782");
    first.disconnect();

    const second = new CockpitClient(callbacks);
    await second.connect("ws://machine.test:4782");
    expect(FakeWebSocket.requests).toEqual(["pair", "authenticate"]);
    second.disconnect();
  });

  it("forgets the stored bridge and credential explicitly", async () => {
    const client = new CockpitClient({
      onStatus: () => {},
      onEvent: () => {},
      onError: () => {},
    });
    await client.connect("ws://machine.test:4782", "pair-token");
    await client.forget();
    expect(await getCredential("ws://machine.test:4782")).toBeNull();
    expect(await getLastBridgeUrl()).toBeNull();
  });

  it("removes an expired stored credential and requires pairing again", async () => {
    const callbacks = {
      onStatus: () => {},
      onEvent: () => {},
      onError: () => {},
    };
    const first = new CockpitClient(callbacks);
    await first.connect("ws://machine.test:4782", "pair-token");
    first.disconnect();

    FakeWebSocket.rejectAuthentication = true;
    const second = new CockpitClient(callbacks);
    await expect(
      second.connect("ws://machine.test:4782"),
    ).rejects.toMatchObject({ code: "authentication_failed" });
    expect(await getCredential("ws://machine.test:4782")).toBeNull();
    expect(await getLastBridgeUrl()).toBe("ws://machine.test:4782");
  });
});
