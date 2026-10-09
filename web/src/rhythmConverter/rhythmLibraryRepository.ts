/** Ready-made rhythm library: factory JSON (written via the API in development) + this browser's own rhythms. */
import { resolvePresetSaveTarget } from "../presets/drumPreset";
import type { LibrarySource } from "./partLibrary";
import {
  NATIVE_RHYTHMS_URL,
  RHYTHMS_API_URL,
  USER_RHYTHMS_STORAGE_KEY,
  parseLibraryRhythm,
  parseRhythmLibrary,
  removeRhythm,
  rhythmLibraryToJson,
  upsertRhythm,
  type LibraryRhythm,
} from "./rhythmLibrary";

export interface RhythmLibraryRepository {
  list(): Promise<{ native: LibraryRhythm[]; user: LibraryRhythm[] }>;
  save(rhythm: LibraryRhythm, into?: LibrarySource): Promise<LibraryRhythm>;
  remove(rhythm: LibraryRhythm): Promise<void>;
  importUser(raw: unknown): number;
  exportUser(): string;
  saveTarget(): LibrarySource;
}

async function readNative(fetchImpl: typeof fetch): Promise<LibraryRhythm[]> {
  const fromUrl = async (url: string) => {
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) return [];
    return parseRhythmLibrary(JSON.parse((await res.text()).replace(/^\uFEFF/, "")), "native");
  };
  try {
    const fromFile = await fromUrl(`${NATIVE_RHYTHMS_URL}?t=${Date.now()}`);
    if (fromFile.length) return fromFile;
  } catch {
    /* try API */
  }
  try {
    return await fromUrl(RHYTHMS_API_URL);
  } catch {
    return [];
  }
}

export function createRhythmLibraryRepository(deps: {
  mode: string | undefined;
  storage: Storage | null;
  fetchImpl?: typeof fetch;
}): RhythmLibraryRepository {
  const fetchImpl = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const saveTarget = () => resolvePresetSaveTarget(deps.mode) as LibrarySource;

  function readUser(): LibraryRhythm[] {
    try {
      const raw = deps.storage?.getItem(USER_RHYTHMS_STORAGE_KEY);
      return raw ? parseRhythmLibrary(JSON.parse(raw), "user") : [];
    } catch {
      return [];
    }
  }
  function writeUser(rhythms: readonly LibraryRhythm[]): void {
    deps.storage?.setItem(USER_RHYTHMS_STORAGE_KEY, rhythmLibraryToJson(rhythms));
  }

  return {
    saveTarget,
    async list() {
      return { native: await readNative(fetchImpl), user: readUser() };
    },
    async save(rhythm, into) {
      const target = into ?? saveTarget();
      if (target === "native" && saveTarget() !== "native") {
        throw new Error("Factory rhythms can only be changed in development.");
      }
      const tagged: LibraryRhythm = { ...rhythm, source: target, updatedAt: new Date().toISOString() };
      if (target === "user") {
        const next = upsertRhythm(readUser(), tagged);
        writeUser(next);
        return next.find((r) => r.name.toLowerCase() === tagged.name.toLowerCase()) ?? tagged;
      }
      const res = await fetchImpl(RHYTHMS_API_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tagged),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 404
              ? "The editor API does not know the rhythm library yet. Restart npm run api and try again."
              : "Could not save the rhythm."),
        );
      }
      const saved = parseLibraryRhythm(data, "native");
      if (!saved) throw new Error("The rhythm save returned invalid data.");
      return saved;
    },
    async remove(rhythm) {
      if (rhythm.source === "user") {
        writeUser(removeRhythm(readUser(), rhythm.id));
        return;
      }
      if (saveTarget() !== "native") throw new Error("Factory rhythms can only be deleted in development.");
      const res = await fetchImpl(`${RHYTHMS_API_URL}/${encodeURIComponent(rhythm.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not delete the rhythm.");
      }
    },
    importUser(raw) {
      const incoming = parseRhythmLibrary(raw, "user");
      let next = readUser();
      for (const r of incoming) next = upsertRhythm(next, { ...r, source: "user" });
      writeUser(next);
      return incoming.length;
    },
    exportUser() {
      return rhythmLibraryToJson(readUser());
    },
  };
}

export function browserRhythmLibrary(): RhythmLibraryRepository {
  return createRhythmLibraryRepository({
    mode: import.meta.env.MODE,
    storage: typeof localStorage === "undefined" ? null : localStorage,
  });
}
