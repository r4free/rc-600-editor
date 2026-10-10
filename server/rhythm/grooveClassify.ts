/** Guesses what a run of drum bars is (Intro / Variation / Fill / Ending) and which style and feel tags fit. */
import type { PartKind } from "../../web/src/rhythmConverter/partLibrary.js";
import type { PlayedBar } from "../../web/src/rhythmConverter/scoreDrumEvents.js";
import { drumClass } from "../../web/src/rhythmConverter/sectionSuggest.js";
import { classifySection } from "./suggest.js";

/** Bongos, congas, timbales, agogo, guiro, claves, cuica (not shakers or cowbell). */
const LATIN_NOTES = new Set([60, 61, 62, 63, 64, 65, 66, 67, 68, 73, 74, 75, 78, 79]);
const SNARE_NOTES = new Set([37, 38, 39, 40]);
const RIDE_NOTES = new Set([51, 53, 59]);

export interface GrooveFeatures {
  bars: number;
  hits: number;
  meter: string;
  bpm: number;
  /** Share of off-beat hat/cymbal/snare hits on triplet positions (0–1). */
  swing: number;
  /** Share of hits on Latin hand percussion. */
  latin: number;
  /** Share of 4/4 bars with a kick on every beat. */
  fourFloor: number;
  /** Share of 4/4 bars with kick + snare on beat 3 only (reggae one drop). */
  oneDrop: number;
  /** Share of 4/4 bars with snare on beats 2 and 4. */
  backbeat: number;
  /** Share of 4/4 bars with the snare on beat 3 and not on 2 or 4. */
  halfTime: number;
  /** Share of hits on toms. */
  toms: number;
  /** Share of time-keeping hits on the ride (vs hi-hat). */
  ride: number;
  /** Kick hits per played bar. */
  kicksPerBar: number;
}

export interface GrooveGuess {
  kind: PartKind;
  /** Why this category was picked, in plain words. */
  kindReason: string;
  tags: string[];
  features: GrooveFeatures;
}

function near(x: number, target: number, tol = 0.05): boolean {
  return Math.abs(x - target) <= tol;
}

