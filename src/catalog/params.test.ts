import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IFX_BANK_PARAMS,
  IFX_SELECTED_BANK,
  IFX_SLOT_PARAMS,
  INPUT_DYNAMICS_PARAMS,
  INPUT_EQ_CHANNELS,
  INPUT_EQ_PARAMS,
  INPUT_FX_TYPE_OPTIONS,
  TRACK_FX_TYPE_OPTIONS,
  TFX_SLOT_PARAMS,
  INPUT_SETUP_PARAMS,
  MASTER_FX_PARAMS,
  MIDI_PARAMS,
  MIXER_INPUT_GROUPS,
  MIXER_OUTPUT_GROUPS,
  MIXER_PARAMS,
  OUTPUT_EQ_CHANNELS,
  OUTPUT_EQ_PARAMS,
  OUTPUT_PHONES_OUT,
  OUTPUT_ROUTE_DESTS,
  OUTPUT_SETUP_PARAMS,
  PLAY_PARAMS,
  RHYTHM_PARAMS,
  SETUP_MAPPED_TAGS,
  SETUP_PARAMS,
  COLOR_PARAMS,
  TRACK_PARAMS,
  assignSourceLabel,
  bitOn,
  ctlFunctionLabel,
  displayParam,
  expFunctionLabel,
  fxSlotSection,
  inputEqChannelLabel,
  inputEqLinkPartner,
  inputFxInsertDef,
  knobFunctionLabel,
  measureLabel,
  outputEqChannelLabel,
  outputEqLinkPartner,
  phonesOutIndividual,
  setBit,
  visibleInputEqChannels,
  visibleMixerGroups,
  visibleOutputEqChannels,
  visibleOutputRouteDests,
  visibleOutputRouteInputGroups,
} from "./params.js";
import { parseMemory, parseSystem } from "../rc0/memory.js";
import { patchSysSection } from "../rc0/writer.js";
import {
  ASSIGN_TARGETS,
  assignTargetLabel,
  assignTargetRange,
  formatAssignValue,
  groupAssignTargets,
  matchAssignTarget,
} from "./assign-targets.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const xml = readFileSync(join(root, "fixtures", "DATA", "MEMORY001A.RC0"), "utf8");

describe("track catalog", () => {
  it("maps TRACK1 fixture tags to Parameter Guide fields", () => {
    const track = parseMemory(xml, 1).tracks[0];
    assert.equal(track.D, "60");
    assert.equal(measureLabel(Number(track.R)), "2");
    assert.equal(track.S, "2");
    assert.equal(track.P, "0");
    assert.equal(Number(track.Q), 127);
    for (let bit = 0; bit < 7; bit++) assert.equal(bitOn(127, bit), true);
  });

  it("toggles a single INPUT bit without clearing the others", () => {
    assert.equal(setBit(127, 0, false), 126);
    assert.equal(bitOn(126, 0), false);
    assert.equal(bitOn(126, 6), true);
  });

  it("labels pan CENTER at 50", () => {
    const pan = TRACK_PARAMS.find((p) => p.tag === "C")!;
    assert.equal(displayParam(pan, 50), "CENTER");
    assert.equal(displayParam(pan, 40), "L10");
  });

  it("maps REC bounce tracks from tag F", () => {
    const rec = parseMemory(xml, 1).rec;
    assert.equal(Number(rec.F), 62);
    assert.equal(bitOn(62, 0), false);
    for (let bit = 1; bit < 6; bit++) assert.equal(bitOn(62, bit), true);
  });

  it("maps PLAY fixture tags to Parameter Guide fields", () => {
    const play = parseMemory(xml, 1).play;
    assert.equal(play.A, "0");
    assert.equal(play.B, "5");
    assert.equal(play.C, "5");
    assert.equal(Number(play.D), 63);
    assert.equal(Number(play.E), 63);
    assert.equal(play.F, "0");
    assert.equal(play.G, "0");
    assert.equal(play.H, "1");
    for (let bit = 0; bit < 6; bit++) {
      assert.equal(bitOn(63, bit), true);
    }
    const fadeIn = PLAY_PARAMS.find((p) => p.tag === "B")!;
    assert.equal(displayParam(fadeIn, 5), "2 meas");
    const loopLen = PLAY_PARAMS.find((p) => p.tag === "F")!;
    assert.equal(displayParam(loopLen, 0), "AUTO");
    const sync = PLAY_PARAMS.find((p) => p.tag === "H")!;
    assert.equal(displayParam(sync, 1), "Measure");
  });

  it("maps RHYTHM fixture tags to Parameter Guide fields", () => {
    const rhythm = parseMemory(xml, 1).rhythm;
    const genre = RHYTHM_PARAMS.find((p) => p.tag === "A")!;
    const beat = RHYTHM_PARAMS.find((p) => p.tag === "E")!;
    const kit = RHYTHM_PARAMS.find((p) => p.tag === "D")!;
    const variation = RHYTHM_PARAMS.find((p) => p.tag === "C")!;
    const start = RHYTHM_PARAMS.find((p) => p.tag === "F")!;
    assert.equal(displayParam(genre, Number(rhythm.A)), "Rock");
    assert.equal(rhythm.B, "0");
    assert.equal(displayParam(variation, Number(rhythm.C)), "A");
    assert.equal(displayParam(kit, Number(rhythm.D)), "Studio");
    assert.equal(displayParam(beat, Number(rhythm.E)), "4/4");
    assert.equal(displayParam(start, Number(rhythm.F)), "Before Loop");
    const xml2 = readFileSync(join(root, "fixtures", "DATA", "MEMORY002A.RC0"), "utf8");
    assert.equal(displayParam(genre, Number(parseMemory(xml2, 2).rhythm.A)), "Electro");
  });
});

