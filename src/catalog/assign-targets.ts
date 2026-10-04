import {
  INPUT_FX_TYPE_OPTIONS,
  RHYTHM_KITS,
  TRACK_FX_TYPE_OPTIONS,
  panLabel,
  type EnumOption,
} from "./params.js";

export type AssignValueRange =
  | { kind: "int"; min: number; max: number; format?: (v: number) => string }
  | { kind: "enum"; options: EnumOption[] };

export interface AssignTarget {
  value: number;
  label: string;
  category: AssignTargetCategory;
  info: string;
  range: AssignValueRange;
}

export const ASSIGN_TARGET_CATEGORIES = [
  "Track 1",
  "Track 2",
  "Track 3",
  "Track 4",
  "Track 5",
  "Track 6",
  "Current Track",
  "Tempo",
  "Input FX",
  "Input FX Slots",
  "Input FX Banks",
  "Input FX Current",
  "Track FX",
  "Track FX Slots",
  "Track FX Banks",
  "Track FX Current",
  "Rhythm",
  "Mixer",
  "Input",
  "Output",
  "EQ",
  "Pedal",
  "MIDI CC",
] as const;

export type AssignTargetCategory = (typeof ASSIGN_TARGET_CATEGORIES)[number];

const ON_OFF: AssignValueRange = {
  kind: "enum",
  options: [
    { value: 0, label: "OFF" },
    { value: 1, label: "ON" },
  ],
};

const TRIGGER: AssignValueRange = { kind: "int", min: 0, max: 127 };
const MIDI_7BIT: AssignValueRange = { kind: "int", min: 0, max: 127 };
const LEVEL_200: AssignValueRange = { kind: "int", min: 0, max: 200 };
const LEVEL_100: AssignValueRange = { kind: "int", min: 0, max: 100 };
const STEP_MAX: AssignValueRange = { kind: "int", min: 1, max: 16 };
const PAN: AssignValueRange = { kind: "int", min: 0, max: 100, format: panLabel };
const TEMPO: AssignValueRange = {
  kind: "int",
  min: 400,
  max: 3000,
  format: (v) => (v / 10).toFixed(1),
};

/** Same order as FX Switch Mode and Assign Source Mode: 0 = Toggle, 1 = Moment. */
const MOMENT_TOGGLE: AssignValueRange = {
  kind: "enum",
  options: [
    { value: 0, label: "Toggle" },
    { value: 1, label: "Moment" },
  ],
};

const VARIATION: AssignValueRange = {
  kind: "enum",
  options: [
    { value: 0, label: "A" },
    { value: 1, label: "B" },
    { value: 2, label: "C" },
    { value: 3, label: "D" },
  ],
};

const KIT: AssignValueRange = {
  kind: "enum",
  options: RHYTHM_KITS.map((label, value) => ({ value, label })),
};

const SPEED: AssignValueRange = {
  kind: "enum",
  options: [
    { value: 0, label: "Half" },
    { value: 1, label: "Normal" },
    { value: 2, label: "Double" },
  ],
};

const DUB_MODE: AssignValueRange = {
  kind: "enum",
  options: [
    { value: 0, label: "Overdub" },
    { value: 1, label: "Replace 1" },
    { value: 2, label: "Replace 2" },
  ],
};

const TRACK_NUM: AssignValueRange = {
  kind: "enum",
  options: [1, 2, 3, 4, 5, 6].map((n, i) => ({ value: i, label: `Track ${n}` })),
};

const PEDAL_MODE: AssignValueRange = {
  kind: "enum",
  options: [
    { value: 0, label: "Mode 1" },
    { value: 1, label: "Mode 2" },
    { value: 2, label: "Mode 3" },
  ],
};

function fxTypeRange(options: EnumOption[]): AssignValueRange {
  return { kind: "enum", options };
}

const SLOTS = ["A", "B", "C", "D"] as const;
const BANKS = ["A", "B", "C", "D"] as const;

