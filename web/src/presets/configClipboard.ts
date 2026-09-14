import type { TagMap } from "@rc600/rc0/memory";

export const CONFIG_CLIPBOARD_KEY = "rc600.configClipboard.v1";
export const CONFIG_CLIPBOARD_SLOTS = 5;

export type ConfigCopyKind =
  | "track"
  | "rec"
  | "play"
  | "rhythm"
  | "assign"
  | "ctlPedal"
  | "ectlCtl"
  | "ectlExp"
  | "inputEq"
  | "outputEq"
  | "ifxSlot"
  | "ifxSetup"
  | "ifxBank"
  | "mixer"
  | "inputSetup"
  | "inputDynamics"
  | "outputSetup"
  | "masterFx"
  | "ctlPref";

export type ConfigClipboardEntry = {
  kind: ConfigCopyKind;
  label: string;
  tags: TagMap;
  updatedAt: string;
};

export type ConfigClipboard = Array<ConfigClipboardEntry | null>;

function emptyClipboard(): ConfigClipboard {
  return Array.from({ length: CONFIG_CLIPBOARD_SLOTS }, () => null);
}

function isTagMap(v: unknown): v is TagMap {
  if (!v || typeof v !== "object") return false;
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");
}

function parseEntry(raw: unknown): ConfigClipboardEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.kind !== "string" || typeof o.label !== "string") return null;
  if (typeof o.updatedAt !== "string" || !isTagMap(o.tags)) return null;
  return {
    kind: o.kind as ConfigCopyKind,
    label: o.label,
    tags: { ...o.tags },
    updatedAt: o.updatedAt,
  };
}

export function parseClipboard(raw: unknown): ConfigClipboard {
  const out = emptyClipboard();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < CONFIG_CLIPBOARD_SLOTS; i++) {
    out[i] = parseEntry(raw[i]);
  }
  return out;
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

function defaultStorage(): Storage {
  return typeof localStorage === "undefined" ? memoryStorage() : localStorage;
}

export function loadClipboard(storage: Storage = defaultStorage()): ConfigClipboard {
  try {
    const raw = storage.getItem(CONFIG_CLIPBOARD_KEY);
    if (!raw) return emptyClipboard();
    return parseClipboard(JSON.parse(raw));
  } catch {
    return emptyClipboard();
  }
}

function writeClipboard(slots: ConfigClipboard, storage: Storage): void {
  storage.setItem(CONFIG_CLIPBOARD_KEY, JSON.stringify(slots));
}

export function readClipboardSlot(
  index: number,
  storage: Storage = defaultStorage(),
): ConfigClipboardEntry | null {
  if (index < 0 || index >= CONFIG_CLIPBOARD_SLOTS) return null;
  return loadClipboard(storage)[index] ?? null;
}

export function saveClipboardSlot(
  index: number,
  entry: Omit<ConfigClipboardEntry, "updatedAt"> & { updatedAt?: string },
  storage: Storage = defaultStorage(),
): ConfigClipboard {
  if (index < 0 || index >= CONFIG_CLIPBOARD_SLOTS) return loadClipboard(storage);
  const slots = loadClipboard(storage);
  slots[index] = {
    kind: entry.kind,
    label: entry.label,
    tags: { ...entry.tags },
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  };
  writeClipboard(slots, storage);
  return slots;
}

export function clearClipboardSlot(
  index: number,
  storage: Storage = defaultStorage(),
): ConfigClipboard {
  if (index < 0 || index >= CONFIG_CLIPBOARD_SLOTS) return loadClipboard(storage);
  const slots = loadClipboard(storage);
  slots[index] = null;
  writeClipboard(slots, storage);
  return slots;
}

/** Pick listed tags present on the source map. */
export function pickTags(source: TagMap, tags: readonly string[]): TagMap {
  const out: TagMap = {};
  for (const tag of tags) {
    if (source[tag] !== undefined) out[tag] = source[tag]!;
  }
  return out;
}
