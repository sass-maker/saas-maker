import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PairingToken, SessionStore } from "../src/auth.js";

describe("pairing and sessions", () => {
  it("consumes a pairing token once", () => {
    const token = new PairingToken(60, 1_000);
    expect(token.consume(token.value, 1_001)).toBe(true);
    expect(token.consume(token.value, 1_002)).toBe(false);
  });

  it("rejects expired and wrong tokens", () => {
    const token = new PairingToken(1, 1_000);
    expect(token.consume("wrong", 1_001)).toBe(false);
    expect(token.consume(token.value, 2_000)).toBe(false);
  });

  it("persists only token hashes", () => {
    const stateFile = join(
      mkdtempSync(join(tmpdir(), "cockpit-auth-")),
      "state.json",
    );
    const store = new SessionStore(stateFile, 60);
    const session = store.create(1_000);
    expect(store.has(session.token, 1_001)).toBe(true);
    expect(readFileSync(stateFile, "utf8")).not.toContain(session.token);
    expect(new SessionStore(stateFile, 60).has(session.token, 1_001)).toBe(
      true,
    );
    expect(store.has(session.token, 61_000)).toBe(false);
  });
});
