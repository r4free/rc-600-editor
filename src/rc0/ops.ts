import type { MemoryModel, TagMap } from "./memory.js";
import { encodeNameChars } from "./memory.js";
import type { MemoryCopySelection } from "./memoryCopy.js";

/** Declarative edits accumulated on the client; applied to RC0 only on the server. */
export type PatchOp =
  | { type: "track"; track: number; tags: TagMap }
  | { type: "section"; section: string; tags: TagMap; scope?: "mem" | "sys" }
  | { type: "assign"; assign: number; tags: TagMap }
  | { type: "name"; name: string }
  | { type: "ifx"; section: string; tags: TagMap }
  | { type: "tfx"; section: string; tags: TagMap };

export type AssembleRequest =
  | { kind: "patch"; xml: string; ops: PatchOp[] }
  | {
      kind: "copy";
      sourceXml: string;
      targetXml: string;
      /** @deprecated Prefer `selection`. Kept for older clients. */
      mode?: "all" | "assigns" | "inputFx";
      selection?: MemoryCopySelection;
    };

export type AssembleResponse = { xml: string };

function mergeTags(base: TagMap, partial: TagMap): TagMap {
  return { ...base, ...partial };
}

function cloneModel(model: MemoryModel): MemoryModel {
  return {
    ...model,
    tracks: model.tracks.map((t) => ({ ...t })),
    master: { ...model.master },
    rec: { ...model.rec },
    play: { ...model.play },
    rhythm: { ...model.rhythm },
    assigns: model.assigns.map((a) => ({ ...a })),
    ctlPedals: model.ctlPedals.map((row) => row.map((p) => ({ ...p }))),
    ectlCtl: model.ectlCtl.map((t) => ({ ...t })),
    ectlExp: model.ectlExp.map((t) => ({ ...t })),
    input: { ...model.input },
    eq: Object.fromEntries(Object.entries(model.eq).map(([k, v]) => [k, { ...v }])) as MemoryModel["eq"],
    output: { ...model.output },
    routing: { ...model.routing },
    outputEq: Object.fromEntries(
      Object.entries(model.outputEq).map(([k, v]) => [k, { ...v }]),
    ) as MemoryModel["outputEq"],
    masterFx: { ...model.masterFx },
    mixer: { ...model.mixer },
    ifxSetup: { ...model.ifxSetup },
    ifxBanks: model.ifxBanks.map((b) => ({ ...b })),
    ifxSlots: model.ifxSlots.map((row) => row.map((s) => ({ ...s }))),
    tfxSetup: { ...model.tfxSetup },
    tfxBanks: model.tfxBanks.map((b) => ({ ...b })),
    tfxSlots: model.tfxSlots.map((row) => row.map((s) => ({ ...s }))),
  };
}

