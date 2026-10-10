import { slotFileName, systemFileName } from "@rc600/files/roland";

export const MEMORY_SLOT_COUNT = 99;

export const OFFLINE_LABEL = "Offline (no pedal)";

export type OfflineTemplates = { memory: string; system: string };

const MEMORY_PATH = /^DATA\/MEMORY(\d{3})[AB]\.RC0$/i;

/** RC-600 numbers `<mem id>` from 0, so memory 1 is `id="0"`. */
export function withMemoryId(xml: string, slot: number): string {
  return xml.replace(/<mem id="\d+">/, `<mem id="${slot - 1}">`);
}

/** Rewrites `<mem id>` on any MEMORYnnnA/B path so a shared template lands in the right slot. */
export function withPathMemoryId(path: string, xml: string): string {
  const m = path.match(MEMORY_PATH);
  return m ? withMemoryId(xml, parseInt(m[1], 10)) : xml;
}

export function normalizeMemoryIds(files: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, xml] of files) out.set(path, withPathMemoryId(path, xml));
  return out;
}

/**
 * Adds the template for every memory (1–99) and SYSTEM file that is missing.
 * Template slots share one string; ids are fixed on write/export (`withPathMemoryId`).
 */
export function fillMissingSlots(
  files: Map<string, string>,
  templates: OfflineTemplates,
): { files: Map<string, string>; added: number[] } {
  const next = new Map(files);
  const added: number[] = [];
  for (let s = 1; s <= MEMORY_SLOT_COUNT; s++) {
    if (next.has(slotFileName(s, "A")) || next.has(slotFileName(s, "B"))) continue;
    next.set(slotFileName(s, "A"), templates.memory);
    added.push(s);
  }
  if (!next.has(systemFileName("1")) && !next.has(systemFileName("2"))) {
    next.set(systemFileName("1"), templates.system);
  }
  return { files: next, added };
}

export function buildOfflineBaseline(templates: OfflineTemplates): Map<string, string> {
  return fillMissingSlots(new Map(), templates).files;
}

let templatesPromise: Promise<OfflineTemplates> | null = null;

export function loadOfflineTemplates(): Promise<OfflineTemplates> {
  templatesPromise ??= (async () => {
    const [memory, system] = await Promise.all(
      ["MEMORY_INIT.RC0", "SYSTEM_INIT.RC0"].map(async (name) => {
        const res = await fetch(`/templates/${name}`);
        if (!res.ok) throw new Error(`Failed to load template ${name}`);
        return res.text();
      }),
    );
    return { memory, system };
  })().catch((e) => {
    templatesPromise = null;
    throw e;
  });
  return templatesPromise;
}
