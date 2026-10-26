import { parseWorkspace, type ScoreWorkspace } from './scoreboard';

const DATABASE = 'saasmaker-scoreboard';
const STORE = 'workspaces';

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('History storage is unavailable.'));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close older scoreboard tabs to open history storage.'));
    };
    request.onerror = () =>
      reject(request.error ?? new Error('History storage could not be opened.'));
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      }
    };
  });
}

async function access(key: string, raw?: string, migrate = false): Promise<string | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, raw === undefined ? 'readonly' : 'readwrite');
      const request =
        raw === undefined || migrate
          ? transaction.objectStore(STORE).get(key)
          : transaction.objectStore(STORE).put(raw, key);
      let value: string | null = null;
      request.onsuccess = () => {
        if ((raw === undefined || migrate) && typeof request.result === 'string')
          value = request.result;
        else if (migrate && raw !== undefined) {
          transaction.objectStore(STORE).put(raw, key);
          value = raw;
        }
      };
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('History storage transaction was aborted.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('History storage failed.'));
    });
  } finally {
    db.close();
  }
}

/** Migrate a validated legacy copy once. Keep the original as a recovery copy. */
export async function readWorkspaceStore(
  key: string
): Promise<{ raw: string | null; available: boolean }> {
  try {
    const saved = await access(key);
    if (saved !== null) return { raw: saved, available: true };
    let legacy: string | null = null;
    try {
      legacy = localStorage.getItem(key);
    } catch {
      /* IndexedDB remains usable. */
    }
    if (legacy) {
      const normalized = JSON.stringify(parseWorkspace(legacy));
      return { raw: await access(key, normalized, true), available: true };
    }
    return { raw: null, available: true };
  } catch (error) {
    // Do not silently replace a primary history store with an older legacy copy.
    // A readable legacy copy can still be inspected/exported if storage is denied.
    let legacy: string | null = null;
    try {
      legacy = localStorage.getItem(key);
    } catch {
      /* Read-only fallback is unavailable too. */
    }
    if (error instanceof SyntaxError) throw error;
    return { raw: legacy, available: false };
  }
}

export async function writeWorkspaceStore(key: string, workspace: ScoreWorkspace) {
  await access(key, JSON.stringify(workspace));
  // Only a non-sensitive invalidation token goes into localStorage. Private
  // assessments live in IndexedDB, avoiding localStorage's small history quota.
  try {
    localStorage.setItem(`${key}:changed`, crypto.randomUUID());
  } catch {
    /* BroadcastChannel also refreshes other tabs. */
  }
}

/** Read exact recovery bytes without migration, normalization or workspace writes. */
export async function readWorkspaceRecovery(key: string): Promise<{
  raw: string | null;
  available: boolean;
  source: 'indexeddb' | 'legacy' | null;
}> {
  let available = true;
  try {
    const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('Storage unavailable.'));
      const request = indexedDB.open(DATABASE);
      let absent = false;
      let blocked = false;
      request.onupgradeneeded = () => {
        // An absent database has no history to recover. Abort creation.
        absent = true;
        request.transaction?.abort();
      };
      request.onerror = () => (absent ? resolve(null) : reject(request.error));
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Storage blocked.'));
      };
      request.onsuccess = () => {
        if (blocked) request.result.close();
        else resolve(request.result);
      };
    });
    if (db) {
      try {
        const raw = await new Promise<string | null>((resolve, reject) => {
          const transaction = db.transaction(STORE, 'readonly');
          const request = transaction.objectStore(STORE).get(key);
          let raw: string | null = null;
          request.onsuccess = () => {
            raw = typeof request.result === 'string' ? request.result : null;
          };
          transaction.oncomplete = () => resolve(raw);
          transaction.onabort = () => reject(transaction.error);
          transaction.onerror = () => reject(transaction.error);
        });
        if (raw !== null) return { raw, available: true, source: 'indexeddb' };
      } finally {
        db.close();
      }
    }
  } catch {
    available = false;
  }
  try {
    const raw = localStorage.getItem(key);
    return { raw, available, source: raw === null ? null : 'legacy' };
  } catch {
    return { raw: null, available: false, source: null };
  }
}
