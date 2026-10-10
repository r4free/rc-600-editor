/** Offline working copy of the user rhythm slots (too big for localStorage), kept in IndexedDB. */
import type { SlotRecord } from "./rhythmRc0";

export interface OfflineSlots {
  records: SlotRecord[];
  /** Where the list came from: a file name, or null for a list started empty. */
  origin: string | null;
  /** Changed since it was opened or last downloaded. */
  dirty: boolean;
}

/** Older saves kept the whole RHYTHM.RC0 file instead of decoded slots. */
export interface StoredOfflineSlots extends Omit<OfflineSlots, "records"> {
  records?: SlotRecord[];
  bytes?: Uint8Array;
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

export async function loadOfflineSlots(): Promise<StoredOfflineSlots | null> {
  if (typeof indexedDB === "undefined") return null;
  const value = (await run("readonly", (s) => s.get(KEY))) as StoredOfflineSlots | undefined;
  if (!value) return null;
  if (Array.isArray(value.records)) return value;
  return value.bytes ? { ...value, bytes: new Uint8Array(value.bytes) } : null;
}

export async function saveOfflineSlots(value: OfflineSlots | null): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  if (value) await run("readwrite", (s) => s.put(value, KEY));
  else await run("readwrite", (s) => s.delete(KEY));
}
