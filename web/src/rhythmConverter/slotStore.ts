/** Offline working copy of RHYTHM.RC0 (about 2 MB, too big for localStorage), kept in IndexedDB. */

export interface OfflineSlots {
  /** Full RHYTHM.RC0 bytes. */
  bytes: Uint8Array;
  /** Where the list came from: a file name, or null for a list started empty. */
  origin: string | null;
  /** Changed since it was opened or last downloaded. */
  dirty: boolean;
}

const DB_NAME = "rc600-rhythm-slots";
const STORE = "slots";
const KEY = "offline";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadOfflineSlots(): Promise<OfflineSlots | null> {
  if (typeof indexedDB === "undefined") return null;
  const value = (await run("readonly", (s) => s.get(KEY))) as OfflineSlots | undefined;
  return value?.bytes ? { ...value, bytes: new Uint8Array(value.bytes) } : null;
}

export async function saveOfflineSlots(value: OfflineSlots | null): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  if (value) await run("readwrite", (s) => s.put(value, KEY));
  else await run("readwrite", (s) => s.delete(KEY));
}
