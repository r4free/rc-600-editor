import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  parseLibraryPart,
  parsePartLibrary,
  partLibraryToJson,
  removePart,
  upsertPart,
  type LibraryPart,
} from "../web/src/rhythmConverter/partLibrary.js";
import { isNativePresetWriteAllowed } from "./drum-presets.js";

export const isNativePartWriteAllowed = isNativePresetWriteAllowed;

export function createNativePartFileStore(filePath: string) {
  async function read(): Promise<LibraryPart[]> {
    try {
      const raw = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
      return parsePartLibrary(JSON.parse(raw), "native");
    } catch {
      return [];
    }
  }

  async function write(parts: readonly LibraryPart[]): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, partLibraryToJson(parts), "utf8");
  }

  return {
    async list() {
      return read();
    },
    async upsert(raw: unknown): Promise<LibraryPart> {
      const incoming = parseLibraryPart(raw, "native");
      if (!incoming) throw new Error("Invalid rhythm part");
      const part: LibraryPart = { ...incoming, source: "native", updatedAt: new Date().toISOString() };
      const next = upsertPart(await read(), part);
      await write(next);
      return (
        next.find((p) => p.kind === part.kind && p.name.toLowerCase() === part.name.toLowerCase()) ?? part
      );
    },
    async remove(id: string): Promise<boolean> {
      const current = await read();
      if (!current.some((p) => p.id === id)) return false;
      await write(removePart(current, id));
      return true;
    },
  };
}
