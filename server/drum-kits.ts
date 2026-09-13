import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  kitsToJson,
  normalizeKitName,
  parseDrumKit,
  parseDrumKitCatalog,
  removeKit,
  upsertKit,
  type DrumKit,
} from "../web/src/presets/drumKit.js";
import { isNativePresetWriteAllowed } from "./drum-presets.js";

export const isNativeKitWriteAllowed = isNativePresetWriteAllowed;

export function createNativeKitFileStore(filePath: string) {
  async function read(): Promise<DrumKit[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      return parseDrumKitCatalog(JSON.parse(raw), "native");
    } catch {
      return [];
    }
  }

  async function write(kits: readonly DrumKit[]): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, kitsToJson(kits), "utf8");
  }

  return {
    async list() {
      return read();
    },
    async upsert(raw: unknown): Promise<DrumKit> {
      const incoming = parseDrumKit(raw, "native");
      if (!incoming) throw new Error("Invalid drum kit");
      const kit: DrumKit = {
        ...incoming,
        name: normalizeKitName(incoming.name),
        source: "native",
        updatedAt: new Date().toISOString(),
      };
      const next = upsertKit(await read(), kit);
      await write(next);
      return next.find((k) => k.name.toLowerCase() === kit.name.toLowerCase()) ?? kit;
    },
    async remove(id: string): Promise<boolean> {
      const current = await read();
      if (!current.some((k) => k.id === id)) return false;
      await write(removeKit(current, id));
      return true;
    },
  };
}
