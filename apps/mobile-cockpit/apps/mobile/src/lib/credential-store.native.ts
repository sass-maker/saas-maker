import * as SecureStore from "expo-secure-store";

function key(url: string): string {
  return `bridge-${url.replace(/[^a-z0-9]/gi, "_").slice(0, 120)}`;
}

const LAST_BRIDGE_KEY = "last-bridge-url";

export function getCredential(url: string): Promise<string | null> {
  return SecureStore.getItemAsync(key(url));
}

export function setCredential(url: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key(url), value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export function deleteCredential(url: string): Promise<void> {
  return SecureStore.deleteItemAsync(key(url));
}

export function getLastBridgeUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_BRIDGE_KEY);
}

export function setLastBridgeUrl(url: string): Promise<void> {
  return SecureStore.setItemAsync(LAST_BRIDGE_KEY, url, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export function deleteLastBridgeUrl(): Promise<void> {
  return SecureStore.deleteItemAsync(LAST_BRIDGE_KEY);
}