function midiCcLabel(cc: number): string {
  return `MIDI CC#${String(cc).padStart(2, "0")}`;
}

function buildAssignTargets(): AssignTarget[] {
  const out: AssignTarget[] = [];
  let value = 0;
  let category: AssignTargetCategory = "Track 1";

  const push = (label: string, info: string, range: AssignValueRange) => {
    out.push({ value: value++, label, category, info, range });
  };

  const trackFns: { name: string; info: (t: string) => string; range: AssignValueRange }[] = [
    {
      name: "Rec/Play",
      info: (t) => `Switch record / play / overdub on ${t}.`,
      range: TRIGGER,
    },
    { name: "Play/Stop", info: (t) => `Switch play / stop on ${t}.`, range: TRIGGER },
    { name: "Stop", info: (t) => `Stop record / play on ${t}.`, range: TRIGGER },
    { name: "Clear", info: (t) => `Clear ${t}.`, range: TRIGGER },
    { name: "Reverse", info: (t) => `Turn reverse play on/off for ${t}.`, range: ON_OFF },
    {
      name: "Undo/Redo",
      info: (t) => `Undo / redo recording or the last overdub on ${t}.`,
      range: TRIGGER,
    },
    {
      name: "Mark Back",
      info: (t) => `Restore the marked overdub on ${t}, or the post-record state if no mark is set.`,
      range: TRIGGER,
    },
    {
      name: "Rec Back",
      info: (t) => `Restore ${t} to how it was right after recording.`,
      range: TRIGGER,
    },
    { name: "Mark Set", info: (t) => `Mark the current overdub state on ${t}.`, range: TRIGGER },
    { name: "Mark Clear", info: (t) => `Delete the mark on ${t}.`, range: TRIGGER },
    {
      name: "Play Level",
      info: (t) => `Control Play Level of ${t} (0–200).`,
      range: LEVEL_200,
    },
  ];

  for (let tr = 1; tr <= 6; tr++) {
    category = `Track ${tr}` as AssignTargetCategory;
    const t = `Track ${tr}`;
    for (const fn of trackFns) push(`${t} ${fn.name}`, fn.info(t), fn.range);
  }

  category = "Current Track";
  const cur = "the current track";
  for (const fn of trackFns) push(`Current Track ${fn.name}`, fn.info(cur), fn.range);
  push("Current Track Inc", "Switch the current track 1 → 2 → … → 6.", TRIGGER);
  push("Current Track Dec", "Switch the current track 6 → 5 → … → 1.", TRIGGER);
  push("Current Track Num", "Switch to the track set in Current Track.", TRACK_NUM);

  category = "Tempo";
  push(
    "All Start/Stop",
    "Start all tracks together, or stop them if they are playing or recording.",
    TRIGGER,
  );
  push("Tap Tempo", "Tap tempo. Long-press reverts to the previous tempo.", TRIGGER);
  push("Tempo", "Control the memory tempo (40.0–300.0).", TEMPO);

  const pushFxFamily = (kind: "Input FX" | "Track FX") => {
    const typeRange = fxTypeRange(
      kind === "Input FX" ? INPUT_FX_TYPE_OPTIONS : TRACK_FX_TYPE_OPTIONS,
    );
    const typeInc =
      kind === "Input FX"
        ? "Cycle the effect type from LPF toward Reverse Reverb."
        : "Cycle the effect type from LPF toward Vinyl Flick.";
    const typeDec =
      kind === "Input FX"
        ? "Cycle the effect type from Reverse Reverb toward LPF."
        : "Cycle the effect type from Vinyl Flick toward LPF.";

    /**
     * The pedal lists every parameter of one FX slot, then the next slot.
     * (On/off, Control, Type, Type Inc/Dec, Switch Mode, Param 1–4, Sequence,
     * Step Sync, Retrigger, Step Rate, Step Max.) Grouping by parameter instead
     * shifts names: Input FX B lands on Input FX D Type Inc.
     */
    const pushFxSlot = (label: string) => {
      push(label, `Turn ${label} on/off.`, ON_OFF);
      push(`${label} Control`, `Control intensity of ${label}.`, LEVEL_100);
      push(`${label} Type`, `Switch the effect type of ${label}.`, typeRange);
      push(`${label} Type Inc`, `${typeInc} (${label}).`, TRIGGER);
      push(`${label} Type Dec`, `${typeDec} (${label}).`, TRIGGER);
      push(`${label} Switch Mode`, `Toggle / Moment for ${label}.`, MOMENT_TOGGLE);
      for (let prm = 1; prm <= 4; prm++) {
        push(`${label} Param ${prm}`, `Control parameter ${prm} of ${label}.`, MIDI_7BIT);
      }
      push(`${label} Sequence`, `FX sequence on/off for ${label}.`, ON_OFF);
      push(`${label} Step Sync`, `Step Sync for ${label}.`, ON_OFF);
      push(`${label} Retrigger`, `Retrigger for ${label}.`, ON_OFF);
      push(`${label} Step Rate`, `Step Rate for ${label}.`, LEVEL_100);
      push(`${label} Step Max`, `Step Max for ${label}.`, STEP_MAX);
    };

    const pushSlotGroup = () => {
      category = `${kind} Slots`;
      for (const slot of SLOTS) pushFxSlot(`${kind} ${slot}`);
    };

    const pushBankGroup = () => {
      category = `${kind} Banks`;
      for (const bank of BANKS) {
        for (const slot of SLOTS) pushFxSlot(`${kind} ${bank}-${slot}`);
      }
    };

    category = kind;
    push(kind, `Turn ${kind} on/off.`, ON_OFF);
    push(`${kind} Target Inc`, `Switch the ${kind} target A → D in the current bank.`, TRIGGER);
    push(`${kind} Target Dec`, `Switch the ${kind} target D → A in the current bank.`, TRIGGER);
    push(`${kind} Bank Inc`, `Switch the ${kind} bank A → D.`, TRIGGER);
    push(`${kind} Bank Dec`, `Switch the ${kind} bank D → A.`, TRIGGER);
    push(
      `${kind} Switch Mode`,
      `Toggle / Moment for ${kind} A–D in the current bank.`,
      MOMENT_TOGGLE,
    );
    pushSlotGroup();
    pushBankGroup();
    category = `${kind} Current`;
    push(`${kind} Current`, `Turn the currently selected ${kind} on/off.`, ON_OFF);
    push(`${kind} Current Control`, `Control intensity of the currently selected ${kind}.`, LEVEL_100);
    push(`${kind} Current Type`, `Switch the type of the currently selected ${kind}.`, typeRange);
    push(`${kind} Current Type Inc`, typeInc, TRIGGER);
    push(`${kind} Current Type Dec`, typeDec, TRIGGER);
    push(
      `${kind} Current Switch Mode`,
      `Toggle / Moment for the currently selected ${kind}.`,
      MOMENT_TOGGLE,
    );
    for (let prm = 1; prm <= 4; prm++) {
      push(
        `${kind} Current Param ${prm}`,
        `Control parameter ${prm} of the currently selected ${kind}.`,
        MIDI_7BIT,
      );
    }
    push(`${kind} Current Sequence`, `FX sequence on/off for the currently selected ${kind}.`, ON_OFF);
    push(`${kind} Current Step Sync`, `Step Sync for the currently selected ${kind}.`, ON_OFF);
    push(`${kind} Current Retrigger`, `Retrigger for the currently selected ${kind}.`, ON_OFF);
    push(`${kind} Current Step Rate`, `Step Rate for the currently selected ${kind}.`, LEVEL_100);
    push(`${kind} Current Step Max`, `Step Max for the currently selected ${kind}.`, STEP_MAX);
  };

  pushFxFamily("Input FX");
  pushFxFamily("Track FX");

  category = "Rhythm";
  push("Rhythm Start/Stop", "Start or stop the rhythm.", TRIGGER);
  push("Rhythm Start", "Start the rhythm.", TRIGGER);
  push("Rhythm Stop", "Stop the rhythm.", TRIGGER);
  push("Rhythm Level", "Control Rhythm Out (0–200).", LEVEL_200);
  category = "Input";
  push("Mic In Mute", "Mute MIC 1 and MIC 2.", ON_OFF);
  push("Mic 1 In Mute", "Mute MIC 1.", ON_OFF);
  push("Mic 2 In Mute", "Mute MIC 2.", ON_OFF);
  category = "Mixer";
  for (let tr = 1; tr <= 6; tr++) {
    push(`Track ${tr} Fader`, `Control the volume of Track ${tr}.`, LEVEL_200);
  }
  for (let tr = 1; tr <= 6; tr++) {
    push(`Track ${tr} 1 Shot`, `Turn 1 Shot on/off for Track ${tr}.`, ON_OFF);
  }
  for (let tr = 1; tr <= 6; tr++) {
    push(`Track ${tr} Pan`, `Control Pan for Track ${tr}.`, PAN);
  }
  for (let tr = 1; tr <= 6; tr++) {
    push(`Track ${tr} FX`, `Turn Input FX / Track FX on/off for Track ${tr}.`, ON_OFF);
  }
  for (let tr = 1; tr <= 6; tr++) {
    push(`Track ${tr} Speed`, `Tempo Sync Speed for Track ${tr}.`, SPEED);
  }
  for (let tr = 1; tr <= 6; tr++) {
    push(`Track ${tr} Bounce In`, `Bounce In on/off for Track ${tr}.`, ON_OFF);
  }
  push("Dub Mode", "Control Dub Mode.", DUB_MODE);
  push("Auto Rec", "Turn Auto Rec on/off.", ON_OFF);
  push("Bounce", "Turn Bounce on/off.", ON_OFF);
  category = "Rhythm";
  push("Rhythm Variation", "Switch the rhythm pattern variation.", VARIATION);
  push("Rhythm Kit", "Switch the drum kit.", KIT);
  category = "Input";
  push("Mic 1 Level", "MIC 1 input level.", LEVEL_200);
  push("Mic 2 Level", "MIC 2 input level.", LEVEL_200);
  push("Inst 1 L Level", "INST 1 L input level.", LEVEL_200);
  push("Inst 1 R Level", "INST 1 R input level.", LEVEL_200);
  push("Inst 1 L Mute", "Mute INST 1 L.", ON_OFF);
  push("Inst 1 R Mute", "Mute INST 1 R.", ON_OFF);
  push("Inst 2 L Level", "INST 2 L input level.", LEVEL_200);
  push("Inst 2 R Level", "INST 2 R input level.", LEVEL_200);
  push("Inst 2 L Mute", "Mute INST 2 L.", ON_OFF);
  push("Inst 2 R Mute", "Mute INST 2 R.", ON_OFF);
  category = "Output";
  push("Loop Level", "Loop playback output level.", LEVEL_200);
  push("Main L Level", "MAIN L output level.", LEVEL_200);
  push("Main R Level", "MAIN R output level.", LEVEL_200);
  push("Sub 1 L Level", "SUB 1 L output level.", LEVEL_200);
  push("Sub 1 R Level", "SUB 1 R output level.", LEVEL_200);
  push("Sub 2 L Level", "SUB 2 L output level.", LEVEL_200);
  push("Sub 2 R Level", "SUB 2 R output level.", LEVEL_200);
  push("Phones Level", "PHONES output level.", LEVEL_200);
  push("Master Level", "Overall MAIN / SUB 1 / SUB 2 output level.", LEVEL_200);
  category = "Input";
  push("Inst 1 Gain", "INST 1 input gain.", LEVEL_100);
  push("Inst 2 Gain", "INST 2 input gain.", LEVEL_100);
  category = "EQ";
  push("EQ Mic 1", "Equalizer on/off for MIC 1.", ON_OFF);
  push("EQ Mic 2", "Equalizer on/off for MIC 2.", ON_OFF);
  push("EQ Inst 1 L", "Equalizer on/off for INST 1 L.", ON_OFF);
  push("EQ Inst 1 R", "Equalizer on/off for INST 1 R.", ON_OFF);
  push("EQ Inst 2 L", "Equalizer on/off for INST 2 L.", ON_OFF);
  push("EQ Inst 2 R", "Equalizer on/off for INST 2 R.", ON_OFF);
  category = "Input";
  push("Input Thru", "Input Thru for Input/Rhythm routing.", ON_OFF);
  category = "EQ";
  push("EQ Main L", "Equalizer on/off for MAIN L.", ON_OFF);
  push("EQ Main R", "Equalizer on/off for MAIN R.", ON_OFF);
  push("EQ Sub 1 L", "Equalizer on/off for SUB 1 L.", ON_OFF);
  push("EQ Sub 1 R", "Equalizer on/off for SUB 1 R.", ON_OFF);
  push("EQ Sub 2 L", "Equalizer on/off for SUB 2 L.", ON_OFF);
  push("EQ Sub 2 R", "Equalizer on/off for SUB 2 R.", ON_OFF);
  category = "Pedal";
  push("Pedal Mode", "Switch pedal mode.", PEDAL_MODE);
  category = "MIDI CC";
  for (let cc = 1; cc <= 31; cc++) {
    push(midiCcLabel(cc), `Transmit ${midiCcLabel(cc)} from MIDI OUT.`, MIDI_7BIT);
  }
  for (let cc = 64; cc <= 127; cc++) {
    push(midiCcLabel(cc), `Transmit ${midiCcLabel(cc)} from MIDI OUT.`, MIDI_7BIT);
  }

  const rhythmVari = out.find((t) => t.label === "Rhythm Variation");
  if (rhythmVari?.value !== 771) {
    throw new Error(`Rhythm Variation is ${rhythmVari?.value}, expected 771`);
  }
  return out;
}

