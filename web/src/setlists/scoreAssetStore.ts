export interface ScoreAsset {
  id: string;
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  createdAt: string;
}

export interface ScoreAssetStore {
  put(fileName: string, bytes: Uint8Array, mediaType?: string): Promise<ScoreAsset>;
  get(id: string): Promise<ScoreAsset | null>;
  delete(id: string): Promise<void>;
  list(): Promise<ScoreAsset[]>;
}

const DB_NAME = "rc600-setlist-assets";
const DB_VERSION = 1;
const STORE_NAME = "scores";

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function scoreAssetId(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const source = new Uint8Array(bytes);
    return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", source.buffer)));
  }
  let hash = 2_166_136_261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16_777_619);
  }
  return `fallback-${(hash >>> 0).toString(16).padStart(8, "0")}-${bytes.byteLength}`;
}

export function createMemoryScoreAssetStore(): ScoreAssetStore {
  const assets = new Map<string, ScoreAsset>();
  return {
    async put(fileName, bytes, mediaType = "application/octet-stream") {
      const id = await scoreAssetId(bytes);
      const asset: ScoreAsset = {
        id,
        fileName,
        mediaType,
        bytes: new Uint8Array(bytes),
        createdAt: new Date().toISOString(),
      };
      assets.set(id, asset);
      return { ...asset, bytes: new Uint8Array(asset.bytes) };
    },
    async get(id) {
      const asset = assets.get(id);
      return asset ? { ...asset, bytes: new Uint8Array(asset.bytes) } : null;
    },
    async delete(id) {
      assets.delete(id);
    },
    async list() {
      return [...assets.values()].map((asset) => ({
        ...asset,
        bytes: new Uint8Array(asset.bytes),
      }));
    },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open score storage"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Score storage operation failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Score storage transaction failed"));
    });
  } finally {
    database.close();
  }
}

function fromRecord(record: {
  id: string;
  fileName: string;
  mediaType: string;
  bytes: ArrayBuffer;
  createdAt: string;
}): ScoreAsset {
  return { ...record, bytes: new Uint8Array(record.bytes) };
}

export function createIndexedDbScoreAssetStore(): ScoreAssetStore {
  return {
    async put(fileName, bytes, mediaType = "application/octet-stream") {
      const id = await scoreAssetId(bytes);
      const asset: ScoreAsset = {
        id,
        fileName,
        mediaType,
        bytes: new Uint8Array(bytes),
        createdAt: new Date().toISOString(),
      };
      await withStore("readwrite", (store) => store.put({
        ...asset,
        bytes: asset.bytes.buffer.slice(
          asset.bytes.byteOffset,
          asset.bytes.byteOffset + asset.bytes.byteLength,
        ),
      }));
      return asset;
    },
    async get(id) {
      const record = await withStore<ReturnType<typeof recordShape> | undefined>(
        "readonly",
        (store) => store.get(id),
      );
      return record ? fromRecord(record) : null;
    },
    async delete(id) {
      await withStore("readwrite", (store) => store.delete(id));
    },
    async list() {
      const records = await withStore<ReturnType<typeof recordShape>[]>(
        "readonly",
        (store) => store.getAll(),
      );
      return records.map(fromRecord);
    },
  };
}

function recordShape() {
  return {} as {
    id: string;
    fileName: string;
    mediaType: string;
    bytes: ArrayBuffer;
    createdAt: string;
  };
}

export const scoreAssetStore: ScoreAssetStore =
  typeof indexedDB === "undefined"
    ? createMemoryScoreAssetStore()
    : createIndexedDbScoreAssetStore();
