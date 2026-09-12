import type { DirectoryHandleLike } from "./roland.js";

const DB_NAME = "rc600-editor";
/** Bump when the schema changes. v1 DBs may exist without the handles store. */
const DB_VERSION = 2;
const STORE = "handles";
const HANDLE_KEY = "rolandDirectory";
export const FOLDER_META_KEY = "rc600.folder.meta";

export type FolderMeta = {
  rootLabel: string | null;
  lastSlot: number | null;
  backupAck: boolean;
};

export const EMPTY_FOLDER_META: FolderMeta = {
  rootLabel: null,
  lastSlot: null,
  backupAck: false,
};

function readStore(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function loadFolderMeta(): FolderMeta {
  const store = readStore();
  if (!store) return { ...EMPTY_FOLDER_META };
  try {
    const raw = store.getItem(FOLDER_META_KEY);
    if (!raw) return { ...EMPTY_FOLDER_META };
    const parsed = JSON.parse(raw) as Partial<FolderMeta>;
    const lastSlot = parsed.lastSlot;
    return {
      rootLabel: typeof parsed.rootLabel === "string" && parsed.rootLabel ? parsed.rootLabel : null,
      lastSlot:
        typeof lastSlot === "number" && Number.isInteger(lastSlot) && lastSlot >= 1 && lastSlot <= 99
          ? lastSlot
          : null,
      backupAck: parsed.backupAck === true,
    };
  } catch {
    return { ...EMPTY_FOLDER_META };
  }
}

export function saveFolderMeta(patch: Partial<FolderMeta>): FolderMeta {
  const next = { ...loadFolderMeta(), ...patch };
  const store = readStore();
  if (store) store.setItem(FOLDER_META_KEY, JSON.stringify(next));
  return next;
}

export function clearFolderMeta(): void {
  readStore()?.removeItem(FOLDER_META_KEY);
}

export function hasHandleStore(storeNames: { contains: (name: string) => boolean }): boolean {
  return storeNames.contains(STORE);
}

export function ensureHandleStore(db: { objectStoreNames: { contains: (name: string) => boolean }; createObjectStore: (name: string) => unknown }): void {
  if (!hasHandleStore(db.objectStoreNames)) db.createObjectStore(STORE);
}

function openHandleDb(version = DB_VERSION, attempt = 0): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, version);
    } catch (e) {
      reject(e instanceof Error ? e : new Error("IndexedDB open failed"));
      return;
    }
    req.onupgradeneeded = () => {
      try {
        ensureHandleStore(req.result);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("IndexedDB upgrade failed"));
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      if (!hasHandleStore(db.objectStoreNames)) {
        if (attempt >= 3) {
          db.close();
          reject(new Error("IndexedDB handles store missing"));
          return;
        }
        const bump = db.version + 1;
        db.close();
        openHandleDb(bump, attempt + 1).then(resolve, reject);
        return;
      }
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function withHandleDb<T>(fn: (db: IDBDatabase) => Promise<T>, fallback: T): Promise<T> {
  if (typeof indexedDB === "undefined") return fallback;
  let db: IDBDatabase | undefined;
  try {
    db = await openHandleDb();
    return await fn(db);
  } catch {
    return fallback;
  } finally {
    try {
      db?.close();
    } catch {
      /* already closed during upgrade retry */
    }
  }
}

export async function saveRolandHandle(handle: DirectoryHandleLike): Promise<void> {
  await withHandleDb(async (db) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.objectStore(STORE).put(handle, HANDLE_KEY);
    });
  }, undefined);
}

export async function loadRolandHandle(): Promise<DirectoryHandleLike | null> {
  return withHandleDb(async (db) => {
    return await new Promise<DirectoryHandleLike | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as DirectoryHandleLike | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    });
  }, null);
}

export async function clearRolandHandle(): Promise<void> {
  await withHandleDb(async (db) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
      tx.objectStore(STORE).delete(HANDLE_KEY);
    });
  }, undefined);
}