function applySectionToModel(model: MemoryModel, section: string, tags: TagMap): void {
  const m = /^TRACK(\d+)$/.exec(section);
  if (m) {
    const i = Number(m[1]) - 1;
    if (model.tracks[i]) model.tracks[i] = mergeTags(model.tracks[i], tags);
    return;
  }
  const a = /^ASSIGN(\d+)$/.exec(section);
  if (a) {
    const i = Number(a[1]) - 1;
    if (model.assigns[i]) model.assigns[i] = mergeTags(model.assigns[i], tags);
    return;
  }
  const ped = /^ICTL(\d+)_PEDAL(\d+)$/.exec(section);
  if (ped) {
    const mode = Number(ped[1]) - 1;
    const pedal = Number(ped[2]) - 1;
    if (model.ctlPedals[mode]?.[pedal]) {
      model.ctlPedals[mode][pedal] = mergeTags(model.ctlPedals[mode][pedal], tags);
    }
    return;
  }
  const ctl = /^ECTL_CTL(\d+)$/.exec(section);
  if (ctl) {
    const i = Number(ctl[1]) - 1;
    if (model.ectlCtl[i]) model.ectlCtl[i] = mergeTags(model.ectlCtl[i], tags);
    return;
  }
  const exp = /^ECTL_EXP(\d+)$/.exec(section);
  if (exp) {
    const i = Number(exp[1]) - 1;
    if (model.ectlExp[i]) model.ectlExp[i] = mergeTags(model.ectlExp[i], tags);
    return;
  }
  if (section in model.eq) {
    model.eq[section as keyof MemoryModel["eq"]] = mergeTags(
      model.eq[section as keyof MemoryModel["eq"]],
      tags,
    );
    return;
  }
  if (section in model.outputEq) {
    model.outputEq[section as keyof MemoryModel["outputEq"]] = mergeTags(
      model.outputEq[section as keyof MemoryModel["outputEq"]],
      tags,
    );
    return;
  }
  switch (section) {
    case "MASTER":
      model.master = mergeTags(model.master, tags);
      break;
    case "REC":
      model.rec = mergeTags(model.rec, tags);
      break;
    case "PLAY":
      model.play = mergeTags(model.play, tags);
      break;
    case "RHYTHM":
      model.rhythm = mergeTags(model.rhythm, tags);
      break;
    case "INPUT":
      model.input = mergeTags(model.input, tags);
      break;
    case "OUTPUT":
      model.output = mergeTags(model.output, tags);
      break;
    case "ROUTING":
      model.routing = mergeTags(model.routing, tags);
      break;
    case "MASTER_FX":
      model.masterFx = mergeTags(model.masterFx, tags);
      break;
    case "MIXER":
      model.mixer = mergeTags(model.mixer, tags);
      break;
    case "NAME": {
      const encoded = { ...encodeNameChars(model.name), ...tags };
      const out: string[] = [];
      for (const tag of "ABCDEFGHIJKL") {
        const code = parseInt(encoded[tag] ?? "32", 10);
        if (code >= 32 && code <= 126) out.push(String.fromCharCode(code));
      }
      model.name = out.join("").trimEnd();
      break;
    }
    default:
      break;
  }
}

function applyFxToModel(
  model: MemoryModel,
  kind: "ifx" | "tfx",
  section: string,
  tags: TagMap,
): void {
  const setup = kind === "ifx" ? "ifxSetup" : "tfxSetup";
  const banks = kind === "ifx" ? "ifxBanks" : "tfxBanks";
  const slots = kind === "ifx" ? "ifxSlots" : "tfxSlots";
  if (section === "SETUP") {
    model[setup] = mergeTags(model[setup], tags);
    return;
  }
  if (section.length === 1) {
    const i = "ABCD".indexOf(section);
    if (i >= 0) model[banks][i] = mergeTags(model[banks][i] ?? {}, tags);
    return;
  }
  if (section.length === 2) {
    const bi = "ABCD".indexOf(section[0]!);
    const si = "ABCD".indexOf(section[1]!);
    if (bi >= 0 && si >= 0) {
      model[slots][bi]![si] = mergeTags(model[slots][bi]![si] ?? {}, tags);
    }
  }
}

/** Update the in-memory editor model without writing RC0 XML (client-safe). */
export function applyOpsToModel(model: MemoryModel, ops: PatchOp[]): MemoryModel {
  const next = cloneModel(model);
  for (const op of ops) {
    switch (op.type) {
      case "track":
        if (next.tracks[op.track - 1]) {
          next.tracks[op.track - 1] = mergeTags(next.tracks[op.track - 1], op.tags);
        }
        break;
      case "section":
        applySectionToModel(next, op.section, op.tags);
        break;
      case "assign":
        if (next.assigns[op.assign - 1]) {
          next.assigns[op.assign - 1] = mergeTags(next.assigns[op.assign - 1], op.tags);
        }
        break;
      case "name":
        next.name = op.name.slice(0, 12);
        break;
      case "ifx":
        applyFxToModel(next, "ifx", op.section, op.tags);
        break;
      case "tfx":
        applyFxToModel(next, "tfx", op.section, op.tags);
        break;
    }
  }
  return next;
}

export function normalizeOps(ops: PatchOp | PatchOp[]): PatchOp[] {
  return Array.isArray(ops) ? ops : [ops];
}
