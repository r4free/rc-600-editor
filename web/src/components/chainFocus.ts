import type { MemorySelectId } from "./memoryChainModel";

export type MemoryTabId =
  | "info"
  | "loop"
  | "audio"
  | "ctl"
  | "assigns"
  | "input"
  | "output"
  | "mixer"
  | "ifx"
  | "tfx";

export type ChainFocus = {
  tab: MemoryTabId;
  /** Pref keys written before switching the main tab. */
  prefs: Record<string, string | number>;
};

const FX_BANK_PAGES = ["A", "B", "C", "D"] as const;

/** Map a chain node selection to the memory editor tab + persisted sub-tab prefs. */
export function chainFocusFor(selectId: MemorySelectId): ChainFocus {
  if (selectId.startsWith("input:")) {
    return { tab: "input", prefs: { "input.mem": "setup" } };
  }
  if (selectId.startsWith("ifx:")) {
    const parts = selectId.split(":");
    const bank = Number(parts[1] ?? 0);
    const slot = Number(parts[2] ?? 0);
    const page = FX_BANK_PAGES[Math.max(0, Math.min(3, bank))] ?? "A";
    return {
      tab: "ifx",
      prefs: { ifx: page, ifxSlot: Math.max(0, Math.min(3, slot)) },
    };
  }
  if (selectId.startsWith("track:")) {
    const track = Number(selectId.slice("track:".length));
    return {
      tab: "loop",
      prefs: {
        loop: "track",
        loopTrack: Math.max(1, Math.min(6, track || 1)),
      },
    };
  }
  if (selectId === "rhythm") {
    return { tab: "loop", prefs: { loop: "rhythm" } };
  }
  if (selectId.startsWith("tfx:")) {
    const parts = selectId.split(":");
    const bank = Number(parts[1] ?? 0);
    const slot = Number(parts[2] ?? 0);
    const page = FX_BANK_PAGES[Math.max(0, Math.min(3, bank))] ?? "A";
    return {
      tab: "tfx",
      prefs: { tfx: page, tfxSlot: Math.max(0, Math.min(3, slot)) },
    };
  }
  if (selectId === "mix") {
    return { tab: "mixer", prefs: { "mixer.mem": "output" } };
  }
  if (selectId.startsWith("dest:")) {
    return { tab: "output", prefs: { "output.mem": "routing" } };
  }
  if (selectId === "mfx") {
    return { tab: "output", prefs: { "output.mem": "mfx" } };
  }
  return { tab: "loop", prefs: {} };
}