describe("ctl func catalog", () => {
  it("maps Mode 1 pedal functions from MEMORY001A to Parameter Guide names", () => {
    const mem = parseMemory(xml, 1);
    const mode1 = mem.ctlPedals[0];
    assert.equal(ctlFunctionLabel(Number(mode1[0].A)), "TRK1 REC/PLAY4");
    assert.equal(ctlFunctionLabel(Number(mode1[1].A)), "TRK2 REC/PLAY4");
    assert.equal(ctlFunctionLabel(Number(mode1[2].A)), "TRK3 REC/PLAY4");
    assert.equal(ctlFunctionLabel(Number(mode1[3].A)), "TRK4 REC/PLAY4");
    assert.equal(ctlFunctionLabel(Number(mode1[4].A)), "MEMORY DEC1");
    assert.equal(ctlFunctionLabel(Number(mode1[5].A)), "MEMORY INC1");
    assert.equal(ctlFunctionLabel(Number(mode1[6].A)), "PEDAL MODE INC");
    assert.equal(ctlFunctionLabel(Number(mode1[7].A)), "RHYTHM START/STOP");
    assert.equal(ctlFunctionLabel(Number(mode1[8].A)), "ALL START/STOP2");
  });

  it("maps EXP defaults IN FX CUR / TR FX CUR", () => {
    const mem = parseMemory(xml, 1);
    assert.equal(expFunctionLabel(Number(mem.ectlExp[0].A)), "IN FX CUR CTL");
    assert.equal(expFunctionLabel(Number(mem.ectlExp[1].A)), "TR FX CUR CTL");
    assert.equal(mem.ectlExp[0].C, "0");
    assert.equal(mem.ectlExp[0].D, "100");
  });

  it("keeps 26 functions per track so TRK2 REC/PLAY4 is 30", () => {
    assert.equal(ctlFunctionLabel(4), "TRK1 REC/PLAY4");
    assert.equal(ctlFunctionLabel(30), "TRK2 REC/PLAY4");
    assert.equal(ctlFunctionLabel(56), "TRK3 REC/PLAY4");
    assert.equal(ctlFunctionLabel(186), "ALL START/STOP1");
  });
});

