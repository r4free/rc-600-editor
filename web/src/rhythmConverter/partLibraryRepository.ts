/** Rhythm part library: factory JSON (written via the API in development) + this browser's own parts. */
import { resolvePresetSaveTarget } from "../presets/drumPreset";
import {
  NATIVE_PARTS_URL,
  USER_PARTS_STORAGE_KEY,
  parseLibraryPart,
  parsePartLibrary,
  partLibraryToJson,
  removePart,
  upsertPart,
  type LibraryPart,
  type LibrarySource,
} from "./partLibrary";

export interface PartLibraryRepository {
  list(): Promise<{ native: LibraryPart[]; user: LibraryPart[] }>;
  /** Saves into `into` (default: this build's target — factory file in development, browser otherwise). */
  save(part: LibraryPart, into?: LibrarySource): Promise<LibraryPart>;
  remove(part: LibraryPart): Promise<void>;
  /** Adds parts from an exported library file to this browser's parts. */
  importUser(raw: unknown): number;
  exportUser(): string;
  saveTarget(): LibrarySource;
}

async function readNative(fetchImpl: typeof fetch): Promise<LibraryPart[]> {
  const fromUrl = async (url: string) => {
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) return [];
    return parsePartLibrary(JSON.parse((await res.text()).replace(/^\uFEFF/, "")), "native");
  };
  try {
    const fromFile = await fromUrl(`${NATIVE_PARTS_URL}?t=${Date.now()}`);
    if (fromFile.length) return fromFile;
  } catch {
    /* try API */
  }
  try {
    return await fromUrl("/api/rhythm-parts");
  } catch {
    return [];
  }
}

export function createPartLibraryRepository(deps: {
  mode: string | undefined;
  storage: Storage | null;
  fetchImpl?: typeof fetch;
}): PartLibraryRepository {
  const fetchImpl = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const saveTarget = () => resolvePresetSaveTarget(deps.mode) as LibrarySource;

  function readUser(): LibraryPart[] {
    try {
      const raw = deps.storage?.getItem(USER_PARTS_STORAGE_KEY);
      return raw ? parsePartLibrary(JSON.parse(raw), "user") : [];
    } catch {
      return [];
    }
  }
  function writeUser(parts: readonly LibraryPart[]): void {
    deps.storage?.setItem(USER_PARTS_STORAGE_KEY, partLibraryToJson(parts));
  }

  return {
    saveTarget,
    async list() {
      return { native: await readNative(fetchImpl), user: readUser() };
    },
    async save(part, into) {
      const target = into ?? saveTarget();
      if (target === "native" && saveTarget() !== "native") {
        throw new Error("Factory rhythm parts can only be changed in development.");
      }
      const tagged: LibraryPart = { ...part, source: target, updatedAt: new Date().toISOString() };
      if (target === "user") {
        const next = upsertPart(readUser(), tagged);
        writeUser(next);
        return next.find((p) => p.kind === tagged.kind && p.name.toLowerCase() === tagged.name.toLowerCase()) ?? tagged;
      }
      const res = await fetchImpl("/api/rhythm-parts", {
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
              ? "The editor API does not know rhythm parts yet. Restart npm run api and try again."
              : "Could not save the rhythm part."),
        );
      }
      const saved = parseLibraryPart(data, "native");
      if (!saved) throw new Error("The rhythm part save returned invalid data.");
      return saved;
    },
    async remove(part) {
      if (part.source === "user") {
        writeUser(removePart(readUser(), part.id));
        return;
      }
      if (saveTarget() !== "native") throw new Error("Factory rhythm parts can only be deleted in development.");
      const res = await fetchImpl(`/api/rhythm-parts/${encodeURIComponent(part.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not delete the rhythm part.");
      }
    },
    importUser(raw) {
      const incoming = parsePartLibrary(raw, "user");
      let next = readUser();
      for (const p of incoming) next = upsertPart(next, { ...p, source: "user" });
      writeUser(next);
      return incoming.length;
    },
    exportUser() {
      return partLibraryToJson(readUser());
    },
  };
}

export function browserPartLibrary(): PartLibraryRepository {
  return createPartLibraryRepository({
    mode: import.meta.env.MODE,
    storage: typeof localStorage === "undefined" ? null : localStorage,
  });
}
