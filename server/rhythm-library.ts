import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  parseLibraryRhythm,
  parseRhythmLibrary,
  removeRhythm,
  rhythmLibraryToJson,
  upsertRhythm,
  type LibraryRhythm,
} from "../web/src/rhythmConverter/rhythmLibrary.js";

export function createNativeRhythmFileStore(filePath: string) {
  async function read(): Promise<LibraryRhythm[]> {
    try {
      const raw = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
      return parseRhythmLibrary(JSON.parse(raw), "native");
    } catch {
      return [];
    }
  }

  async function write(rhythms: readonly LibraryRhythm[]): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, rhythmLibraryToJson(rhythms), "utf8");
  }

  return {
    async list() {
      return read();
    },
    async upsert(raw: unknown): Promise<LibraryRhythm> {
      const incoming = parseLibraryRhythm(raw, "native");
      if (!incoming) throw new Error("Invalid rhythm");
      const rhythm: LibraryRhythm = { ...incoming, source: "native", updatedAt: new Date().toISOString() };
      const next = upsertRhythm(await read(), rhythm);
      await write(next);
      return next.find((r) => r.name.toLowerCase() === rhythm.name.toLowerCase()) ?? rhythm;
    },
    async remove(id: string): Promise<boolean> {
      const current = await read();
      if (!current.some((r) => r.id === id)) return false;
      await write(removeRhythm(current, id));
      return true;
    },
  };
}
