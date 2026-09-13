import {
  NATIVE_KITS_URL,
  parseDrumKit,
  parseDrumKitCatalog,
  type DrumKit,
} from "./drumKit";

export interface NativeKitApi {
  list(): Promise<DrumKit[]>;
  upsert(kit: DrumKit): Promise<DrumKit>;
  remove(id: string): Promise<void>;
}

export class NativeKitWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeKitWriteError";
  }
}

export function createNativeKitApi(fetchImpl: typeof fetch = fetch): NativeKitApi {
  return {
    async list() {
      const fromUrl = async (url: string) => {
        const res = await fetchImpl(url, { cache: "no-store" });
        if (!res.ok) return [];
        const text = (await res.text()).replace(/^\uFEFF/, "");
        return parseDrumKitCatalog(JSON.parse(text), "native");
      };
      try {
        const fromFile = await fromUrl(`${NATIVE_KITS_URL}?t=${Date.now()}`);
        if (fromFile.length > 0) return fromFile;
      } catch {
        /* try API */
      }
      try {
        return await fromUrl("/api/drum-kits");
      } catch {
        return [];
      }
    },
    async upsert(kit) {
      const res = await fetchImpl("/api/drum-kits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kit),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<DrumKit>;
      if (!res.ok) {
        throw new NativeKitWriteError(data.error || "Could not save factory kit");
      }
      const saved = parseDrumKit(data, "native");
      if (!saved) throw new NativeKitWriteError("Factory kit save returned invalid JSON");
      return saved;
    },
    async remove(id) {
      const res = await fetchImpl(`/api/drum-kits/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new NativeKitWriteError(data.error || "Could not delete factory kit");
      }
    },
  };
}

export const nativeKitApi = createNativeKitApi();
