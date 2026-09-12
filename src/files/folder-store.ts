import type { DirectoryHandleLike } from "./roland.js";

const DB_NAME = "rc600-editor";
const DB_VERSION = 1;
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

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function saveRolandHandle(handle: DirectoryHandleLike): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openHandleDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.objectStore(STORE).put(handle, HANDLE_KEY);
    });
  } finally {
    db.close();
  }
}

export async function loadRolandHandle(): Promise<DirectoryHandleLike | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openHandleDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as DirectoryHandleLike | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    });
  } finally {
    db.close();
  }
}

export async function clearRolandHandle(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openHandleDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
      tx.objectStore(STORE).delete(HANDLE_KEY);
    });
  } finally {
    db.close();
  }
}