export function grooveFeatures(bars: readonly PlayedBar[], ppq: number): GrooveFeatures {
  const played = bars.filter((b) => b.hits.length);
  const meterCount = new Map<string, number>();
  for (const b of played.length ? played : bars) {
    const key = `${b.numerator}/${b.denominator}`;
    meterCount.set(key, (meterCount.get(key) ?? 0) + 1);
  }
  const meter = [...meterCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "4/4";
  const tempos = (played.length ? played : bars).map((b) => b.tempo).sort((a, b) => a - b);
  const bpm = Math.round(tempos[Math.floor(tempos.length / 2)] ?? 120);

  let trip = 0;
  let straight = 0;
  let latin = 0;
  let toms = 0;
  let ride = 0;
  let hat = 0;
  let kickHits = 0;
  let hits = 0;
  let quad = 0;
  let fourFloor = 0;
  let oneDrop = 0;
  let backbeat = 0;
  let halfTime = 0;
  for (const b of played) {
    const beat = (ppq * 4) / b.denominator;
    const kicks = new Set<number>();
    const snares = new Set<number>();
    for (const h of b.hits) {
      hits++;
      const cls = drumClass(h.note);
      if (LATIN_NOTES.has(h.note)) latin++;
      if (cls === "tom") toms++;
      if (cls === "kick") kickHits++;
      if (RIDE_NOTES.has(h.note)) ride++;
      else if (cls === "hat") hat++;
      const pos = (h.tick % beat) / beat;
      const onBeat = pos < 0.06 || pos > 0.94;
      const beatIndex = Math.round(h.tick / beat) % b.numerator;
      if (cls === "kick" && onBeat) kicks.add(beatIndex);
      if (SNARE_NOTES.has(h.note) && onBeat) snares.add(beatIndex);
      if (cls === "hat" || cls === "cymbal" || cls === "snare") {
        if (near(pos, 1 / 3) || near(pos, 2 / 3)) trip++;
        else if (near(pos, 0.25) || near(pos, 0.5) || near(pos, 0.75)) straight++;
      }
    }
    if (b.numerator === 4 && b.denominator === 4) {
      quad++;
      if ([0, 1, 2, 3].every((i) => kicks.has(i))) fourFloor++;
      if (kicks.has(2) && snares.has(2) && !kicks.has(0) && !snares.has(1) && !snares.has(3)) oneDrop++;
      if (snares.has(1) && snares.has(3)) backbeat++;
      if (snares.has(2) && !snares.has(1) && !snares.has(3)) halfTime++;
    }
  }
  const share = (n: number, of: number) => (of ? n / of : 0);
  return {
    bars: bars.length,
    hits,
    meter,
    bpm,
    swing: trip >= 4 ? share(trip, trip + straight) : 0,
    latin: share(latin, hits),
    fourFloor: share(fourFloor, quad),
    oneDrop: share(oneDrop, quad),
    backbeat: share(backbeat, quad),
    halfTime: share(halfTime, quad),
    toms: share(toms, hits),
    ride: share(ride, ride + hat),
    kicksPerBar: share(kickHits, played.length),
  };
}

export interface KitSuggestion {
  /** Index into the RC-600 rhythm kit list (0 Studio … 15 808+909). */
  kit: number;
  reason: string;
}

/** RC-600 kit that best fits the groove (indices follow the pedal's Kit list). */
export function suggestKit(f: GrooveFeatures): KitSuggestion {
  const [num, den] = f.meter.split("/").map(Number) as [number, number];
  const quad = num === 4 && den === 4;
  const swung = f.swing > 0.55;
  if (swung && f.ride > 0.5) {
    return f.bpm < 100
      ? { kit: 7, reason: "Slow swing played on the ride: a brushed jazz kit." }
      : { kit: 6, reason: "Swing played on the ride cymbal." };
  }
  if (swung) return { kit: 1, reason: "Shuffle / blues feel: a live acoustic room kit." };
  if (f.latin > 0.15) return { kit: 8, reason: "Lots of Latin hand percussion: the Cajon kit." };
  if (quad && f.fourFloor > 0.6) {
    return f.bpm >= 128
      ? { kit: 12, reason: `Four-on-the-floor kick at ${f.bpm} BPM: electronic Techno kit.` }
      : { kit: 11, reason: "Four-on-the-floor kick: Dance kit." };
  }
  if (f.kicksPerBar >= 7 && f.bpm >= 100) return { kit: 5, reason: "Very busy kick (double bass drum): Metal kit." };
  if (quad && f.oneDrop > 0.4) return { kit: 1, reason: "Reggae one drop: a live acoustic kit." };
  if (!quad) {
    return f.bpm < 100
      ? { kit: 2, reason: `Gentle ${f.meter} groove: the Light kit.` }
      : { kit: 0, reason: `${f.meter} groove: the all-round Studio kit.` };
  }
  if (f.halfTime > 0.5 && f.bpm < 100) return { kit: 14, reason: "Half-time snare at a slow tempo: Hip Hop kit." };
  if (f.bpm >= 150) return { kit: 4, reason: `Fast backbeat at ${f.bpm} BPM: Rock kit.` };
  if (f.kicksPerBar >= 4.5 && f.bpm >= 100) return { kit: 3, reason: "Driving kick and backbeat: Heavy kit." };
  if (f.bpm < 80) return { kit: 2, reason: `Ballad tempo (${f.bpm} BPM): the Light kit.` };
  if (f.backbeat > 0.5 && f.bpm >= 110) return { kit: 4, reason: "Straight backbeat: Rock kit." };
  return { kit: 0, reason: "Straight pop groove: the all-round Studio kit." };
}

/** Style and feel tags for these features (names match the library's ready-made tags). */
export function grooveTags(f: GrooveFeatures): string[] {
  const tags: string[] = [];
  const [num, den] = f.meter.split("/").map(Number) as [number, number];
  const quad = num === 4 && den === 4;
  const swung = f.swing > 0.55;
  if (num === 3 && den === 4) tags.push("Waltz");
  if (den === 8 && (num === 6 || num === 9 || num === 12)) tags.push("6/8");
  if (quad && f.oneDrop > 0.4) tags.push("Reggae");
  if (f.latin > 0.15) tags.push("Latin", "Percussion");
  if (swung) tags.push(f.ride > 0.5 ? "Swing" : "Shuffle");
  if (swung && f.ride > 0.5) tags.push("Jazz");
  else if (swung && f.backbeat > 0.5) tags.push("Blues");
  if (quad && !swung && f.fourFloor > 0.6) tags.push(f.bpm > 135 ? "Electronic" : "Disco");
  if (quad && !swung && f.backbeat > 0.6 && f.fourFloor <= 0.6 && f.oneDrop <= 0.4 && f.latin <= 0.15) {
    tags.push(f.bpm >= 165 ? "Punk" : "Pop Rock");
  }
  if (quad && f.halfTime > 0.5 && f.oneDrop <= 0.4) tags.push("Half Time");
  if (!swung && (f.backbeat > 0.5 || f.fourFloor > 0.6)) tags.push("Straight");
  if (f.bpm < 80) tags.push(f.bpm < 75 && !swung ? "Ballad" : "Slow");
  else if (f.bpm < 115) tags.push("Medium");
  else if (f.bpm >= 150) tags.push("Fast");
  return [...new Set(tags)];
}

/** Section marker in effect at `index` (the last one at or before it). */
function sectionAt(song: readonly PlayedBar[], index: number): string | null {
  for (let i = Math.min(index, song.length - 1); i >= 0; i--) if (song[i]!.section) return song[i]!.section;
  return null;
}

function fillLike(bars: readonly PlayedBar[], f: GrooveFeatures, neighbours: readonly PlayedBar[]): boolean {
  if (bars.length > 2 || !f.hits) return false;
  if (f.toms > 0.15) return true;
  const snares = bars.reduce((n, b) => n + b.hits.filter((h) => SNARE_NOTES.has(h.note)).length, 0);
  const density = f.hits / bars.length;
  const around = neighbours.filter((b) => b.hits.length);
  const usual = around.length ? around.reduce((n, b) => n + b.hits.length, 0) / around.length : density;
  return snares >= 6 * bars.length && density > usual * 1.15;
}

/**
 * Category and tags for song bars `[start, end)`. Uses the section marker when there is one, then
 * the position in the song (first / last drum bars), then the groove itself (toms and snare rolls → Fill).
 */
export function classifyBars(song: readonly PlayedBar[], start: number, end: number, ppq: number): GrooveGuess {
  const bars = song.slice(start, end);
  const features = grooveFeatures(bars, ppq);
  const tags = grooveTags(features);
  const drumIdx = song.filter((b) => b.hits.length).map((b) => b.index);
  const firstDrum = drumIdx[0] ?? 0;
  const lastDrum = drumIdx.at(-1) ?? song.length - 1;
  const short = bars.length <= 4;
  const neighbours = [...song.slice(Math.max(0, start - 4), start), ...song.slice(end, end + 4)];

  const marker = classifySection(sectionAt(song, start));
  if (marker === "intro" && short) return { kind: "intro", kindReason: "Inside the song's Intro section.", tags, features };
  if (marker === "ending" && short) return { kind: "ending", kindReason: "Inside the song's Outro / Ending section.", tags, features };
  if (marker === "fill" && bars.length <= 2) return { kind: "fill", kindReason: "Marked as a fill / break in the song.", tags, features };

  if (fillLike(bars, features, neighbours)) {
    return {
      kind: "fill",
      kindReason: features.toms > 0.15 ? "Tom-heavy short phrase, typical of a fill." : "Snare roll busier than the bars around it.",
      tags,
      features,
    };
  }
  if (short && start <= firstDrum && end < lastDrum) {
    return { kind: "intro", kindReason: "The first drum bars of the song.", tags, features };
  }
  if (short && end > lastDrum && start > firstDrum) {
    return { kind: "ending", kindReason: "The last drum bars of the song.", tags, features };
  }
  return { kind: "variation", kindReason: "A steady groove.", tags, features };
}