describe("input catalog", () => {
  it("maps INPUT fixture tags to Parameter Guide fields", () => {
    const mem = parseMemory(xml, 1);
    assert.equal(mem.input.A, "1");
    assert.equal(mem.input.B, "0");
    assert.equal(mem.input.C, "0");
    assert.equal(mem.input.E, "0");
    const phantom = INPUT_SETUP_PARAMS.find((p) => p.tag === "A")!;
    const gain = INPUT_SETUP_PARAMS.find((p) => p.tag === "C")!;
    assert.equal(displayParam(phantom, 1), "ON");
    assert.equal(displayParam(gain, 0), "INST");
    const loGain = INPUT_EQ_PARAMS.find((p) => p.tag === "B")!;
    const lmFreq = INPUT_EQ_PARAMS.find((p) => p.tag === "D")!;
    const hmFreq = INPUT_EQ_PARAMS.find((p) => p.tag === "G")!;
    const loCut = INPUT_EQ_PARAMS.find((p) => p.tag === "K")!;
    const hiCut = INPUT_EQ_PARAMS.find((p) => p.tag === "L")!;
    const eq = mem.eq.EQ_INST1R;
    assert.equal(displayParam(loGain, Number(eq.B)), "0 dB");
    assert.equal(displayParam(lmFreq, Number(eq.D)), "250 Hz");
    assert.equal(displayParam(hmFreq, Number(eq.G)), "800 Hz");
    assert.equal(displayParam(loCut, Number(eq.K)), "FLAT");
    assert.equal(displayParam(hiCut, Number(eq.L)), "FLAT");
    const mic1 = mem.eq.EQ_MIC1;
    assert.equal(displayParam(loGain, Number(mic1.B)), "-1 dB");
    const comp = INPUT_DYNAMICS_PARAMS.find((p) => p.tag === "H")!;
    assert.equal(displayParam(comp, 0), "OFF");
    assert.equal(displayParam(comp, 40), "40");
  });

  it("hides the linked EQ channel when stereo link is on", () => {
    const visible = visibleInputEqChannels({ E: "1", F: "0", G: "0" }).map((c) => c.section);
    assert.deepEqual(visible, ["EQ_MIC1", "EQ_INST1L", "EQ_INST1R", "EQ_INST2L", "EQ_INST2R"]);
    assert.equal(inputEqLinkPartner("EQ_MIC1"), "EQ_MIC2");
    assert.equal(inputEqChannelLabel(INPUT_EQ_CHANNELS[0], { E: "1" }), "MIC");
  });
});

describe("output catalog", () => {
  it("maps OUTPUT fixture tags to Parameter Guide fields", () => {
    const mem = parseMemory(xml, 1);
    const knob = OUTPUT_SETUP_PARAMS.find((p) => p.tag === "A")!;
    const mainLink = OUTPUT_SETUP_PARAMS.find((p) => p.tag === "B")!;
    assert.equal(displayParam(knob, Number(mem.output.A)), "ALL");
    assert.equal(displayParam(mainLink, Number(mem.output.B)), "ON");
    const loGain = OUTPUT_EQ_PARAMS.find((p) => p.tag === "B")!;
    assert.equal(displayParam(loGain, Number(mem.outputEq.EQ_MAINOUTL.B)), "0 dB");
    const comp = MASTER_FX_PARAMS.find((p) => p.tag === "A")!;
    const insert = MASTER_FX_PARAMS.find((p) => p.tag === "C")!;
    assert.equal(displayParam(comp, Number(mem.masterFx.A)), "OFF");
    assert.equal(displayParam(insert, Number(mem.masterFx.C)), "MAIN L");
    assert.equal(displayParam(OUTPUT_PHONES_OUT, Number(mem.routing.O)), "MAIN L");
  });

  it("packs ROUTING A–G as track bits per destination", () => {
    const mem = parseMemory(xml, 1);
    assert.equal(Number(mem.routing.A), 63);
    for (let bit = 0; bit < 6; bit++) assert.equal(bitOn(63, bit), true);
    assert.equal(OUTPUT_ROUTE_DESTS[0].tagTrack, "A");
    assert.equal(OUTPUT_ROUTE_DESTS[6].tagTrack, "G");
  });

  it("hides the linked EQ channel and PHONES dest unless INDIVIDUAL", () => {
    const visible = visibleOutputEqChannels({ B: "1", C: "0", D: "0" }).map((c) => c.section);
    assert.deepEqual(visible, ["EQ_MAINOUTL", "EQ_SUBOUT1L", "EQ_SUBOUT1R", "EQ_SUBOUT2L", "EQ_SUBOUT2R"]);
    assert.equal(outputEqLinkPartner("EQ_MAINOUTL"), "EQ_MAINOUTR");
    assert.equal(outputEqChannelLabel(OUTPUT_EQ_CHANNELS[0], { B: "1" }), "MAIN");
    assert.equal(phonesOutIndividual({ O: "0" }), false);
    const dests = visibleOutputRouteDests({ B: "1", C: "1", D: "1" }, { O: "0" }).map((d) => d.id);
    assert.deepEqual(dests, ["main-l", "sub1-l", "sub2-l"]);
    const individual = visibleOutputRouteDests({ B: "0", C: "0", D: "0" }, { O: "6" }).map((d) => d.id);
    assert.deepEqual(individual, ["main-l", "main-r", "sub1-l", "sub1-r", "sub2-l", "sub2-r", "phones"]);
  });

  it("collapses Input/Rhythm MIC rows when input stereo link is on", () => {
    const names = visibleOutputRouteInputGroups({ E: "1", F: "0", G: "0" }).map((g) => g.name);
    assert.deepEqual(names, ["MIC", "INST 1 L", "INST 1 R", "INST 2 L", "INST 2 R", "Rhythm"]);
  });
});

