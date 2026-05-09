"use client";

if (typeof globalThis !== "undefined") {
  const globalWithName = globalThis as typeof globalThis & {
    __name?: <T>(target: T) => T;
  };
  globalWithName.__name ||= (target) => target;
}

export function GlobalNamePolyfill() {
  return null;
}
