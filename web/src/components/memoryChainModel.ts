/**
 * Fixed RC-600 memory signal-chain geometry (top → bottom, not a reorderable floorboard).
 *
 *   Input jacks (L/R when stereo link is off)
 *     ↓ Input FX slots (selected bank)
 *     ⇣ Input Thru (dashed)
 *   Tracks 1–6 (+ Rhythm)
 *     ↓ Track FX slots when track FX is ON
 *     ↓ Mix bus
 *     ↓ MAIN / SUB / PHONES
 *     ↓ Master FX on the insert jack
 */

import {
  FX_BANKS,
  INPUT_FX_TYPE_OPTIONS,
  OUTPUT_ROUTE_DESTS,
  bitOn,
  fxSlotSection,
  inputStereoLinked,
  outputRouteDestLabel,
  visibleOutputRouteDests,
  type OutputRouteDest,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";

export const NODE = 52;
export const V_GAP = 22;
export const LANE_DX = 72;
export const PAD_X = 28;
export const PAD_Y = 28;
export const SECTION_GAP = 36;

/** @deprecated use LANE_DX — kept for any external imports */
export const H_GAP = V_GAP;
/** @deprecated use LANE_DX */
export const LANE_DY = LANE_DX;

export type MemoryFlowTone =
  | "inst"
  | "fx"
  | "delay"
  | "reverb"
  | "master"
  | "routing"
  | "neutral";

export type MemoryFlowShape = "square" | "circle" | "bookend";

export type MemoryNodeKind =
  | "input"
  | "ifx"
  | "track"
  | "tfx"
  | "rhythm"
  | "mix"
  | "dest"
  | "mfx";

/** Stable id used for selection / jump focus. */
export type MemorySelectId =
  | `input:${string}`
  | `ifx:${number}:${number}`
  | `track:${number}`
  | "rhythm"
  | `tfx:${number}:${number}`
  | "mix"
  | `dest:${string}`
  | "mfx";

export type MemoryToggle =
  | { kind: "mixer"; tag: string }
  | { kind: "track"; track: number; tag: string }
  | { kind: "ifx"; section: string; tag: string }
  | { kind: "tfx"; section: string; tag: string };

export interface MemoryFlowNode {
  key: string;
  selectId: MemorySelectId;
  kind: MemoryNodeKind;
  label: string;
  sublabel?: string;
  shape: MemoryFlowShape;
  tone: MemoryFlowTone;
  x: number;
  y: number;
  lane?: string;
  inactive?: boolean;
  muted?: boolean;
  toggle?: MemoryToggle;
  /** True when SW corner LED should show as ON. */
  toggleOn?: boolean;
}

export type MemoryEdgeKind = "serial" | "fork" | "join" | "send" | "mix-join";

export interface MemoryFlowEdge {
  id: string;
  from: string;
  to: string;
  kind: MemoryEdgeKind;
  lane?: string;
  inactive?: boolean;
}

export interface MemoryFlowBand {
  lane: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  inactive?: boolean;
}

export interface MemoryFlowGraph {
  nodes: MemoryFlowNode[];
  edges: MemoryFlowEdge[];
  bands: MemoryFlowBand[];
  width: number;
  height: number;
  mixX: number;
  mixY: number;
  /** Horizontal mix bus behind the join (top-down layout). */
  mixBus: { left: number; top: number; width: number; height: number };
}

type InputLaneDef = {
  id: string;
  label: string;
  linkedLabel: string;
  /** IFX Insert enum values that hit this lane (raw jack indexes 1–6). */
  insertValues: number[];
  mixerMuteTag: string;
  linkTag?: "E" | "F" | "G";
  role: "primary" | "secondary";
};

const INPUT_LANES: InputLaneDef[] = [
  {
    id: "mic1",
    label: "MIC 1",
    linkedLabel: "MIC",
    insertValues: [1],
    mixerMuteTag: "B",
    linkTag: "E",
    role: "primary",
  },
  {
    id: "mic2",
    label: "MIC 2",
    linkedLabel: "MIC",
    insertValues: [2],
    mixerMuteTag: "D",
    linkTag: "E",
    role: "secondary",
  },
  {
    id: "inst1l",
    label: "INST 1 L",
    linkedLabel: "INST 1",
    insertValues: [3],
    mixerMuteTag: "F",
    linkTag: "F",
    role: "primary",
  },
  {
    id: "inst1r",
    label: "INST 1 R",
    linkedLabel: "INST 1",
    insertValues: [4],
    mixerMuteTag: "H",
    linkTag: "F",
    role: "secondary",
  },
  {
    id: "inst2l",
    label: "INST 2 L",
    linkedLabel: "INST 2",
    insertValues: [5],
    mixerMuteTag: "J",
    linkTag: "G",
    role: "primary",
  },
  {
    id: "inst2r",
    label: "INST 2 R",
    linkedLabel: "INST 2",
    insertValues: [6],
    mixerMuteTag: "L",
    linkTag: "G",
    role: "secondary",
  },
];

/** Master FX Insert enum → dest id. */
const MFX_INSERT_DEST: Record<number, string> = {
  0: "main-l",
  1: "main-r",
  2: "sub1-l",
  3: "sub1-r",
  4: "sub2-l",
  5: "sub2-r",
};

function num(tags: TagMap | undefined, tag: string, fallback = 0): number {
  const v = tags?.[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function fxTypeLabel(typeIdx: number): string {
  return INPUT_FX_TYPE_OPTIONS.find((o) => o.value === typeIdx)?.label ?? `Type ${typeIdx}`;
}

function stageY(stage: number): number {
  return PAD_Y + stage * (NODE + V_GAP);
}

function laneX(index: number, offset = 0): number {
  return PAD_X + offset + index * LANE_DX;
}

function visibleInputLanes(input: TagMap): InputLaneDef[] {
  return INPUT_LANES.filter((lane) => {
    if (lane.role !== "secondary" || !lane.linkTag) return true;
    return !inputStereoLinked(input, lane.linkTag);
  }).map((lane) => {
    if (lane.role === "primary" && lane.linkTag && inputStereoLinked(input, lane.linkTag)) {
      const partner = INPUT_LANES.find(
        (o) => o.linkTag === lane.linkTag && o.role === "secondary",
      );
      return {
        ...lane,
        label: lane.linkedLabel,
        insertValues: partner
          ? [...lane.insertValues, ...partner.insertValues]
          : lane.insertValues,
      };
    }
    return lane;
  });
}

type ActiveSlot = {
  bank: number;
  slot: number;
  letter: string;
  typeLabel: string;
  insert: number;
  section: string;
  /** Slot Switch is ON. */
  on: boolean;
  /** Bank Switch is ON. */
  bankOn: boolean;
};

/** All A–D slots of the selected bank (including Switch OFF — dimmed in the UI). */
function selectedBankSlots(
  setup: TagMap,
  banks: TagMap[],
  slots: TagMap[][],
): ActiveSlot[] {
  const bank = Math.max(0, Math.min(3, num(setup, "A")));
  const bankTags = banks[bank] ?? {};
  const bankOn = num(bankTags, "A", 1) === 1;
  const row = slots[bank] ?? [];
  const out: ActiveSlot[] = [];
  for (let s = 0; s < FX_BANKS.length; s++) {
    const tags = row[s] ?? {};
    out.push({
      bank,
      slot: s,
      letter: FX_BANKS[s]!,
      typeLabel: fxTypeLabel(num(tags, "C")),
      insert: num(tags, "D"),
      section: fxSlotSection(bank, s),
      on: num(tags, "A") === 1,
      bankOn,
    });
  }
  return out;
}

function ifxMatchesLane(slot: ActiveSlot, lane: InputLaneDef): boolean {
  if (slot.insert === 0) return true; // ALL
  return lane.insertValues.includes(slot.insert);
}

function destHasAnySource(routing: TagMap, dest: OutputRouteDest): boolean {
  return num(routing, dest.tagTrack) !== 0 || num(routing, dest.tagInput) !== 0;
}

function trackRoutedAnywhere(routing: TagMap, trackBit: number): boolean {
  for (const dest of OUTPUT_ROUTE_DESTS) {
    if (bitOn(num(routing, dest.tagTrack), trackBit)) return true;
  }
  return false;
}

function rhythmRoutedAnywhere(routing: TagMap): boolean {
  for (const dest of OUTPUT_ROUTE_DESTS) {
    if (bitOn(num(routing, dest.tagInput), 6)) return true;
  }
  return false;
}

function edgePathPoints(
  from: MemoryFlowNode,
  to: MemoryFlowNode,
  kind: MemoryEdgeKind,
): string {
  // Top-down: leave bottom center of `from`, enter top center of `to`.
  const x1 = from.x + NODE / 2;
  const y1 = from.y + NODE;
  const x2 = to.x + NODE / 2;
  const y2 = to.y;

  if (kind === "mix-join") {
    const my = to.y;
    return `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`;
  }

  if (kind === "send" || kind === "fork" || kind === "join") {
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }

  if (Math.abs(x1 - x2) < 1) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
}

export function memoryEdgePath(
  from: MemoryFlowNode,
  to: MemoryFlowNode,
  kind: MemoryEdgeKind,
): string {
  return edgePathPoints(from, to, kind);
}

/** Resolve which visible dest receives Master FX when Insert is not OFF. */
export function resolveMasterFxDestId(
  insert: number,
  output: TagMap,
  routing: TagMap,
): string | null {
  if (insert === 6) return null;
  const raw = MFX_INSERT_DEST[insert];
  if (!raw) return null;
  const dests = visibleOutputRouteDests(output, routing);
  if (dests.some((d) => d.id === raw)) return raw;
  // Stereo-linked: MAIN R insert → MAIN primary, etc.
  const rawDest = OUTPUT_ROUTE_DESTS.find((d) => d.id === raw);
  if (!rawDest?.linkTag) return null;
  const primary = dests.find((d) => d.linkTag === rawDest.linkTag && d.role === "primary");
  return primary?.id ?? null;
}

export function buildMemoryFlowGraph(model: MemoryModel): MemoryFlowGraph {
  const nodes: MemoryFlowNode[] = [];
  const edges: MemoryFlowEdge[] = [];
  const bands: MemoryFlowBand[] = [];

  const inputLanes = visibleInputLanes(model.input);
  const ifxSlots = selectedBankSlots(model.ifxSetup, model.ifxBanks, model.ifxSlots);
  const tfxSlots = selectedBankSlots(model.tfxSetup, model.tfxBanks, model.tfxSlots);
  const inputThru = num(model.routing, "P") === 1;
  const dests = visibleOutputRouteDests(model.output, model.routing);
  const mfxInsert = num(model.masterFx, "C", 6);
  const mfxDestId = resolveMasterFxDestId(mfxInsert, model.output, model.routing);

  // Stages go top → bottom: source, FX A–D, MIX, dests, Master FX.
  const seriesRows = Math.max(ifxSlots.length, tfxSlots.length, 1);
  const mixStage = 1 + seriesRows;
  const destStage = mixStage + 1;
  const mfxStage = destStage + 1;

  const inputCount = inputLanes.length;
  const trackOffsetX = inputCount * LANE_DX + (inputCount ? SECTION_GAP : 0);
  const bandH = stageY(mixStage) - PAD_Y + 6;

  // --- Input columns (sources at top, IFX downward) ---
  inputLanes.forEach((lane, i) => {
    const x = laneX(i);
    const muted = num(model.mixer, lane.mixerMuteTag) === 1;
    const inactive = muted;
    const laneId = `in-${lane.id}`;
    const jackKey = `input:${lane.id}`;

    bands.push({
      lane: laneId,
      label: lane.label,
      x: x - 8,
      y: PAD_Y - 8,
      w: NODE + 16,
      h: bandH,
      inactive,
    });

    nodes.push({
      key: jackKey,
      selectId: `input:${lane.id}`,
      kind: "input",
      label: lane.label,
      shape: "bookend",
      tone: "inst",
      x,
      y: stageY(0),
      lane: laneId,
      inactive,
      muted,
      toggle: { kind: "mixer", tag: lane.mixerMuteTag },
      toggleOn: !muted,
    });

    let prevKey = jackKey;
    ifxSlots.forEach((slot, si) => {
      const applies = ifxMatchesLane(slot, lane);
      const slotInactive = inactive || !slot.bankOn || !slot.on || !applies;
      const key = `ifx:${lane.id}:${slot.bank}:${slot.slot}`;
      nodes.push({
        key,
        selectId: `ifx:${slot.bank}:${slot.slot}`,
        kind: "ifx",
        label: `IFX ${slot.letter}`,
        sublabel: truncate(slot.typeLabel, 9),
        shape: "square",
        tone: "fx",
        x,
        y: stageY(1 + si),
        lane: laneId,
        inactive: slotInactive,
        toggle: { kind: "ifx", section: slot.section, tag: "A" },
        toggleOn: slot.on && slot.bankOn,
      });
      edges.push({
        id: `${prevKey}->${key}`,
        from: prevKey,
        to: key,
        kind: "serial",
        lane: laneId,
        inactive: slotInactive,
      });
      prevKey = key;
    });

    if (inputThru) {
      edges.push({
        id: `${prevKey}->MIX-thru`,
        from: prevKey,
        to: "MIX",
        kind: "send",
        lane: "send",
        inactive,
      });
    }
  });

  // --- Track + Rhythm columns ---
  for (let t = 1; t <= 6; t++) {
    const i = t - 1;
    const x = laneX(i, trackOffsetX);
    const tags = model.tracks[i] ?? {};
    const playLevel = num(tags, "D", 100);
    const fxOn = num(tags, "H", 1) === 1;
    const routed = trackRoutedAnywhere(model.routing, i);
    const inactive = playLevel <= 0 || !routed;
    const laneId = `trk-${t}`;
    const trackKey = `track:${t}`;

    bands.push({
      lane: laneId,
      label: `T${t}`,
      x: x - 8,
      y: PAD_Y - 8,
      w: NODE + 16,
      h: bandH,
      inactive,
    });

    nodes.push({
      key: trackKey,
      selectId: `track:${t}`,
      kind: "track",
      label: `Track ${t}`,
      sublabel: String(playLevel),
      shape: "bookend",
      tone: "inst",
      x,
      y: stageY(0),
      lane: laneId,
      inactive,
      toggle: { kind: "track", track: t, tag: "H" },
      toggleOn: fxOn,
    });

    let prevKey = trackKey;
    if (fxOn) {
      tfxSlots.forEach((slot, si) => {
        const slotInactive = inactive || !slot.bankOn || !slot.on;
        const key = `tfx:${t}:${slot.bank}:${slot.slot}`;
        nodes.push({
          key,
          selectId: `tfx:${slot.bank}:${slot.slot}`,
          kind: "tfx",
          label: `TFX ${slot.letter}`,
          sublabel: truncate(slot.typeLabel, 9),
          shape: "square",
          tone: "delay",
          x,
          y: stageY(1 + si),
          lane: laneId,
          inactive: slotInactive,
          toggle: { kind: "tfx", section: slot.section, tag: "A" },
          toggleOn: slot.on && slot.bankOn,
        });
        edges.push({
          id: `${prevKey}->${key}`,
          from: prevKey,
          to: key,
          kind: "serial",
          lane: laneId,
          inactive: slotInactive,
        });
        prevKey = key;
      });
    }

    edges.push({
      id: `${prevKey}->MIX`,
      from: prevKey,
      to: "MIX",
      kind: "mix-join",
      lane: laneId,
      inactive,
    });
  }

  // Rhythm
  {
    const x = laneX(6, trackOffsetX);
    const rhythmLevel = num(model.mixer, "T", 100);
    const inactive = rhythmLevel <= 0 || !rhythmRoutedAnywhere(model.routing);
    const laneId = "rhythm";
    bands.push({
      lane: laneId,
      label: "RHY",
      x: x - 8,
      y: PAD_Y - 8,
      w: NODE + 16,
      h: bandH,
      inactive,
    });
    nodes.push({
      key: "rhythm",
      selectId: "rhythm",
      kind: "rhythm",
      label: "Rhythm",
      sublabel: String(rhythmLevel),
      shape: "bookend",
      tone: "reverb",
      x,
      y: stageY(0),
      lane: laneId,
      inactive,
    });
    edges.push({
      id: "rhythm->MIX",
      from: "rhythm",
      to: "MIX",
      kind: "mix-join",
      lane: laneId,
      inactive,
    });
  }

  const firstLaneX = laneX(0);
  const lastLaneX = laneX(6, trackOffsetX);
  const mixX = (firstLaneX + lastLaneX) / 2;
  const mixY = stageY(mixStage);
  const loopLevel = num(model.mixer, "S", 100);
  nodes.push({
    key: "MIX",
    selectId: "mix",
    kind: "mix",
    label: "MIX",
    sublabel: String(loopLevel),
    shape: "circle",
    tone: "routing",
    x: mixX,
    y: mixY,
  });

  const mixBus = {
    left: firstLaneX + NODE / 2,
    top: mixY + NODE / 2 - 1,
    width: Math.max(2, lastLaneX - firstLaneX),
    height: 2,
  };

  // Destinations (spread horizontally under MIX)
  const destNodes: { dest: OutputRouteDest; key: string }[] = [];
  const destCount = Math.max(1, dests.length);
  const destSpan = (destCount - 1) * LANE_DX;
  const destStartX = mixX + NODE / 2 - destSpan / 2 - NODE / 2;

  dests.forEach((dest, i) => {
    const x = destCount === 1 ? mixX : destStartX + i * LANE_DX;
    const key = `dest:${dest.id}`;
    const label = outputRouteDestLabel(dest, model.output);
    const inactive = !destHasAnySource(model.routing, dest);
    nodes.push({
      key,
      selectId: `dest:${dest.id}`,
      kind: "dest",
      label,
      shape: "square",
      tone: dest.phones ? "master" : "neutral",
      x,
      y: stageY(destStage),
      inactive,
    });
    edges.push({
      id: `MIX->${key}`,
      from: "MIX",
      to: key,
      kind: "fork",
      lane: "serial",
      inactive,
    });
    destNodes.push({ dest, key });
  });

  // Master FX under the insert destination
  const mfxOn = mfxDestId != null;
  const mfxAttach = destNodes.find((d) => d.dest.id === mfxDestId);
  const mfxNode = mfxAttach ? nodes.find((n) => n.key === mfxAttach.key) : null;
  nodes.push({
    key: "mfx",
    selectId: "mfx",
    kind: "mfx",
    label: "Master FX",
    sublabel: mfxOn ? "On" : "Off",
    shape: "square",
    tone: "reverb",
    x: mfxNode?.x ?? mixX,
    y: stageY(mfxStage),
    inactive: !mfxOn,
  });
  if (mfxOn && mfxAttach) {
    edges.push({
      id: `${mfxAttach.key}->mfx`,
      from: mfxAttach.key,
      to: "mfx",
      kind: "serial",
      lane: "serial",
    });
  }

  const maxX = Math.max(...nodes.map((n) => n.x + NODE), lastLaneX + NODE);
  const maxY = Math.max(...nodes.map((n) => n.y + NODE), stageY(mfxStage) + NODE);

  return {
    nodes,
    edges,
    bands,
    width: maxX + PAD_X,
    height: maxY + PAD_Y,
    mixX,
    mixY,
    mixBus,
  };
}