describe("mixer catalog", () => {
  it("maps MIXER fixture tags to Parameter Guide fields", () => {
    const mem = parseMemory(xml, 1);
    const mic1Level = MIXER_PARAMS.find((p) => p.tag === "A")!;
    const mic1Mute = MIXER_PARAMS.find((p) => p.tag === "B")!;
    const master = MIXER_PARAMS.find((p) => p.tag === "V")!;
    assert.equal(mem.mixer.A, "100");
    assert.equal(mem.mixer.B, "0");
    assert.equal(mem.mixer.V, "100");
    assert.equal(displayParam(mic1Level, Number(mem.mixer.A)), "100");
    assert.equal(displayParam(mic1Mute, Number(mem.mixer.B)), "OFF");
    assert.equal(displayParam(master, Number(mem.mixer.V)), "100");
    assert.equal(mic1Level.max, 200);
  });

  it("hides the linked mixer channel when stereo link is on", () => {
    const inputLinked = visibleMixerGroups(MIXER_INPUT_GROUPS, { E: "1", F: "0", G: "0" }, {}).map(
      (g) => g.title,
    );
    assert.deepEqual(inputLinked, ["MIC 1", "INST 1 L", "INST 1 R", "INST 2 L", "INST 2 R"]);
    const outputLinked = visibleMixerGroups(MIXER_OUTPUT_GROUPS, {}, { B: "1", C: "0", D: "0" }).map(
      (g) => g.title,
    );
    assert.ok(outputLinked.includes("MAIN L"));
    assert.ok(!outputLinked.includes("MAIN R"));
    assert.ok(outputLinked.includes("MAIN L") && outputLinked.includes("SUB 1 L") && outputLinked.includes("SUB 1 R"));
    assert.ok(outputLinked.includes("Loop"));
    assert.ok(outputLinked.includes("Master"));
  });
});

describe("input FX catalog", () => {
  it("maps MEMORY001A IFX bank and slot tags to Parameter Guide fields", () => {
    const mem = parseMemory(xml, 1);
    const selected = IFX_SELECTED_BANK;
    const mode = IFX_BANK_PARAMS.find((p) => p.tag === "B")!;
    const target = IFX_BANK_PARAMS.find((p) => p.tag === "C")!;
    const type = IFX_SLOT_PARAMS.find((p) => p.tag === "C")!;
    const insert = IFX_SLOT_PARAMS.find((p) => p.tag === "D")!;
    assert.equal(displayParam(selected, Number(mem.ifxSetup.A)), "A");
    assert.equal(mem.ifxBanks[0].A, "1");
    assert.equal(displayParam(mode, Number(mem.ifxBanks[0].B)), "SINGLE");
    assert.equal(displayParam(target, Number(mem.ifxBanks[0].C)), "B");
    assert.equal(displayParam(mode, Number(mem.ifxBanks[1].B)), "MULTI");
    assert.equal(displayParam(type, Number(mem.ifxSlots[0][0].C)), "Preamp");
    assert.equal(displayParam(insert, Number(mem.ifxSlots[0][0].D)), "INST 2 R");
    assert.equal(INPUT_FX_TYPE_OPTIONS.length, 52);
    assert.equal(fxSlotSection(0, 0), "AA");
    assert.equal(fxSlotSection(1, 0), "BA");
  });

  it("collapses Insert L/R when input stereo link is on", () => {
    const linked = inputFxInsertDef({ E: "0", F: "0", G: "1" }, 5).options!.map((o) => o.label);
    assert.ok(linked.includes("INST 2"));
    assert.ok(!linked.includes("INST 2 R"));
    const keepSecondary = inputFxInsertDef({ G: "1" }, 6).options!.map((o) => o.value);
    assert.ok(keepSecondary.includes(6));
  });
});

