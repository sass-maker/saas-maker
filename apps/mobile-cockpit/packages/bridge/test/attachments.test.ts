import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeAgentAttachment } from "../src/attachments.js";

describe("writeAgentAttachment", () => {
  it("writes a validated image privately beside bridge state", () => {
    const directory = mkdtempSync(join(tmpdir(), "cockpit-attachment-"));
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const path = writeAgentAttachment(
      join(directory, "state.json"),
      "image/jpeg",
      jpeg.toString("base64"),
    );
    expect(readFileSync(path)).toEqual(jpeg);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("rejects bytes that do not match the declared image type", () => {
    expect(() =>
      writeAgentAttachment(
        "/tmp/cockpit-invalid/state.json",
        "image/png",
        Buffer.from("not-png").toString("base64"),
      ),
    ).toThrow(/do not match/);
  });
});
