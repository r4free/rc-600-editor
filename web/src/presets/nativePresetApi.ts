import {
  NATIVE_PRESETS_URL,
  parseDrumPreset,
  parseDrumPresetCatalog,
  type DrumPreset,
} from "./drumPreset";

export interface NativePresetApi {
  list(): Promise<DrumPreset[]>;
  upsert(preset: DrumPreset): Promise<DrumPreset>;
  remove(id: string): Promise<void>;
}

export class NativePresetWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativePresetWriteError";
  }
}

export function createNativePresetApi(fetchImpl: typeof fetch = fetch): NativePresetApi {
  return {
    async list() {
      const fromUrl = async (url: string) => {
        const res = await fetchImpl(url, { cache: "no-store" });
        if (!res.ok) return [];
        const text = (await res.text()).replace(/^\uFEFF/, "");
        return parseDrumPresetCatalog(JSON.parse(text), "native");
      };
      try {
        const fromFile = await fromUrl(`${NATIVE_PRESETS_URL}?t=${Date.now()}`);
        if (fromFile.length > 0) return fromFile;
      } catch {
        /* try API */
      }
      try {
        return await fromUrl("/api/drum-presets");
      } catch {
        return [];
      }
    },
    async upsert(preset) {
      const res = await fetchImpl("/api/drum-presets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<DrumPreset>;
      if (!res.ok) {
        throw new NativePresetWriteError(data.error || "Could not save factory rhythm");
      }
      const saved = parseDrumPreset(data, "native");
      if (!saved) throw new NativePresetWriteError("Factory rhythm save returned invalid JSON");
      return saved;
    },
    async remove(id) {
      const res = await fetchImpl(`/api/drum-presets/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new NativePresetWriteError(data.error || "Could not delete factory rhythm");
      }
    },
  };
}

export const nativePresetApi = createNativePresetApi();