export const ASSIGN_TARGETS: AssignTarget[] = buildAssignTargets();

export function assignTargetOptions(): EnumOption[] {
  return ASSIGN_TARGETS.map(({ value, label }) => ({ value, label }));
}

export function matchAssignTarget(target: AssignTarget, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return `${target.category} ${target.label}`.toLowerCase().includes(normalized);
}

export interface AssignTargetGroup {
  category: AssignTargetCategory;
  targets: AssignTarget[];
}

export function groupAssignTargets(targets: readonly AssignTarget[]): AssignTargetGroup[] {
  return ASSIGN_TARGET_CATEGORIES.flatMap((category) => {
    const matches = targets.filter((target) => target.category === category);
    return matches.length ? [{ category, targets: matches }] : [];
  });
}

export function assignTargetByValue(v: number): AssignTarget | undefined {
  return ASSIGN_TARGETS.find((t) => t.value === v);
}

export function assignTargetLabel(v: number): string {
  return assignTargetByValue(v)?.label ?? String(v);
}

export function assignTargetInfo(v: number): string | undefined {
  return assignTargetByValue(v)?.info;
}

export function assignTargetRange(v: number): AssignValueRange {
  return assignTargetByValue(v)?.range ?? TRIGGER;
}

export function assignRangeBounds(range: AssignValueRange): { min: number; max: number } {
  if (range.kind === "int") return { min: range.min, max: range.max };
  const vals = range.options.map((o) => o.value);
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

export function clampAssignValue(range: AssignValueRange, v: number): number {
  const { min, max } = assignRangeBounds(range);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function formatAssignValue(range: AssignValueRange, v: number): string {
  if (range.kind === "enum") {
    return range.options.find((o) => o.value === v)?.label ?? String(v);
  }
  return range.format?.(v) ?? String(v);
}

export function assignRangeOptions(range: AssignValueRange, value: number): EnumOption[] {
  if (range.kind !== "enum") return [];
  const options = [...range.options];
  if (!options.some((o) => o.value === value)) options.push({ value, label: `Value ${value}` });
  return options;
}
