import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function validSignature(
  bytes: Buffer,
  mimeType: "image/jpeg" | "image/png",
): boolean {
  if (mimeType === "image/jpeg")
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  return bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

export function writeAgentAttachment(
  stateFile: string,
  mimeType: "image/jpeg" | "image/png",
  base64: string,
): string {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("Screenshot must decode to at most 4 MB");
  }
  if (!validSignature(bytes, mimeType))
    throw new Error("Screenshot bytes do not match the declared image type");

  const directory = join(dirname(stateFile), "attachments");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const extension = mimeType === "image/jpeg" ? "jpg" : "png";
  const path = join(directory, `${Date.now()}-${randomUUID()}.${extension}`);
  writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
  return path;
}