describe("track FX catalog", () => {
  it("maps MEMORY001A TFX slot type and insert to Parameter Guide fields", () => {
    const mem = parseMemory(xml, 1);
    const type = TFX_SLOT_PARAMS.find((p) => p.tag === "C")!;
    const insert = TFX_SLOT_PARAMS.find((p) => p.tag === "D")!;
    assert.equal(TRACK_FX_TYPE_OPTIONS.length, 56);
    assert.equal(displayParam(type, Number(mem.tfxSlots[0][0].C)), "Beat Scatter");
    assert.equal(displayParam(insert, Number(mem.tfxSlots[0][0].D)), "ALL");
    assert.equal(displayParam(type, 55), "Vinyl Flick");
  });
});

describe("assign source catalog", () => {
  it("maps MEMORY001A SOURCE values to Parameter Guide names", () => {
    const mem = parseMemory(xml, 1);
    assert.equal(assignSourceLabel(Number(mem.assigns[0].B)), "MIDI CC#04");
    assert.equal(assignSourceLabel(Number(mem.assigns[1].B)), "MIDI CC#05");
    assert.equal(assignSourceLabel(Number(mem.assigns[2].B)), "MIDI CC#06");
    assert.equal(assignSourceLabel(Number(mem.assigns[3].B)), "MIDI CC#03");
    assert.equal(assignSourceLabel(Number(mem.assigns[4].B)), "MIDI CC#70");
    assert.equal(assignSourceLabel(Number(mem.assigns[5].B)), "TRK1 REC/DB");
    assert.equal(assignSourceLabel(Number(mem.assigns[14].B)), "PEDAL5 MODE2");
  });

  it("keeps MIDI CC#01 at 46 so CC#04 is 49", () => {
    assert.equal(assignSourceLabel(0), "TRK1 REC/DB");
    assert.equal(assignSourceLabel(5), "TRK6 REC/DB");
    assert.equal(assignSourceLabel(6), "TRK1 PLY/STP");
    assert.equal(assignSourceLabel(12), "SYNC ST/STP");
    assert.equal(assignSourceLabel(13), "PEDAL1 MODE1");
    assert.equal(assignSourceLabel(26), "PEDAL5 MODE2");
    assert.equal(assignSourceLabel(44), "EXP1");
    assert.equal(assignSourceLabel(45), "EXP2");
    assert.equal(assignSourceLabel(46), "MIDI CC#01");
    assert.equal(assignSourceLabel(49), "MIDI CC#04");
    assert.equal(assignSourceLabel(76), "MIDI CC#31");
    assert.equal(assignSourceLabel(77), "MIDI CC#64");
    assert.equal(assignSourceLabel(83), "MIDI CC#70");
    assert.equal(assignSourceLabel(108), "MIDI CC#95");
  });
});

describe("assign target catalog", () => {
  it("maps MEMORY001A TARGET values to Parameter Guide functions", () => {
    const mem = parseMemory(xml, 1);
    assert.equal(assignTargetLabel(Number(mem.assigns[0].G)), "Rhythm Variation");
    assert.equal(assignTargetLabel(Number(mem.assigns[4].G)), "Tap Tempo");
    assert.equal(assignTargetLabel(Number(mem.assigns[14].G)), "Input FX C Control");
    assert.equal(assignTargetLabel(Number(mem.assigns[15].G)), "Input FX Bank Inc");
  });

  it("keeps Rhythm Variation at 771 so track Rec/Play is 0", () => {
    assert.equal(assignTargetLabel(0), "Track 1 Rec/Play");
    assert.equal(assignTargetLabel(4), "Track 1 Reverse");
    assert.equal(assignTargetLabel(10), "Track 1 Play Level");
    assert.equal(assignTargetLabel(81), "Tap Tempo");
    assert.equal(assignTargetLabel(86), "Input FX Bank Inc");
    assert.equal(assignTargetLabel(95), "Input FX C Control");
    assert.equal(assignTargetLabel(771), "Rhythm Variation");
  });

  it("categorizes and searches every target", () => {
    assert.ok(ASSIGN_TARGETS.length > 900);
    assert.ok(ASSIGN_TARGETS.every((target) => target.category.length > 0));

    const rhythmMatches = ASSIGN_TARGETS.filter((target) =>
      matchAssignTarget(target, "rhythm kit"),
    );
    assert.deepEqual(rhythmMatches.map((target) => target.label), ["Rhythm Kit"]);

    const ccMatches = ASSIGN_TARGETS.filter((target) => matchAssignTarget(target, "cc#64"));
    assert.deepEqual(ccMatches.map((target) => target.label), ["MIDI CC#64"]);
  });

  it("groups filtered targets in category order and skips empty categories", () => {
    const targets = ASSIGN_TARGETS.filter(
      (target) => target.label === "Track 1 Reverse" || target.label === "Rhythm Kit",
    );
    assert.deepEqual(
      groupAssignTargets(targets).map((group) => [
        group.category,
        group.targets.map((target) => target.label),
      ]),
      [
        ["Track 1", ["Track 1 Reverse"]],
        ["Rhythm", ["Rhythm Kit"]],
      ],
    );
  });

  it("names Target Min/Max from the selected parameter", () => {
    const vari = assignTargetRange(771);
    assert.equal(vari.kind, "enum");
    if (vari.kind === "enum") {
      assert.equal(formatAssignValue(vari, 0), "A");
      assert.equal(formatAssignValue(vari, 3), "D");
    }
    const reverse = assignTargetRange(4);
    assert.equal(formatAssignValue(reverse, 0), "OFF");
    assert.equal(formatAssignValue(reverse, 1), "ON");
    const level = assignTargetRange(10);
    assert.equal(level.kind, "int");
    if (level.kind === "int") {
      assert.equal(level.min, 0);
      assert.equal(level.max, 200);
    }
  });
});

