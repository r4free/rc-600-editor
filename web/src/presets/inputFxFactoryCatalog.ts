/**
 * Curated Input FX factory library — many named presets per category.
 * Tags are partial overrides merged onto Parameter Guide / RC0 type defaults.
 */
import {
  INPUT_FX_SEQ_TYPES,
  inputFxCategory,
  inputFxDefaultSeqTags,
  inputFxDefaultTags,
  type InputFxCategory,
} from "@rc600/catalog/input-fx";
import type { TagMap } from "@rc600/rc0/memory";
import type { InputFxPreset } from "./inputFxPreset";

type FactorySpec = {
  id: string;
  name: string;
  type: number;
  /** Optional category override (defaults from type). */
  category?: InputFxCategory;
  tags?: TagMap;
  seqTags?: TagMap;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function mergeTags(base: TagMap, overrides?: TagMap): TagMap {
  return { ...base, ...(overrides ?? {}) };
}

/** Factory specs: as many useful named sounds as practical per category. */
const FACTORY_SPECS: FactorySpec[] = [
  // —— Other ——
  { id: "thru", name: "THRU (bypass)", type: 0 },

  // —— Filter ——
  { id: "lpf-gentle", name: "LPF Gentle Sweep", type: 1, tags: { A: "8", B: "35", C: "30", D: "70" } },
  { id: "lpf-wah", name: "LPF Wah Sweep", type: 1, tags: { A: "18", B: "80", C: "70", D: "45" } },
  { id: "lpf-dark", name: "LPF Dark Pad", type: 1, tags: { A: "3", B: "20", C: "40", D: "25" } },
  { id: "lpf-reso", name: "LPF Resonant", type: 1, tags: { A: "12", B: "60", C: "90", D: "50" } },
  { id: "lpf-slow", name: "LPF Slow Pulse", type: 1, tags: { A: "0", B: "55", C: "55", D: "40" } },
  { id: "bpf-peak", name: "BPF Peak Talk", type: 2, tags: { A: "10", B: "70", C: "75", D: "55" } },
  { id: "bpf-narrow", name: "BPF Narrow Band", type: 2, tags: { A: "6", B: "40", C: "85", D: "50" } },
  { id: "bpf-radio", name: "BPF Radio Band", type: 2, tags: { A: "3", B: "50", C: "60", D: "35" } },
  { id: "bpf-auto", name: "BPF Auto Sweep", type: 2, tags: { A: "20", B: "85", C: "50", D: "50" } },
  { id: "hpf-air", name: "HPF Air Cut", type: 3, tags: { A: "3", B: "25", C: "30", D: "75" } },
  { id: "hpf-thin", name: "HPF Thin Edge", type: 3, tags: { A: "8", B: "45", C: "55", D: "85" } },
  { id: "hpf-sweep", name: "HPF Rising Sweep", type: 3, tags: { A: "16", B: "70", C: "65", D: "60" } },
  { id: "hpf-harsh", name: "HPF Harsh Gate", type: 3, tags: { A: "5", B: "40", C: "80", D: "90" } },
  { id: "lofi-vinyl", name: "Lo-Fi Vinyl", type: 7, tags: { A: "12", B: "4", D: "70" } },
  { id: "lofi-bitcrush", name: "Lo-Fi Bitcrush", type: 7, tags: { A: "8", B: "6", D: "85" } },
  { id: "lofi-tape", name: "Lo-Fi Tape Wear", type: 7, tags: { A: "18", B: "2", D: "55" } },
  { id: "lofi-phone", name: "Lo-Fi Phone Line", type: 7, tags: { A: "6", B: "8", D: "75" } },
  { id: "lofi-soft", name: "Lo-Fi Soft Dust", type: 7, tags: { A: "24", B: "1", D: "40" } },
  { id: "isolator-kick", name: "Isolator Kick Cut", type: 27, tags: { A: "0", B: "6", C: "20", D: "100" } },
  { id: "isolator-mid", name: "Isolator Mid Scoop", type: 27, tags: { A: "1", B: "8", C: "15", D: "90" } },
  { id: "isolator-hi", name: "Isolator Hi Cut", type: 27, tags: { A: "2", B: "6", C: "25", D: "100" } },
  { id: "isolator-pulse", name: "Isolator Tempo Pulse", type: 27, tags: { A: "0", B: "11", C: "40", D: "80" } },
  { id: "isolator-dj", name: "Isolator DJ Build", type: 27, tags: { A: "2", B: "0", C: "10", D: "100" } },

  // —— Modulation ——
  { id: "phaser-classic", name: "Phaser Classic", type: 4, tags: { A: "8", B: "55", C: "60", D: "50", E: "100", F: "70" } },
  { id: "phaser-deep", name: "Phaser Deep Sweep", type: 4, tags: { A: "3", B: "85", C: "80", D: "40", E: "80", F: "90" } },
  { id: "phaser-fast", name: "Phaser Fast Spin", type: 4, tags: { A: "22", B: "50", C: "50", D: "55", E: "100", F: "80" } },
  { id: "phaser-subtle", name: "Phaser Subtle", type: 4, tags: { A: "6", B: "30", C: "35", D: "50", E: "100", F: "40" } },
  { id: "phaser-barber", name: "Phaser Barber Pole", type: 4, tags: { A: "14", B: "70", C: "90", D: "30", E: "70", F: "100" } },
  { id: "flanger-jet", name: "Flanger Jet Takeoff", type: 5, tags: { A: "2", B: "70", C: "90", D: "40", E: "60", F: "80", G: "90" } },
  { id: "flanger-chorus", name: "Flanger Chorusy", type: 5, tags: { A: "10", B: "40", C: "35", D: "50", E: "20", F: "100", G: "50" } },
  { id: "flanger-metallic", name: "Flanger Metallic", type: 5, tags: { A: "16", B: "60", C: "95", D: "30", E: "80", F: "70", G: "85" } },
  { id: "flanger-slow", name: "Flanger Slow Whoosh", type: 5, tags: { A: "0", B: "80", C: "70", D: "45", E: "40", F: "100", G: "75" } },
  { id: "ring-bell", name: "Ring Mod Bell", type: 9, tags: { A: "70", B: "60", C: "1" } },
  { id: "ring-clang", name: "Ring Mod Clang", type: 9, tags: { A: "85", B: "80", C: "1" } },
  { id: "ring-subtle", name: "Ring Mod Subtle", type: 9, tags: { A: "40", B: "30", C: "1" } },
  { id: "ring-robot", name: "Ring Mod Robot Edge", type: 9, tags: { A: "55", B: "70", C: "1" } },
  { id: "autopan-wide", name: "Auto Pan Wide", type: 29, tags: { A: "64", B: "50", C: "80", D: "0" } },
  { id: "autopan-slow", name: "Auto Pan Slow Orbit", type: 29, tags: { A: "3", B: "40", C: "70", D: "0" } },
  { id: "autopan-trem", name: "Auto Pan Trem Feel", type: 29, tags: { A: "90", B: "70", C: "50", D: "45" } },
  { id: "autopan-hard", name: "Auto Pan Hard L/R", type: 29, tags: { A: "70", B: "90", C: "100", D: "0" } },
  { id: "manual-center", name: "Manual Pan Center", type: 30, tags: { A: "50" } },
  { id: "manual-left", name: "Manual Pan Left", type: 30, tags: { A: "15" } },
  { id: "manual-right", name: "Manual Pan Right", type: 30, tags: { A: "85" } },
  { id: "stereo-wide", name: "Stereo Enhance Wide", type: 31, tags: { A: "70", B: "29", C: "60" } },
  { id: "stereo-mild", name: "Stereo Enhance Mild", type: 31, tags: { A: "35", B: "29", C: "50" } },
  { id: "stereo-air", name: "Stereo Enhance Air", type: 31, tags: { A: "55", B: "20", C: "55" } },
  { id: "tremolo-classic", name: "Tremolo Classic", type: 32, tags: { A: "70", B: "70", C: "50", D: "50" } },
  { id: "tremolo-square", name: "Tremolo Square Chop", type: 32, tags: { A: "85", B: "90", C: "95", D: "55" } },
  { id: "tremolo-slow", name: "Tremolo Slow Pulse", type: 32, tags: { A: "8", B: "60", C: "40", D: "50" } },
  { id: "tremolo-surf", name: "Tremolo Surf", type: 32, tags: { A: "55", B: "55", C: "35", D: "60" } },
  { id: "vibrato-gentle", name: "Vibrato Gentle", type: 33, tags: { A: "40", B: "30", C: "40", D: "0", E: "100" } },
  { id: "vibrato-deep", name: "Vibrato Deep", type: 33, tags: { A: "55", B: "75", C: "60", D: "0", E: "100" } },
  { id: "vibrato-fast", name: "Vibrato Fast Warble", type: 33, tags: { A: "90", B: "50", C: "70", D: "20", E: "90" } },
  { id: "chorus-clean", name: "Chorus Clean Width", type: 48, tags: { A: "50", B: "40", C: "80", D: "29", E: "100", F: "45" } },
  { id: "chorus-rich", name: "Chorus Rich", type: 48, tags: { A: "64", B: "70", C: "50", D: "29", E: "100", F: "65" } },
  { id: "chorus-detune", name: "Chorus Detune", type: 48, tags: { A: "30", B: "85", C: "60", D: "20", E: "90", F: "70" } },
  { id: "chorus-subtle", name: "Chorus Subtle Doubling", type: 48, tags: { A: "45", B: "25", C: "90", D: "29", E: "100", F: "30" } },

  // —— Pitch ——
  { id: "synth-lead", name: "Synth Lead Filter", type: 6, tags: { A: "65", B: "70", C: "40", D: "75" } },
  { id: "synth-soft", name: "Synth Soft Pad", type: 6, tags: { A: "35", B: "40", C: "70", D: "55" } },
  { id: "synth-pluck", name: "Synth Pluck", type: 6, tags: { A: "80", B: "55", C: "25", D: "65" } },
  { id: "synth-growl", name: "Synth Growl", type: 6, tags: { A: "50", B: "90", C: "50", D: "80" } },
  { id: "g2b-full", name: "G2B Full Bass", type: 10, tags: { A: "80", B: "1" } },
  { id: "g2b-blend", name: "G2B Blend", type: 10, tags: { A: "50", B: "1" } },
  { id: "g2b-light", name: "G2B Light", type: 10, tags: { A: "30", B: "1" } },
  { id: "autoriff-fast", name: "Auto Riff Fast Run", type: 12, tags: { A: "0", B: "14", C: "0", D: "60", E: "1", F: "0", G: "55" } },
  { id: "autoriff-loop", name: "Auto Riff Loop Hold", type: 12, tags: { A: "5", B: "8", C: "1", D: "40", E: "1", F: "0", G: "60" } },
  { id: "autoriff-attack", name: "Auto Riff Attack Heavy", type: 12, tags: { A: "10", B: "11", C: "0", D: "90", E: "1", F: "2", G: "50" } },
  { id: "autoriff-sparse", name: "Auto Riff Sparse", type: 12, tags: { A: "15", B: "6", C: "0", D: "30", E: "0", F: "0", G: "45" } },
  { id: "transpose-up5", name: "Transpose +5", type: 14, tags: { A: "17", B: "1" } },
  { id: "transpose-down5", name: "Transpose −5", type: 14, tags: { A: "7", B: "1" } },
  { id: "transpose-octup", name: "Transpose +12", type: 14, tags: { A: "24", B: "1" } },
  { id: "transpose-octdn", name: "Transpose −12", type: 14, tags: { A: "0", B: "1" } },
  { id: "transpose-unison", name: "Transpose Unison", type: 14, tags: { A: "12", B: "1" } },
  { id: "pitchbend-whammy", name: "Pitch Bend Whammy Up", type: 15, tags: { A: "6", B: "80", C: "1" } },
  { id: "pitchbend-dive", name: "Pitch Bend Dive Bomb", type: 15, tags: { A: "0", B: "90", C: "1" } },
  { id: "pitchbend-mild", name: "Pitch Bend Mild", type: 15, tags: { A: "5", B: "40", C: "1" } },
  { id: "pitchbend-oct", name: "Pitch Bend +1 Oct", type: 15, tags: { A: "4", B: "70", C: "1" } },
  { id: "octave-down", name: "Octave −1", type: 28, tags: { A: "0", B: "70", C: "1" } },
  { id: "octave-down2", name: "Octave −2", type: 28, tags: { A: "1", B: "65", C: "1" } },
  { id: "octave-both", name: "Octave −1 & −2", type: 28, tags: { A: "2", B: "55", C: "1" } },
  { id: "octave-subtle", name: "Octave Subtle −1", type: 28, tags: { A: "0", B: "35", C: "1" } },

  // —— Vocal ——
  { id: "radio-lofi", name: "Radio Lo-Fi Voice", type: 8, tags: { A: "6", B: "60" } },
  { id: "radio-harsh", name: "Radio Harsh AM", type: 8, tags: { A: "9", B: "70" } },
  { id: "radio-soft", name: "Radio Soft Talk", type: 8, tags: { A: "3", B: "50" } },
  { id: "radio-extreme", name: "Radio Extreme", type: 8, tags: { A: "10", B: "80" } },
  { id: "robot-c", name: "Robot Fixed C", type: 16, tags: { A: "0", B: "50", C: "1" } },
  { id: "robot-g", name: "Robot Fixed G", type: 16, tags: { A: "7", B: "45", C: "1" } },
  { id: "robot-masc", name: "Robot Masculine", type: 16, tags: { A: "0", B: "25", C: "1" } },
  { id: "robot-fem", name: "Robot Feminine", type: 16, tags: { A: "4", B: "75", C: "1" } },
  { id: "electric-hard", name: "Electric Hard Steps", type: 17, tags: { A: "16", B: "50", C: "8", D: "12", E: "0" } },
  { id: "electric-soft", name: "Electric Soft Steps", type: 17, tags: { A: "14", B: "50", C: "3", D: "10", E: "0" } },
  { id: "electric-scale", name: "Electric Scale Lock", type: 17, tags: { A: "12", B: "55", C: "5", D: "14", E: "1" } },
  { id: "electric-stable", name: "Electric Stable", type: 17, tags: { A: "12", B: "50", C: "4", D: "18", E: "0" } },
  { id: "hrm-3rd", name: "HRM Manual +3rd", type: 18, tags: { A: "6", B: "50", C: "50", D: "0", E: "90", F: "75" } },
  { id: "hrm-5th", name: "HRM Manual +5th", type: 18, tags: { A: "8", B: "50", C: "60", D: "0", E: "85", F: "80" } },
  { id: "hrm-oct", name: "HRM Manual Octave+", type: 18, tags: { A: "1", B: "45", C: "50", D: "0", E: "100", F: "70" } },
  { id: "hrm-unison", name: "HRM Manual Unison", type: 18, tags: { A: "10", B: "55", C: "40", D: "0", E: "80", F: "65" } },
  { id: "hrmauto-high", name: "HRM Auto High", type: 19, tags: { A: "4", B: "50", C: "55", D: "1", E: "0", F: "90", G: "75" } },
  { id: "hrmauto-low", name: "HRM Auto Low", type: 19, tags: { A: "3", B: "50", C: "45", D: "1", E: "0", F: "90", G: "70" } },
  { id: "hrmauto-hybrid", name: "HRM Auto Hybrid", type: 19, tags: { A: "5", B: "55", C: "50", D: "0", E: "0", F: "100", G: "80" } },
  { id: "vocoder-trk1", name: "Vocoder Track 1 Carrier", type: 20, tags: { A: "6", B: "50", C: "50", D: "55", E: "60", F: "1" } },
  { id: "vocoder-bright", name: "Vocoder Bright", type: 20, tags: { A: "6", B: "70", C: "40", D: "60", E: "55", F: "1" } },
  { id: "vocoder-soft", name: "Vocoder Soft Attack", type: 20, tags: { A: "7", B: "45", C: "70", D: "40", E: "50", F: "1" } },
  { id: "oscvoc-saw", name: "OSC Voc Saw", type: 21, tags: { A: "0", B: "50", C: "45", D: "2", E: "55", F: "50", G: "55" } },
  { id: "oscvoc-square", name: "OSC Voc Square", type: 21, tags: { A: "3", B: "55", C: "40", D: "2", E: "50", F: "55", G: "60" } },
  { id: "oscvoc-detune", name: "OSC Voc Detune Saw", type: 21, tags: { A: "2", B: "50", C: "50", D: "3", E: "45", F: "50", G: "50" } },
  { id: "oscbot-melody", name: "OSC Bot Melody", type: 22, tags: { A: "0", B: "50", C: "40", D: "24", E: "50", F: "55" } },
  { id: "oscbot-bass", name: "OSC Bot Bass Note", type: 22, tags: { A: "1", B: "45", C: "55", D: "12", E: "40", F: "60" } },
  { id: "oscbot-square", name: "OSC Bot Square Lead", type: 22, tags: { A: "3", B: "55", C: "35", D: "36", E: "55", F: "50" } },

  // —— Amp ——
  { id: "preamp-jc", name: "Preamp JC Clean", type: 23, tags: { A: "0", B: "1", C: "30", D: "8", E: "50", F: "50", G: "55", H: "50", L: "55" } },
  { id: "preamp-natural", name: "Preamp Natural Clean", type: 23, tags: { A: "1", B: "1", C: "35", D: "10", E: "55", F: "50", G: "50", H: "45", L: "50" } },
  { id: "preamp-combo", name: "Preamp Combo Crunch", type: 23, tags: { A: "3", B: "1", C: "55", D: "10", E: "50", F: "55", G: "50", H: "50", L: "55" } },
  { id: "preamp-stack", name: "Preamp Stack Crunch", type: 23, tags: { A: "4", B: "5", C: "65", D: "12", E: "55", F: "50", G: "55", H: "55", L: "60" } },
  { id: "preamp-higain", name: "Preamp Higain Stack", type: 23, tags: { A: "5", B: "7", C: "85", D: "14", E: "50", F: "45", G: "55", H: "60", L: "55" } },
  { id: "preamp-lead", name: "Preamp Extreme Lead", type: 23, tags: { A: "7", B: "7", C: "95", D: "12", E: "45", F: "50", G: "60", H: "70", L: "60" } },
  { id: "preamp-metal", name: "Preamp Core Metal", type: 23, tags: { A: "8", B: "7", C: "100", D: "15", E: "60", F: "40", G: "55", H: "65", L: "55" } },
  { id: "preamp-power", name: "Preamp Power Drive", type: 23, tags: { A: "6", B: "5", C: "75", D: "11", E: "50", F: "55", G: "50", H: "55", L: "58" } },
  { id: "preamp-fullrange", name: "Preamp Full Range", type: 23, tags: { A: "2", B: "1", C: "40", D: "8", E: "50", F: "50", G: "50", H: "50", L: "55" } },
  { id: "dist-vocal", name: "DIST Vocal Edge", type: 24, tags: { A: "0", B: "55", C: "40", D: "30", E: "60" } },
  { id: "dist-boost", name: "DIST Clean Boost", type: 24, tags: { A: "1", B: "50", C: "25", D: "40", E: "70" } },
  { id: "dist-od", name: "DIST Overdrive", type: 24, tags: { A: "2", B: "55", C: "55", D: "20", E: "65" } },
  { id: "dist-ds", name: "DIST Distortion", type: 24, tags: { A: "3", B: "50", C: "70", D: "15", E: "60" } },
  { id: "dist-metal", name: "DIST Metal", type: 24, tags: { A: "4", B: "45", C: "85", D: "10", E: "55" } },
  { id: "dist-fuzz", name: "DIST Fuzz", type: 24, tags: { A: "5", B: "40", C: "90", D: "5", E: "55" } },

  // —— Dynamics ——
  { id: "sustainer-long", name: "Sustainer Long Hold", type: 11, tags: { A: "40", B: "70", C: "55", D: "20", E: "20", F: "80" } },
  { id: "sustainer-attack", name: "Sustainer Pick Attack", type: 11, tags: { A: "80", B: "50", C: "50", D: "22", E: "18", F: "55" } },
  { id: "sustainer-warm", name: "Sustainer Warm", type: 11, tags: { A: "50", B: "60", C: "50", D: "28", E: "15", F: "65" } },
  { id: "sustainer-bright", name: "Sustainer Bright", type: 11, tags: { A: "55", B: "55", C: "55", D: "15", E: "28", F: "60" } },
  { id: "slowgear-violin", name: "Slow Gear Violin", type: 13, tags: { A: "55", B: "70", C: "55", D: "1" } },
  { id: "slowgear-fast", name: "Slow Gear Fast Rise", type: 13, tags: { A: "60", B: "30", C: "60", D: "1" } },
  { id: "slowgear-pad", name: "Slow Gear Pad Swell", type: 13, tags: { A: "40", B: "85", C: "50", D: "1" } },
  { id: "slowgear-sens", name: "Slow Gear Sensitive", type: 13, tags: { A: "80", B: "55", C: "50", D: "1" } },
  { id: "dyn-natural", name: "Dynamics Natural Comp", type: 25, tags: { A: "0", B: "15" } },
  { id: "dyn-mixer", name: "Dynamics Mixer Comp", type: 25, tags: { A: "1", B: "18" } },
  { id: "dyn-live", name: "Dynamics Live Comp", type: 25, tags: { A: "2", B: "22" } },
  { id: "dyn-lim", name: "Dynamics Natural Lim", type: 25, tags: { A: "3", B: "12" } },
  { id: "dyn-hardlim", name: "Dynamics Hard Lim", type: 25, tags: { A: "4", B: "10" } },
  { id: "dyn-vocal", name: "Dynamics Vocal Comp", type: 25, tags: { A: "11", B: "20" } },
  { id: "dyn-acoustic", name: "Dynamics Acoustic", type: 25, tags: { A: "12", B: "16" } },
  { id: "dyn-brighten", name: "Dynamics Brighten", type: 25, tags: { A: "16", B: "20" } },
  { id: "dyn-phone", name: "Dynamics Phone Vox", type: 25, tags: { A: "18", B: "22" } },
  { id: "eq-flat", name: "EQ Flat", type: 26, tags: { A: "20", B: "20", C: "20", D: "20", E: "50", F: "0", G: "29", H: "0" } },
  { id: "eq-bass-cut", name: "EQ Bass Cut", type: 26, tags: { A: "10", B: "18", C: "20", D: "22", E: "55", F: "8", G: "29", H: "20" } },
  { id: "eq-presence", name: "EQ Presence Boost", type: 26, tags: { A: "20", B: "20", C: "24", D: "28", E: "55", F: "0", G: "25", H: "40" } },
  { id: "eq-scooped", name: "EQ Scooped Mid", type: 26, tags: { A: "24", B: "12", C: "14", D: "24", E: "55", F: "0", G: "29", H: "10" } },
  { id: "eq-telephone", name: "EQ Telephone", type: 26, tags: { A: "8", B: "28", C: "30", D: "10", E: "50", F: "12", G: "18", H: "30" } },
  { id: "eq-warm", name: "EQ Warm Low", type: 26, tags: { A: "26", B: "22", C: "18", D: "16", E: "52", F: "0", G: "26", H: "15" } },

  // —— Slicer ——
  { id: "pslice-p01", name: "Pattern Slicer P01", type: 34, tags: { A: "11", B: "49", C: "35", D: "0", E: "100", F: "0", G: "2" } },
  { id: "pslice-p05", name: "Pattern Slicer P05", type: 34, tags: { A: "11", B: "55", C: "40", D: "4", E: "90", F: "0", G: "2" } },
  { id: "pslice-p10", name: "Pattern Slicer P10", type: 34, tags: { A: "14", B: "45", C: "50", D: "9", E: "100", F: "0", G: "4" } },
  { id: "pslice-p15", name: "Pattern Slicer P15", type: 34, tags: { A: "8", B: "60", C: "30", D: "14", E: "85", F: "0", G: "2" } },
  { id: "pslice-p20", name: "Pattern Slicer P20", type: 34, tags: { A: "11", B: "40", C: "55", D: "19", E: "100", F: "0", G: "0" } },
  { id: "pslice-fast", name: "Pattern Slicer Fast", type: 34, tags: { A: "17", B: "50", C: "40", D: "2", E: "100", F: "0", G: "2" } },
  { id: "pslice-duty", name: "Pattern Slicer Narrow Duty", type: 34, tags: { A: "11", B: "25", C: "45", D: "6", E: "100", F: "0", G: "2" } },
  { id: "sslice-16", name: "Step Slicer 16 Steps", type: 35, tags: { A: "11", B: "15", C: "50", "#": "100" } },
  { id: "sslice-8", name: "Step Slicer 8 Steps", type: 35, tags: { A: "11", B: "7", C: "55", "#": "90" } },
  { id: "sslice-4", name: "Step Slicer 4 Steps", type: 35, tags: { A: "8", B: "3", C: "60", "#": "100" } },
  { id: "sslice-fast", name: "Step Slicer Fast Rate", type: 35, tags: { A: "17", B: "15", C: "45", "#": "100" } },
  { id: "sslice-gate", name: "Step Slicer Hard Gate", type: 35, tags: { A: "11", B: "15", C: "30", D: "100", E: "0", F: "100", G: "0", H: "100", I: "0", J: "100", "#": "100" } },

  // —— Delay ——
  { id: "delay-slap", name: "Delay Slapback", type: 36, tags: { A: "90", B: "10", C: "100", D: "0", E: "29", F: "40" } },
  { id: "delay-echo", name: "Delay Classic Echo", type: 36, tags: { A: "211", B: "35", C: "90", D: "0", E: "25", F: "55" } },
  { id: "delay-long", name: "Delay Long Trail", type: 36, tags: { A: "511", B: "55", C: "80", D: "0", E: "22", F: "60" } },
  { id: "delay-dotted", name: "Delay Dotted 1/8", type: 36, tags: { A: "4", B: "30", C: "100", D: "0", E: "29", F: "50" } },
  { id: "delay-quarter", name: "Delay 1/4 Note", type: 36, tags: { A: "6", B: "25", C: "100", D: "0", E: "29", F: "50" } },
  { id: "delay-dark", name: "Delay Dark Repeats", type: 36, tags: { A: "250", B: "40", C: "85", D: "5", E: "18", F: "55" } },
  { id: "pdelay-wide", name: "Panning Delay Wide", type: 37, tags: { A: "211", B: "30", C: "90", D: "0", E: "29", F: "55" } },
  { id: "pdelay-slap", name: "Panning Delay Slap", type: 37, tags: { A: "100", B: "15", C: "100", D: "0", E: "29", F: "45" } },
  { id: "pdelay-long", name: "Panning Delay Long", type: 37, tags: { A: "400", B: "45", C: "80", D: "0", E: "24", F: "60" } },
  { id: "pdelay-sync", name: "Panning Delay Synced", type: 37, tags: { A: "6", B: "28", C: "100", D: "0", E: "29", F: "50" } },
  { id: "rdelay-wash", name: "Reverse Delay Wash", type: 38, tags: { A: "300", B: "40", C: "70", D: "0", E: "29", F: "65" } },
  { id: "rdelay-short", name: "Reverse Delay Short", type: 38, tags: { A: "150", B: "25", C: "90", D: "0", E: "29", F: "50" } },
  { id: "rdelay-ambient", name: "Reverse Delay Ambient", type: 38, tags: { A: "450", B: "50", C: "60", D: "0", E: "22", F: "70" } },
  { id: "rdelay-sync", name: "Reverse Delay Synced", type: 38, tags: { A: "6", B: "35", C: "80", D: "0", E: "29", F: "55" } },
  { id: "mdelay-chorus", name: "Mod Delay Chorus Echo", type: 39, tags: { A: "211", B: "30", C: "60", D: "90", E: "0", F: "29", G: "55" } },
  { id: "mdelay-deep", name: "Mod Delay Deep Mod", type: 39, tags: { A: "250", B: "35", C: "85", D: "80", E: "0", F: "25", G: "60" } },
  { id: "mdelay-subtle", name: "Mod Delay Subtle", type: 39, tags: { A: "180", B: "20", C: "35", D: "100", E: "0", F: "29", G: "45" } },
  { id: "mdelay-long", name: "Mod Delay Long Trail", type: 39, tags: { A: "400", B: "50", C: "55", D: "75", E: "0", F: "22", G: "65" } },
  { id: "tape1-warm", name: "Tape Echo1 Warm", type: 40, tags: { A: "211", B: "45", C: "90", D: "0", E: "22", F: "55" } },
  { id: "tape1-space", name: "Tape Echo1 Space", type: 40, tags: { A: "350", B: "60", C: "80", D: "0", E: "20", F: "60" } },
  { id: "tape1-slap", name: "Tape Echo1 Slap", type: 40, tags: { A: "120", B: "25", C: "100", D: "0", E: "29", F: "45" } },
  { id: "tape1-sync", name: "Tape Echo1 Synced", type: 40, tags: { A: "6", B: "40", C: "95", D: "0", E: "29", F: "50" } },
  { id: "tape2-flutter", name: "Tape Echo2 Flutter", type: 41, tags: { A: "50", B: "50", C: "90", D: "70", E: "45", F: "55" } },
  { id: "tape2-clean", name: "Tape Echo2 Clean", type: 41, tags: { A: "45", B: "35", C: "100", D: "20", E: "55", F: "50" } },
  { id: "tape2-dark", name: "Tape Echo2 Dark", type: 41, tags: { A: "55", B: "55", C: "85", D: "40", E: "30", F: "55" } },
  { id: "tape2-intense", name: "Tape Echo2 Intense", type: 41, tags: { A: "60", B: "75", C: "70", D: "60", E: "50", F: "65" } },
  { id: "granular-buzz", name: "Granular Buzz", type: 42, tags: { A: "40", B: "80", C: "55" } },
  { id: "granular-soft", name: "Granular Soft Grain", type: 42, tags: { A: "60", B: "50", C: "45" } },
  { id: "granular-dense", name: "Granular Dense", type: 42, tags: { A: "30", B: "90", C: "60" } },
  { id: "granular-sparse", name: "Granular Sparse", type: 42, tags: { A: "75", B: "40", C: "50" } },
  { id: "warp-dream", name: "Warp Dream", type: 43, tags: { A: "60" } },
  { id: "warp-deep", name: "Warp Deep", type: 43, tags: { A: "80" } },
  { id: "warp-light", name: "Warp Light", type: 43, tags: { A: "35" } },
  { id: "twist-spin", name: "Twist Aggressive Spin", type: 44, tags: { A: "0", B: "70", C: "50", D: "60" } },
  { id: "twist-fade", name: "Twist Fade Out", type: 44, tags: { A: "2", B: "55", C: "70", D: "55" } },
  { id: "twist-fast", name: "Twist Fast Rise", type: 44, tags: { A: "1", B: "85", C: "40", D: "60" } },
  { id: "roll1-half", name: "Roll1 Half Cut", type: 45, tags: { A: "8", B: "60", C: "1", D: "55" } },
  { id: "roll1-16", name: "Roll1 1/16 Stutter", type: 45, tags: { A: "11", B: "70", C: "4", D: "60" } },
  { id: "roll1-off", name: "Roll1 Loop Only", type: 45, tags: { A: "6", B: "80", C: "0", D: "50" } },
  { id: "roll2-quarter", name: "Roll2 1/4 Split", type: 46, tags: { A: "8", B: "55", C: "2", D: "55" } },
  { id: "roll2-8", name: "Roll2 1/8 Split", type: 46, tags: { A: "11", B: "60", C: "3", D: "60" } },
  { id: "roll2-inf", name: "Roll2 Infinite Feel", type: 46, tags: { A: "8", B: "100", C: "1", D: "50" } },
  { id: "freeze-pad", name: "Freeze Pad Hold", type: 47, tags: { A: "40", B: "40", C: "50", D: "70", E: "60" } },
  { id: "freeze-fast", name: "Freeze Fast Attack", type: 47, tags: { A: "10", B: "30", C: "40", D: "60", E: "55" } },
  { id: "freeze-long", name: "Freeze Long Release", type: 47, tags: { A: "30", B: "80", C: "40", D: "80", E: "55" } },
  { id: "freeze-blend", name: "Freeze Soft Blend", type: 47, tags: { A: "35", B: "35", C: "35", D: "50", E: "40" } },

  // —— Reverb ——
  { id: "reverb-room", name: "Reverb Small Room", type: 49, tags: { A: "20", B: "0", C: "40", D: "0", E: "29", F: "100", G: "35" } },
  { id: "reverb-hall", name: "Reverb Hall", type: 49, tags: { A: "55", B: "0", C: "50", D: "0", E: "29", F: "90", G: "50" } },
  { id: "reverb-plate", name: "Reverb Plate Feel", type: 49, tags: { A: "35", B: "0", C: "70", D: "0", E: "25", F: "95", G: "45" } },
  { id: "reverb-huge", name: "Reverb Huge Space", type: 49, tags: { A: "85", B: "0", C: "55", D: "0", E: "22", F: "80", G: "65" } },
  { id: "reverb-dark", name: "Reverb Dark", type: 49, tags: { A: "45", B: "5", C: "45", D: "15", E: "20", F: "90", G: "50" } },
  { id: "reverb-bright", name: "Reverb Bright Air", type: 49, tags: { A: "40", B: "0", C: "40", D: "0", E: "35", F: "100", G: "45" } },
  { id: "reverb-subtle", name: "Reverb Subtle Ambience", type: 49, tags: { A: "25", B: "0", C: "30", D: "0", E: "29", F: "100", G: "25" } },
  { id: "gate-snappy", name: "Gate Reverb Snappy", type: 50, tags: { A: "25", B: "0", C: "70", D: "0", E: "29", F: "100", G: "45" } },
  { id: "gate-drum", name: "Gate Reverb Drum Room", type: 50, tags: { A: "35", B: "0", C: "80", D: "0", E: "29", F: "95", G: "50" } },
  { id: "gate-short", name: "Gate Reverb Short", type: 50, tags: { A: "15", B: "0", C: "60", D: "0", E: "29", F: "100", G: "40" } },
  { id: "gate-wide", name: "Gate Reverb Wide", type: 50, tags: { A: "45", B: "0", C: "55", D: "0", E: "25", F: "90", G: "55" } },
  { id: "rrev-swell", name: "Reverse Reverb Swell", type: 51, tags: { A: "40", B: "0", C: "40", D: "0", E: "29", F: "90", G: "55" } },
  { id: "rrev-short", name: "Reverse Reverb Short", type: 51, tags: { A: "15", B: "0", C: "30", D: "0", E: "29", F: "100", G: "45" } },
  { id: "rrev-ambient", name: "Reverse Reverb Ambient", type: 51, tags: { A: "60", B: "0", C: "50", D: "0", E: "24", F: "85", G: "60" } },
  { id: "rrev-vocal", name: "Reverse Reverb Vocal Prefade", type: 51, tags: { A: "30", B: "0", C: "35", D: "0", E: "29", F: "95", G: "50" } },
];

export function buildFactoryInputFxPresets(): InputFxPreset[] {
  const out: InputFxPreset[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const spec of FACTORY_SPECS) {
    const id = `factory-${spec.id}`;
    const name = spec.name.trim();
    if (seenIds.has(id) || seenNames.has(name.toLowerCase())) {
      throw new Error(`Duplicate factory Input FX preset: ${spec.id} / ${name}`);
    }
    seenIds.add(id);
    seenNames.add(name.toLowerCase());

    const category = spec.category ?? inputFxCategory(spec.type);
    const defaults = inputFxDefaultTags(spec.type);
    const tags = mergeTags(defaults, spec.tags);
    const preset: InputFxPreset = {
      id,
      name,
      category,
      source: "factory",
      type: spec.type,
      tags,
    };
    if (INPUT_FX_SEQ_TYPES.has(spec.type)) {
      preset.seqTags = mergeTags(inputFxDefaultSeqTags(), spec.seqTags);
    }
    out.push(preset);
  }

  return out;
}

export function factoryPresetCountByCategory(): Record<InputFxCategory | "all", number> {
  const presets = buildFactoryInputFxPresets();
  const counts: Record<string, number> = { all: presets.length };
  for (const p of presets) {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }
  return counts as Record<InputFxCategory | "all", number>;
}

/** Kept for tests / tooling that want a stable slug helper. */
export function factoryPresetSlug(name: string): string {
  return slugify(name);
}
