import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface StoredSession {
  hash: string;
  expiresAt: number;
}

interface StoredState {
  sessions?: StoredSession[];
  sessionHashes?: string[];
}

export interface CreatedSession {
  token: string;
  expiresAt: number;
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function equalHash(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export class SessionStore {
  private sessions: StoredSession[] = [];

  constructor(
    private readonly stateFile: string,
    private readonly ttlSeconds: number,
  ) {
    try {
      const state = JSON.parse(readFileSync(stateFile, "utf8")) as StoredState;
      this.sessions = (state.sessions ?? []).filter(
        (session) =>
          typeof session.hash === "string" &&
          Number.isFinite(session.expiresAt),
      );
      if (state.sessionHashes?.length) this.persist();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  create(now = Date.now()): CreatedSession {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = now + this.ttlSeconds * 1000;
    this.prune(now);
    this.sessions.push({ hash: hash(token), expiresAt });
    this.persist();
    return { token, expiresAt };
  }

  has(token: string, now = Date.now()): boolean {
    return this.expiresAt(token, now) !== undefined;
  }

  expiresAt(token: string, now = Date.now()): number | undefined {
    const changed = this.prune(now);
    const candidate = hash(token);
    const session = this.sessions.find((stored) =>
      equalHash(candidate, stored.hash),
    );
    if (changed) this.persist();
    return session?.expiresAt;
  }

  private prune(now: number): boolean {
    const valid = this.sessions.filter((session) => session.expiresAt > now);
    const changed = valid.length !== this.sessions.length;
    this.sessions = valid;
    return changed;
  }

  private persist(): void {
    mkdirSync(dirname(this.stateFile), { recursive: true, mode: 0o700 });
    writeFileSync(
      this.stateFile,
      JSON.stringify({ sessions: this.sessions }, null, 2),
      {
        encoding: "utf8",
        mode: 0o600,
      },
    );
  }
}

export class PairingToken {
  readonly value = randomBytes(18).toString("base64url");
  readonly expiresAt: number;
  private used = false;

  constructor(ttlSeconds: number, now = Date.now()) {
    this.expiresAt = now + ttlSeconds * 1000;
  }

  consume(candidate: string, now = Date.now()): boolean {
    if (this.used || now >= this.expiresAt) return false;
    const expectedHash = hash(this.value);
    const candidateHash = hash(candidate);
    if (!equalHash(expectedHash, candidateHash)) return false;
    this.used = true;
    return true;
  }
}
