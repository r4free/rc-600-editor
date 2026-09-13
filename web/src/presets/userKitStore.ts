import {
  USER_KITS_STORAGE_KEY,
  kitsToJson,
  parseDrumKitCatalog,
  removeKit,
  upsertKit,
  type DrumKit,
} from "./drumKit";

export interface UserKitStore {
  list(): DrumKit[];
  upsert(kit: DrumKit): DrumKit;
  remove(id: string): void;
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

export function createUserKitStore(storage?: Storage | null): UserKitStore {
  const store =
    storage ?? (typeof localStorage === "undefined" ? memoryStorage() : localStorage);

  function read(): DrumKit[] {
    try {
      const raw = store.getItem(USER_KITS_STORAGE_KEY);
      if (!raw) return [];
      return parseDrumKitCatalog(JSON.parse(raw), "user");
    } catch {
      return [];
    }
  }

  function write(kits: readonly DrumKit[]): void {
    store.setItem(USER_KITS_STORAGE_KEY, kitsToJson(kits));
  }

  return {
    list: read,
    upsert(kit) {
      const tagged: DrumKit = { ...kit, source: "user" };
      const next = upsertKit(read(), tagged);
      write(next);
      return next.find((k) => k.name.toLowerCase() === tagged.name.toLowerCase()) ?? tagged;
    },
    remove(id) {
      write(removeKit(read(), id));
    },
  };
}

export const userKitStore = createUserKitStore();
