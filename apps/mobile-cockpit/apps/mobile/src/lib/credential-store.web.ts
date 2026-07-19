function key(url: string): string {
  return `mobile-dev-cockpit:${url}`;
}

const LAST_BRIDGE_KEY = "mobile-dev-cockpit:last-bridge-url";

export async function getCredential(url: string): Promise<string | null> {
  return globalThis.localStorage?.getItem(key(url)) ?? null;
}

export async function setCredential(url: string, value: string): Promise<void> {
  globalThis.localStorage?.setItem(key(url), value);
}

export async function deleteCredential(url: string): Promise<void> {
  globalThis.localStorage?.removeItem(key(url));
}

export async function getLastBridgeUrl(): Promise<string | null> {
  return globalThis.localStorage?.getItem(LAST_BRIDGE_KEY) ?? null;
}

export async function setLastBridgeUrl(url: string): Promise<void> {
  globalThis.localStorage?.setItem(LAST_BRIDGE_KEY, url);
}

export async function deleteLastBridgeUrl(): Promise<void> {
  globalThis.localStorage?.removeItem(LAST_BRIDGE_KEY);
}
