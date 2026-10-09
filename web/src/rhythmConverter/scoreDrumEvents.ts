/** Guitar Pro / MusicXML score → played drum bars (repeats expanded) via alphaTab, no rendering. */

export interface DrumHit {
  /** Ticks from the start of the bar, in `DrumScore.ppq`. */
  tick: number;
  note: number;
  velocity: number;
}

export interface PlayedBar {
  /** Position in playback order (repeats expanded). */
  index: number;
  /** Bar number in the written score (0-based). */
  masterBarIndex: number;
  numerator: number;
  denominator: number;
  lengthTicks: number;
  tempo: number;
  /** Section marker text when this bar starts a section. */
  section: string | null;
  hits: DrumHit[];
}

export interface ScoreTrackSummary {
  index: number;
  name: string;
  isPercussion: boolean;
  noteCount: number;
}

export interface DrumScore {
  title: string;
  artist: string;
  ppq: number;
  tracks: ScoreTrackSummary[];
  /** Tracks merged into `bars` (empty when none could be picked). */
  trackIndices: number[];
  bars: PlayedBar[];
}

export const SCORE_FILE_ACCEPT = ".gp,.gpx,.gp3,.gp4,.gp5,.musicxml,.xml,.mxl,.mid,.midi";

/** alphaTab generates at 960 ticks per quarter note. */
const ALPHATAB_PPQ = 960;

interface CapturedNote {
  track: number;
  start: number;
  key: number;
  velocity: number;
}

interface CaptureResult {
  notes: CapturedNote[];
  tempos: { tick: number; bpm: number }[];
  lookups: any[];
}

type AlphaTabModule = typeof import("@coderline/alphatab");

export async function loadAlphaTab(): Promise<AlphaTabModule> {
  return import("@coderline/alphatab");
}

export function loadScoreBytes(at: AlphaTabModule, bytes: Uint8Array): any {
  return at.importer.ScoreLoader.loadScoreFromBytes(bytes, new at.Settings());
}

function captureMidi(at: AlphaTabModule, score: any): CaptureResult {
  const notes: CapturedNote[] = [];
  const tempos: { tick: number; bpm: number }[] = [];
  const handler = {
    addTimeSignature() {},
    addRest() {},
    addNote(track: number, start: number, _length: number, key: number, velocity: number) {
      notes.push({ track, start, key, velocity });
    },
    addControlChange() {},
    addProgramChange() {},
    addTempo(tick: number, bpm: number) {
      tempos.push({ tick, bpm });
    },
    addNoteBend() {},
    addBend() {},
    finishTrack() {},
    addTickShift() {},
  };
  const generator = new at.midi.MidiFileGenerator(score, new at.Settings(), handler as any);
  generator.generate();
  notes.sort((a, b) => a.start - b.start);
  tempos.sort((a, b) => a.tick - b.tick);
  return { notes, tempos, lookups: [...(generator.tickLookup.masterBars ?? [])] };
}

export function isPercussionTrack(track: any): boolean {
  return Boolean(
    track?.isPercussion ||
      track?.staves?.some?.((staff: any) => staff?.isPercussion) ||
      /drum|percussion|bateria/i.test(String(track?.name ?? "")),
  );
}

function sectionLabel(masterBar: any): string | null {
  const section = masterBar?.section;
  if (!section) return null;
  const text = String(section.text ?? "").trim() || String(section.marker ?? "").trim();
  return text || null;
}

function tempoAt(tempos: readonly { tick: number; bpm: number }[], tick: number, fallback: number): number {
  let bpm = fallback;
  for (const t of tempos) {
    if (t.tick > tick) break;
    bpm = t.bpm;
  }
  return bpm;
}

export function defaultDrumTrackIndex(tracks: readonly ScoreTrackSummary[]): number | null {
  const withNotes = tracks.filter((t) => t.noteCount > 0);
  return (
    withNotes.find((t) => t.isPercussion)?.index ??
    tracks.find((t) => t.isPercussion)?.index ??
    null
  );
}

