import { afterEach, expect, it, vi } from 'vitest';
import { readWorkspaceRecovery } from '../../apps/cockpit/src/lib/scoreboard-storage';

const key = 'saasmaker.scoreboard.v1:owner';
function primary(raw: string | null, absent = false) {
  const close = vi.fn();
  const abort = vi.fn();
  const put = vi.fn();
  const transaction = vi.fn((_store, mode) => {
    expect(mode).toBe('readonly');
    const tx: any = {
      objectStore: () => ({
        get: (actual: string) => {
          expect(actual).toBe(key);
          const request: any = { result: raw };
          queueMicrotask(() => {
            request.onsuccess();
            tx.oncomplete();
          });
          return request;
        },
        put,
      }),
    };
    return tx;
  });
  vi.stubGlobal('indexedDB', {
    open: () => {
      const request: any = { result: { transaction, close }, transaction: { abort } };
      queueMicrotask(() => {
        if (absent) {
          request.onupgradeneeded();
          request.onerror();
        } else request.onsuccess();
      });
      return request;
    },
  });
  return { transaction, put, abort };
}
function legacy(raw: string | null) {
  const setItem = vi.fn();
  vi.stubGlobal('localStorage', {
    getItem: (actual: string) => {
      expect(actual).toBe(key);
      return raw;
    },
    setItem,
  });
  return setItem;
}
afterEach(() => vi.unstubAllGlobals());

it('exports exact primary bytes without parsing or rewriting, ahead of an older legacy copy', async () => {
  const raw = ' { "unknownFutureField": 7, "history": [1] } ';
  const db = primary(raw);
  const setItem = legacy('older');
  expect(await readWorkspaceRecovery(key)).toEqual({ raw, available: true, source: 'indexeddb' });
  expect(db.put).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});
it('keeps malformed data recoverable', async () => {
  primary('{broken');
  legacy(null);
  expect((await readWorkspaceRecovery(key)).raw).toBe('{broken');
});
it('reads exact legacy bytes without creating or migrating a database', async () => {
  const db = primary(null, true);
  const setItem = legacy(' legacy original ');
  expect(await readWorkspaceRecovery(key)).toEqual({
    raw: ' legacy original ',
    available: true,
    source: 'legacy',
  });
  expect(db.abort).toHaveBeenCalledOnce();
  expect(db.transaction).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});
it('reports storage failure separately from missing history', async () => {
  vi.stubGlobal('indexedDB', undefined);
  legacy(null);
  expect(await readWorkspaceRecovery(key)).toEqual({ raw: null, available: false, source: null });
});
it('labels an available legacy fallback when the primary store cannot open', async () => {
  vi.stubGlobal('indexedDB', undefined);
  legacy('old backup');
  expect(await readWorkspaceRecovery(key)).toEqual({
    raw: 'old backup',
    available: false,
    source: 'legacy',
  });
});