describe("system MIDI catalog", () => {
  it("exposes PC Out as a switch on tag I", () => {
    const pcOut = MIDI_PARAMS.find((p) => p.tag === "I");
    assert.equal(pcOut?.name, "PC Out");
    assert.equal(pcOut?.kind, "bool");
    assert.equal(pcOut?.default, 0);
  });
});

describe("system SETUP / COLOR catalog", () => {
  const sysXml = readFileSync(join(root, "fixtures", "DATA", "SYSTEM1.RC0"), "utf8");

  it("maps Memory Ext / Contrast / knobs from fixture tags (not guide menu order)", () => {
    assert.equal(SETUP_PARAMS.find((p) => p.tag === "A")?.name, "Min");
    assert.equal(SETUP_PARAMS.find((p) => p.tag === "I")?.name, "Contrast");
    assert.equal(SETUP_PARAMS.find((p) => p.tag === "H")?.name, "Auto Off");
    assert.equal(knobFunctionLabel(1), "MEMORY");
    assert.equal(knobFunctionLabel(116), "RHYTHM LEVEL");
    assert.equal(knobFunctionLabel(118), "RHYTHM KIT");
    assert.equal(knobFunctionLabel(300), "MFX REVERB");
  });

  it("uses LOOP STATUS COLOR enums (Off…White)", () => {
    const rec = COLOR_PARAMS.find((p) => p.tag === "A")!;
    assert.equal(rec.kind, "enum");
    assert.equal(rec.options?.length, 8);
    assert.equal(displayParam(rec, 1), "Red");
    assert.equal(displayParam(COLOR_PARAMS.find((p) => p.tag === "E")!, 4), "Blue");
  });

  it("parses and patches SYSTEM1 SETUP / COLOR without dropping unmapped tags", () => {
    const sys = parseSystem(sysXml, "1");
    assert.equal(sys.sections.SETUP?.A, "11");
    assert.equal(sys.sections.SETUP?.I, "5");
    assert.equal(sys.sections.SETUP?.K, "116");
    assert.equal(sys.sections.SETUP?.F, "2");
    assert.equal(sys.sections.COLOR?.A, "4");
    assert.ok([...SETUP_MAPPED_TAGS].every((t) => sys.sections.SETUP?.[t] !== undefined));

    const next = patchSysSection(sysXml, "SETUP", { A: "12", I: "7" });
    const patched = parseSystem(next, "1");
    assert.equal(patched.sections.SETUP?.A, "12");
    assert.equal(patched.sections.SETUP?.I, "7");
    assert.equal(patched.sections.SETUP?.F, "2");
    assert.equal(patched.sections.SETUP?.Q, "271");

    const colored = patchSysSection(next, "COLOR", { B: "2" });
    assert.equal(parseSystem(colored, "1").sections.COLOR?.B, "2");
    assert.equal(parseSystem(colored, "1").sections.COLOR?.A, "4");
  });
});