/** Every percussion track with notes (merged by default), else the detected drum track. */
export function defaultDrumTracks(tracks: readonly ScoreTrackSummary[]): number[] {
  const drums = tracks.filter((t) => t.isPercussion && t.noteCount > 0).map((t) => t.index);
  if (drums.length) return drums.sort((a, b) => a - b);
  const detected = defaultDrumTrackIndex(tracks);
  return detected == null ? [] : [detected];
}

/** Valid, sorted, de-duplicated `wanted` tracks, or every drum track when none are valid. */
export function resolveTrackSelection(
  tracks: readonly ScoreTrackSummary[],
  wanted?: readonly number[] | null,
): number[] {
  const valid = [...new Set(wanted ?? [])].filter((i) => tracks.some((t) => t.index === i));
  if (valid.length) return valid.sort((a, b) => a - b);
  return defaultDrumTracks(tracks);
}

/** Builds the played-bar list from `trackIndices` merged together (or the detected drum track). */
export function extractDrumScore(
  at: AlphaTabModule,
  score: any,
  trackIndices?: readonly number[] | null,
): DrumScore {
  const capture = captureMidi(at, score);
  const counts = new Map<number, number>();
  for (const n of capture.notes) counts.set(n.track, (counts.get(n.track) ?? 0) + 1);
  const tracks: ScoreTrackSummary[] = (score?.tracks ?? []).map((track: any, i: number) => {
    const index = Number.isInteger(track?.index) ? track.index : i;
    return {
      index,
      name: String(track?.name || `Track ${i + 1}`),
      isPercussion: isPercussionTrack(track),
      noteCount: counts.get(index) ?? 0,
    };
  });
  const chosen = resolveTrackSelection(tracks, trackIndices);
  const fallbackTempo = Number(score?.tempo) || 120;
  const trackNotes = capture.notes.filter((n) => chosen.includes(n.track));

  let cursor = 0;
  const bars: PlayedBar[] = capture.lookups.map((lookup: any, index: number) => {
    const start = Number(lookup.start) || 0;
    const end = Number(lookup.end) || start;
    while (cursor < trackNotes.length && trackNotes[cursor]!.start < start) cursor++;
    const hits: DrumHit[] = [];
    for (let j = cursor; j < trackNotes.length && trackNotes[j]!.start < end; j++) {
      const n = trackNotes[j]!;
      hits.push({ tick: n.start - start, note: n.key, velocity: Math.max(1, Math.min(127, n.velocity)) });
    }
    const mb = lookup.masterBar;
    const tempoChange = lookup.tempoChanges?.[0]?.tempo;
    return {
      index,
      masterBarIndex: Number(mb?.index ?? index),
      numerator: Number(mb?.timeSignatureNumerator) || 4,
      denominator: Number(mb?.timeSignatureDenominator) || 4,
      lengthTicks: end - start,
      tempo: Number(tempoChange) || tempoAt(capture.tempos, start, fallbackTempo),
      section: sectionLabel(mb),
      hits,
    };
  });

  return {
    title: String(score?.title ?? "").trim(),
    artist: String(score?.artist ?? "").trim(),
    ppq: ALPHATAB_PPQ,
    tracks,
    trackIndices: chosen,
    bars,
  };
}

export function meterLabel(bar: Pick<PlayedBar, "numerator" | "denominator">): string {
  return `${bar.numerator}/${bar.denominator}`;
}

/** Most common meter across bars that have hits (falls back to all bars). */
export function dominantMeter(bars: readonly PlayedBar[]): string | null {
  const pool = bars.some((b) => b.hits.length) ? bars.filter((b) => b.hits.length) : bars;
  const counts = new Map<string, number>();
  for (const b of pool) counts.set(meterLabel(b), (counts.get(meterLabel(b)) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}
