import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  catalogToJson,
  normalizePresetName,
  parseDrumPreset,
  parseDrumPresetCatalog,
  removePreset,
  upsertPreset,
  type DrumPreset,
} from "../web/src/presets/drumPreset.js";

export function isNativePresetWriteAllowed(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}

export function createNativePresetFileStore(filePath: string) {
  async function read(): Promise<DrumPreset[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      return parseDrumPresetCatalog(JSON.parse(raw), "native");
    } catch {
      return [];
    }
  }

  async function write(presets: readonly DrumPreset[]): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, catalogToJson(presets), "utf8");
  }

  return {
    async list() {
      return read();
    },
    async upsert(raw: unknown): Promise<DrumPreset> {
      const incoming = parseDrumPreset(raw, "native");
      if (!incoming) throw new Error("Invalid rhythm preset");
      const preset: DrumPreset = {
        ...incoming,
        name: normalizePresetName(incoming.name),
        source: "native",
        updatedAt: new Date().toISOString(),
      };
      const next = upsertPreset(await read(), preset);
      await write(next);
      return next.find((p) => p.name.toLowerCase() === preset.name.toLowerCase()) ?? preset;
    },
    async remove(id: string): Promise<boolean> {
      const current = await read();
      if (!current.some((p) => p.id === id)) return false;
      await write(removePreset(current, id));
      return true;
    },
  };
}
