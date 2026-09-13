import {
  USER_PRESETS_STORAGE_KEY,
  catalogToJson,
  parseDrumPresetCatalog,
  removePreset,
  upsertPreset,
  type DrumPreset,
} from "./drumPreset";

export interface UserPresetStore {
  list(): DrumPreset[];
  upsert(preset: DrumPreset): DrumPreset;
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

export function createUserPresetStore(storage?: Storage | null): UserPresetStore {
  const store =
    storage ?? (typeof localStorage === "undefined" ? memoryStorage() : localStorage);

  function read(): DrumPreset[] {
    try {
      const raw = store.getItem(USER_PRESETS_STORAGE_KEY);
      if (!raw) return [];
      return parseDrumPresetCatalog(JSON.parse(raw), "user");
    } catch {
      return [];
    }
  }

  function write(presets: readonly DrumPreset[]): void {
    store.setItem(USER_PRESETS_STORAGE_KEY, catalogToJson(presets));
  }

  return {
    list: read,
    upsert(preset) {
      const tagged: DrumPreset = { ...preset, source: "user" };
      const next = upsertPreset(read(), tagged);
      write(next);
      return (
        next.find((p) => p.name.toLowerCase() === tagged.name.toLowerCase()) ?? tagged
      );
    },
    remove(id) {
      write(removePreset(read(), id));
    },
  };
}

export const userPresetStore = createUserPresetStore();
