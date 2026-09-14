import type { TagMap } from "./memory.js";

/**
 * Granular memory copy selection, aligned with memory editor tabs / sub-tabs.
 * Shared by web clipboard + assemble.
 */
export type MemoryCopySelection = {
  /** When true, copy entire memory XML (WAV handled separately by client). */
  copyAll: boolean;

  // Loop → Tracks / Record / Play / Rhythm
  tracks: number[];
  includeWav: boolean;
  includeAllWav: boolean;
  rec: boolean;
  play: boolean;
  rhythm: boolean;

  // Input → Setup / EQ / Dynamics
  inputSetup: boolean;
  inputEq: boolean;
  inputDynamics: boolean;

  // Output → Setup / Routing / EQ / Master FX
  outputSetup: boolean;
  routing: boolean;
  outputEq: boolean;
  masterFx: boolean;

  // Mixer → Input / Output
  mixerInput: boolean;
  mixerOutput: boolean;

  // Assigns
  assigns: number[];

  // Input FX → Setup / Bank A–D
  ifxSetup: boolean;
  ifxBanks: boolean[];
  ifxSlots: boolean[][];

  // Track FX → Setup / Bank A–D
  tfxSetup: boolean;
  tfxBanks: boolean[];
  tfxSlots: boolean[][];

  // Ctl Func → Mode 1–3 / Ext Ctrl
  ctlModes: boolean[][];
  ectlCtl: boolean[];
  ectlExp: boolean[];
};

/** INPUT section tags for Input → Setup. */
export const MEMORY_COPY_INPUT_SETUP_TAGS = ["A", "B", "C", "D", "E", "F", "G"] as const;
/** INPUT section tags for Input → Dynamics. */
export const MEMORY_COPY_INPUT_DYNAMICS_TAGS = ["H", "I", "J", "K", "L", "M"] as const;
/** MIXER tags for Mixer → Input. */
export const MEMORY_COPY_MIXER_INPUT_TAGS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
] as const;
/** MIXER tags for Mixer → Output (incl. Loop / Rhythm levels). */
export const MEMORY_COPY_MIXER_OUTPUT_TAGS = ["M", "N", "O", "P", "Q", "R", "S", "T"] as const;

