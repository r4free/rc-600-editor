import {
  emptyMemoryCopySelection,
  memoryCopySelectionHasContent,
  parseMemoryCopySelection,
  selectAllMemoryCopySelection,
  summarizeMemoryCopySelection,
  wavTracksForSelection,
  type MemoryCopySelection,
} from "@rc600/rc0/memoryCopy";

export const MEMORY_CLIPBOARD_KEY = "rc600.memoryClipboard.v1";
export const MEMORY_COPY_SKIP_CONFIRM_KEY = "rc600.memoryCopy.skipConfirm";

export type MemoryClipboard = {
  sourceSlot: number;
  sourceName: string;
  sourceXml: string;
  selection: MemoryCopySelection;
  summary: string;
  copiedAt: string;
};

export {
  emptyMemoryCopySelection,
  memoryCopySelectionHasContent,
  parseMemoryCopySelection,
  selectAllMemoryCopySelection,
  summarizeMemoryCopySelection,
  wavTracksForSelection,
  type MemoryCopySelection,
};

function defaultStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function loadMemoryClipboard(storage: Storage | null = defaultStorage()): MemoryClipboard | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(MEMORY_CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.sourceSlot !== "number" || typeof o.sourceXml !== "string") return null;
    if (typeof o.sourceName !== "string" || typeof o.copiedAt !== "string") return null;
    const selection = parseMemoryCopySelection(o.selection);
    if (!selection || !memoryCopySelectionHasContent(selection)) return null;
    return {
      sourceSlot: o.sourceSlot,
      sourceName: o.sourceName,
      sourceXml: o.sourceXml,
      selection,
      summary: typeof o.summary === "string" ? o.summary : summarizeMemoryCopySelection(selection),
      copiedAt: o.copiedAt,
    };
  } catch {
    return null;
  }
}

export function saveMemoryClipboard(
  clip: Omit<MemoryClipboard, "summary" | "copiedAt"> & { summary?: string; copiedAt?: string },
  storage: Storage | null = defaultStorage(),
): MemoryClipboard {
  const next: MemoryClipboard = {
    sourceSlot: clip.sourceSlot,
    sourceName: clip.sourceName,
    sourceXml: clip.sourceXml,
    selection: clip.selection,
    summary: clip.summary ?? summarizeMemoryCopySelection(clip.selection),
    copiedAt: clip.copiedAt ?? new Date().toISOString(),
  };
  if (storage) {
    try {
      storage.setItem(MEMORY_CLIPBOARD_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }
  return next;
}

export function clearMemoryClipboard(storage: Storage | null = defaultStorage()): void {
  storage?.removeItem(MEMORY_CLIPBOARD_KEY);
}

export function loadSkipApplyConfirm(storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false;
  return storage.getItem(MEMORY_COPY_SKIP_CONFIRM_KEY) === "1";
}

export function saveSkipApplyConfirm(skip: boolean, storage: Storage | null = defaultStorage()): void {
  if (!storage) return;
  if (skip) storage.setItem(MEMORY_COPY_SKIP_CONFIRM_KEY, "1");
  else storage.removeItem(MEMORY_COPY_SKIP_CONFIRM_KEY);
}
