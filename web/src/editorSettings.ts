import { useCallback, useState } from "react";

export const TUNER_VIEWS = ["full", "window"] as const;
export type TunerView = (typeof TUNER_VIEWS)[number];

export const START_MEMORIES = ["last", "first"] as const;
export type StartMemory = (typeof START_MEMORIES)[number];

export type EditorSettings = {
  /** Drop the side margins and max width so the editor uses the whole window. */
  fullWidth: boolean;
  showBreadcrumbs: boolean;
  /** When off, memories are picked from a select in place of the Memory tab. */
  showMemorySidebar: boolean;
  showChain: boolean;
  show3dModel: boolean;
  tunerView: TunerView;
  showGuide: boolean;
  /** Write pending memory edits to the open RC-600 folder on a timer. */
  autoSave: boolean;
  autoSaveSeconds: number;
  /** Memory selected when files are opened: the last one used, or the first. */
  startMemory: StartMemory;
};

export const AUTO_SAVE_MIN_SECONDS = 3;
export const AUTO_SAVE_MAX_SECONDS = 120;

const KEY = "rc600.editorSettings";
const DEFAULTS: EditorSettings = {
  fullWidth: false,
  showBreadcrumbs: true,
  showMemorySidebar: true,
  showChain: false,
  show3dModel: false,
  tunerView: "full",
  showGuide: true,
  autoSave: false,
  autoSaveSeconds: 10,
  startMemory: "last",
};

function load(): EditorSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    const next: Record<string, unknown> = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as (keyof EditorSettings)[]) {
      if (typeof raw[key] === typeof DEFAULTS[key]) next[key] = raw[key];
    }
    if (!(TUNER_VIEWS as readonly unknown[]).includes(next.tunerView)) next.tunerView = DEFAULTS.tunerView;
    if (!(START_MEMORIES as readonly unknown[]).includes(next.startMemory)) next.startMemory = DEFAULTS.startMemory;
    const seconds = Math.round(Number(next.autoSaveSeconds));
    next.autoSaveSeconds = Number.isFinite(seconds)
      ? Math.min(AUTO_SAVE_MAX_SECONDS, Math.max(AUTO_SAVE_MIN_SECONDS, seconds))
      : DEFAULTS.autoSaveSeconds;
    return next as EditorSettings;
  } catch {
    return DEFAULTS;
  }
}

const LAST_SLOT_KEY = "rc600.lastMemorySlot";

export function saveLastMemorySlot(slot: number): void {
  try {
    localStorage.setItem(LAST_SLOT_KEY, String(slot));
  } catch {
    /* storage blocked */
  }
}

/** Slot to select when files open, or null to use the first memory. */
export function startMemorySlot(folderSlot?: number | null): number | null {
  if (load().startMemory === "first") return null;
  if (folderSlot) return folderSlot;
  try {
    const slot = Number(localStorage.getItem(LAST_SLOT_KEY));
    return Number.isInteger(slot) && slot > 0 ? slot : null;
  } catch {
    return null;
  }
}

export function useEditorSettings() {
  const [settings, setSettings] = useState<EditorSettings>(load);
  const update = useCallback((patch: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked: keep the in-memory value */
      }
      return next;
    });
  }, []);
  return [settings, update] as const;
}