export function emptyMemoryCopySelection(): MemoryCopySelection {
  return {
    copyAll: false,
    tracks: [],
    includeWav: false,
    includeAllWav: false,
    rec: false,
    play: false,
    rhythm: false,
    inputSetup: false,
    inputEq: false,
    inputDynamics: false,
    outputSetup: false,
    routing: false,
    outputEq: false,
    masterFx: false,
    mixerInput: false,
    mixerOutput: false,
    assigns: [],
    ifxSetup: false,
    ifxBanks: [false, false, false, false],
    ifxSlots: [
      [false, false, false, false],
      [false, false, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    tfxSetup: false,
    tfxBanks: [false, false, false, false],
    tfxSlots: [
      [false, false, false, false],
      [false, false, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    ctlModes: [
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
    ],
    ectlCtl: [false, false, false, false],
    ectlExp: [false, false],
  };
}

export function selectAllMemoryCopySelection(): MemoryCopySelection {
  const s = emptyMemoryCopySelection();
  s.copyAll = true;
  s.tracks = [1, 2, 3, 4, 5, 6];
  s.includeWav = true;
  s.includeAllWav = true;
  s.rec = true;
  s.play = true;
  s.rhythm = true;
  s.inputSetup = true;
  s.inputEq = true;
  s.inputDynamics = true;
  s.outputSetup = true;
  s.routing = true;
  s.outputEq = true;
  s.masterFx = true;
  s.mixerInput = true;
  s.mixerOutput = true;
  s.assigns = Array.from({ length: 16 }, (_, i) => i + 1);
  s.ifxSetup = true;
  s.ifxBanks = [true, true, true, true];
  s.ifxSlots = s.ifxSlots.map(() => [true, true, true, true]);
  s.tfxSetup = true;
  s.tfxBanks = [true, true, true, true];
  s.tfxSlots = s.tfxSlots.map(() => [true, true, true, true]);
  s.ctlModes = s.ctlModes.map(() => [true, true, true, true, true, true, true, true, true]);
  s.ectlCtl = [true, true, true, true];
  s.ectlExp = [true, true];
  return s;
}

export function memoryCopySelectionHasContent(sel: MemoryCopySelection): boolean {
  if (sel.copyAll) return true;
  if (sel.tracks.length) return true;
  if (sel.rec || sel.play || sel.rhythm) return true;
  if (sel.inputSetup || sel.inputEq || sel.inputDynamics) return true;
  if (sel.outputSetup || sel.routing || sel.outputEq || sel.masterFx) return true;
  if (sel.mixerInput || sel.mixerOutput) return true;
  if (sel.assigns.length) return true;
  if (sel.ifxSetup || sel.ifxBanks.some(Boolean) || sel.ifxSlots.some((row) => row.some(Boolean))) {
    return true;
  }
  if (sel.tfxSetup || sel.tfxBanks.some(Boolean) || sel.tfxSlots.some((row) => row.some(Boolean))) {
    return true;
  }
  if (sel.ctlModes.some((row) => row.some(Boolean))) return true;
  if (sel.ectlCtl.some(Boolean) || sel.ectlExp.some(Boolean)) return true;
  return false;
}

export function wavTracksForSelection(sel: MemoryCopySelection): number[] {
  if (sel.copyAll || sel.includeAllWav) return [1, 2, 3, 4, 5, 6];
  if (!sel.includeWav) return [];
  return sel.tracks.filter((t) => t >= 1 && t <= 6);
}

export function summarizeMemoryCopySelection(sel: MemoryCopySelection): string {
  if (sel.copyAll) return "Entire memory";
  const parts: string[] = [];
  if (sel.tracks.length) parts.push(`Tracks ${sel.tracks.join(",")}`);
  if (sel.rec) parts.push("Record");
  if (sel.play) parts.push("Play");
  if (sel.rhythm) parts.push("Rhythm");
  if (sel.inputSetup || sel.inputEq || sel.inputDynamics) {
    const bits = [
      sel.inputSetup ? "Setup" : null,
      sel.inputEq ? "EQ" : null,
      sel.inputDynamics ? "Dynamics" : null,
    ].filter(Boolean);
    parts.push(`Input (${bits.join(", ")})`);
  }
  if (sel.outputSetup || sel.routing || sel.outputEq || sel.masterFx) {
    const bits = [
      sel.outputSetup ? "Setup" : null,
      sel.routing ? "Routing" : null,
      sel.outputEq ? "EQ" : null,
      sel.masterFx ? "Master FX" : null,
    ].filter(Boolean);
    parts.push(`Output (${bits.join(", ")})`);
  }
  if (sel.mixerInput || sel.mixerOutput) {
    const bits = [sel.mixerInput ? "Input" : null, sel.mixerOutput ? "Output" : null].filter(Boolean);
    parts.push(`Mixer (${bits.join(", ")})`);
  }
  if (sel.assigns.length) parts.push(`Assigns (${sel.assigns.length})`);
  const ifxN =
    (sel.ifxSetup ? 1 : 0) +
    sel.ifxBanks.filter(Boolean).length +
    sel.ifxSlots.reduce((n, row) => n + row.filter(Boolean).length, 0);
  if (ifxN) parts.push(`Input FX (${ifxN})`);
  const tfxN =
    (sel.tfxSetup ? 1 : 0) +
    sel.tfxBanks.filter(Boolean).length +
    sel.tfxSlots.reduce((n, row) => n + row.filter(Boolean).length, 0);
  if (tfxN) parts.push(`Track FX (${tfxN})`);
  const ctlN =
    sel.ctlModes.reduce((n, row) => n + row.filter(Boolean).length, 0) +
    sel.ectlCtl.filter(Boolean).length +
    sel.ectlExp.filter(Boolean).length;
  if (ctlN) parts.push(`Ctl Func (${ctlN})`);
  if (sel.includeWav || sel.includeAllWav) parts.push("WAV");
  return parts.length ? parts.join(" · ") : "Nothing selected";
}

function isBoolArray(v: unknown, len: number): v is boolean[] {
  return Array.isArray(v) && v.length === len && v.every((x) => typeof x === "boolean");
}

function isNumArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

/** Validate/normalize unknown JSON into a selection (or null). */
export function parseMemoryCopySelection(raw: unknown): MemoryCopySelection | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const base = emptyMemoryCopySelection();
  if (typeof o.copyAll === "boolean") base.copyAll = o.copyAll;
  if (isNumArray(o.tracks)) {
    base.tracks = [...new Set(o.tracks.map((n) => Math.trunc(n)).filter((n) => n >= 1 && n <= 6))];
  }
  if (typeof o.includeWav === "boolean") base.includeWav = o.includeWav;
  if (typeof o.includeAllWav === "boolean") base.includeAllWav = o.includeAllWav;
  for (const key of [
    "rec",
    "play",
    "rhythm",
    "inputSetup",
    "inputEq",
    "inputDynamics",
    "outputSetup",
    "routing",
    "outputEq",
    "masterFx",
    "mixerInput",
    "mixerOutput",
    "ifxSetup",
    "tfxSetup",
  ] as const) {
    if (typeof o[key] === "boolean") base[key] = o[key] as boolean;
  }
  // Legacy coarse flags from the first clipboard schema
  if (typeof o.input === "boolean" && o.input) {
    base.inputSetup = true;
    base.inputEq = true;
    base.inputDynamics = true;
  }
  if (typeof o.output === "boolean" && o.output) {
    base.outputSetup = true;
    base.outputEq = true;
  }
  if (typeof o.mixer === "boolean" && o.mixer) {
    base.mixerInput = true;
    base.mixerOutput = true;
  }
  if (isNumArray(o.assigns)) {
    base.assigns = [...new Set(o.assigns.map((n) => Math.trunc(n)).filter((n) => n >= 1 && n <= 16))];
  }
  if (isBoolArray(o.ifxBanks, 4)) base.ifxBanks = [...o.ifxBanks];
  if (Array.isArray(o.ifxSlots) && o.ifxSlots.length === 4 && o.ifxSlots.every((r) => isBoolArray(r, 4))) {
    base.ifxSlots = o.ifxSlots.map((r) => [...(r as boolean[])]);
  }
  if (isBoolArray(o.tfxBanks, 4)) base.tfxBanks = [...o.tfxBanks];
  if (Array.isArray(o.tfxSlots) && o.tfxSlots.length === 4 && o.tfxSlots.every((r) => isBoolArray(r, 4))) {
    base.tfxSlots = o.tfxSlots.map((r) => [...(r as boolean[])]);
  }
  // Legacy: selecting any IFX/TFX bank/slot implied SETUP
  if (
    typeof o.ifxSetup !== "boolean" &&
    (base.ifxBanks.some(Boolean) || base.ifxSlots.some((row) => row.some(Boolean)))
  ) {
    base.ifxSetup = true;
  }
  if (
    typeof o.tfxSetup !== "boolean" &&
    (base.tfxBanks.some(Boolean) || base.tfxSlots.some((row) => row.some(Boolean)))
  ) {
    base.tfxSetup = true;
  }
  if (
    Array.isArray(o.ctlModes) &&
    o.ctlModes.length === 3 &&
    o.ctlModes.every((r) => isBoolArray(r, 9))
  ) {
    base.ctlModes = o.ctlModes.map((r) => [...(r as boolean[])]);
  }
  if (isBoolArray(o.ectlCtl, 4)) base.ectlCtl = [...o.ectlCtl];
  if (isBoolArray(o.ectlExp, 2)) base.ectlExp = [...o.ectlExp];
  return base;
}

export function pickTags(source: TagMap, tags: readonly string[]): TagMap {
  const out: TagMap = {};
  for (const tag of tags) {
    if (source[tag] !== undefined) out[tag] = source[tag]!;
  }
  return out;
}
