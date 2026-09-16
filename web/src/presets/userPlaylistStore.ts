import {
  LEGACY_PLAYLISTS_STORAGE_KEY,
  USER_SETLISTS_STORAGE_KEY,
  parseSetlistCatalog,
  removeSetlist,
  setlistsToJson,
  upsertSetlist,
  type Setlist,
} from "./playlist";

export interface UserSetlistStore {
  list(): Setlist[];
  upsert(setlist: Setlist): Setlist;
  remove(id: string): void;
  replace(setlists: readonly Setlist[]): void;
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

export function createUserSetlistStore(storage?: Storage | null): UserSetlistStore {
  const store =
    storage ?? (typeof localStorage === "undefined" ? memoryStorage() : localStorage);

  function read(): Setlist[] {
    try {
      const raw =
        store.getItem(USER_SETLISTS_STORAGE_KEY) ??
        store.getItem(LEGACY_PLAYLISTS_STORAGE_KEY);
      return raw ? parseSetlistCatalog(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  function write(setlists: readonly Setlist[]): void {
    store.setItem(USER_SETLISTS_STORAGE_KEY, setlistsToJson(setlists));
  }

  return {
    list: read,
    upsert(setlist) {
      write(upsertSetlist(read(), setlist));
      return setlist;
    },
    remove(id) {
      write(removeSetlist(read(), id));
    },
    replace: write,
  };
}

export const userSetlistStore = createUserSetlistStore();
