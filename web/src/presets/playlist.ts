export const SETLIST_CATALOG_VERSION = 4;
export const USER_SETLISTS_STORAGE_KEY = "rc600.setlists";
export const LEGACY_PLAYLISTS_STORAGE_KEY = "rc600.playDrum.playlists";
export const MAX_SONG_MUSIC_SOURCE_LENGTH = 100_000;

export type SongMusicFormat = "chart" | "chords";
export type SongKeyMode = "major" | "minor";

interface SetlistMusicBase {
  kind: "scroll" | "score";
  /** Confirmed written key root, using an ASCII accidental (for example F# or Bb). */
  key: string;
  mode: SongKeyMode;
  /** Non-destructive live transposition relative to the source. */
  transpose: number;
  /** Optional performer notes such as arrangement, version, or cues. */
  performanceNotes?: string;
}

export interface SetlistScrollGuide extends SetlistMusicBase {
  kind: "scroll";
  format: SongMusicFormat;
  source: string;
  /** Optional duration used by the linear chart auto-scroll. */
  autoScrollSeconds?: number;
}

export interface SetlistScoreGuide extends SetlistMusicBase {
  kind: "score";
  /** Optional lyrics/chords guide kept alongside the exact score. */
  scrollGuide?: SetlistScrollGuide;
  liveView?: "score" | "scroll";
  assetId: string;
  fileName: string;
  byteLength: number;
  selectedTrackIndexes: number[];
  /** Score tracks muted in synthesized alphaTab playback. */
  mutedTrackIndexes?: number[];
  vocalTrackIndex?: number;
  /** Route the selected score drum track to the RC-600 over MIDI. */
  rc600Drums?: boolean;
  drumTrackIndex?: number;
  metronome: boolean;
  countIn: boolean;
  scoreAudio: boolean;
  playbackSpeed: number;
}

export type SetlistSongMusic = SetlistScrollGuide | SetlistScoreGuide;

export interface SetlistTimedChord {
  chord: string;
  beats: number;
  /** 1-based musical line in the rendered chart. */
  line?: number;
  section?: string;
}

export interface SetlistTempoGuide {
  mode: "free" | "original";
  bpm: number;
  beatsPerBar: number;
  beatUnit: 2 | 4 | 8;
  countInBars: number;
  timeline: SetlistTimedChord[];
}

export interface SetlistVoiceToneMatch {
  enabled: boolean;
}

export interface SetlistMidiAction {
  id: string;
  channel: number;
  controller: number;
  value: number;
  delayMs: number;
}

export interface SetlistSong {
  id: string;
  name: string;
  memorySlot: number;
  memoryName: string;
  beforeChange: SetlistMidiAction[];
  afterChange: SetlistMidiAction[];
  music?: SetlistSongMusic;
  voiceToneMatch?: SetlistVoiceToneMatch;
}

export interface Setlist {
  id: string;
  name: string;
  updatedAt: string;
  songs: SetlistSong[];
}

export interface SetlistCatalog {
  version: number;
  setlists: Setlist[];
}

export async function executeSetlistSong(
  song: SetlistSong,
  deps: {
    sendControlChange: (action: SetlistMidiAction) => void;
    changeMemory: (slot: number) => Promise<void>;
    wait?: (ms: number) => Promise<void>;
    isCancelled?: () => boolean;
  },
): Promise<boolean> {
  const wait = deps.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const runActions = async (actions: readonly SetlistMidiAction[]) => {
    for (const action of actions) {
      if (deps.isCancelled?.()) return false;
      deps.sendControlChange(action);
      if (action.delayMs > 0) await wait(action.delayMs);
    }
    return !deps.isCancelled?.();
  };
  if (!(await runActions(song.beforeChange))) return false;
  await deps.changeMemory(song.memorySlot);
  if (deps.isCancelled?.()) return false;
  return runActions(song.afterChange);
}

export function clampMemorySlot(value: unknown): number {
  const parsed = Math.round(Number(value));
  return Math.max(1, Math.min(99, Number.isFinite(parsed) ? parsed : 1));
}

function cleanText(value: unknown, fallback: string, max = 80): string {
  if (typeof value !== "string") return fallback;
  return value.trim().replace(/\s+/g, " ").slice(0, max) || fallback;
}

function clampMidiByte(value: unknown): number {
  const parsed = Math.round(Number(value));
  return Math.max(0, Math.min(127, Number.isFinite(parsed) ? parsed : 0));
}

export function normalizeSetlistName(value: unknown): string {
  return cleanText(value, "Untitled setlist", 48);
}

export function newSetlistId(name: string): string {
  const slug =
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) ||
    "setlist";
  return `setlist-${slug}-${Date.now().toString(36)}`;
}

export function newSetlistItemId(prefix = "song"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseSetlistMidiAction(raw: unknown): SetlistMidiAction | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<SetlistMidiAction>;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  return {
    id: item.id.trim().slice(0, 100),
    channel: Math.max(1, Math.min(16, Math.round(Number(item.channel)) || 1)),
    controller: clampMidiByte(item.controller),
    value: clampMidiByte(item.value),
    delayMs: Math.max(0, Math.min(10_000, Math.round(Number(item.delayMs)) || 0)),
  };
}

function parseActions(raw: unknown): SetlistMidiAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const action = parseSetlistMidiAction(item);
    return action ? [action] : [];
  });
}

function parseSongMusic(raw: unknown): SetlistSongMusic | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const music = raw as Record<string, unknown>;
  const key =
    typeof music.key === "string" && /^[A-G](?:#|b)?$/.test(music.key.trim())
      ? music.key.trim()
      : "";
  const mode: SongKeyMode = music.mode === "minor" ? "minor" : "major";
  const transposeValue = Math.round(Number(music.transpose));
  const transpose = Math.max(
    -12,
    Math.min(12, Number.isFinite(transposeValue) ? transposeValue : 0),
  );
  const durationValue = Math.round(Number(music.autoScrollSeconds));
  const autoScrollSeconds =
    Number.isFinite(durationValue) && durationValue >= 15 && durationValue <= 3_600
      ? durationValue
      : undefined;
  const performanceNotes =
    typeof music.performanceNotes === "string"
      ? music.performanceNotes.trim().slice(0, 4_000)
      : "";
  const base = {
    key,
    mode,
    transpose,
    ...(performanceNotes ? { performanceNotes } : {}),
  };

  if (music.kind === "score") {
    const assetId = typeof music.assetId === "string" ? music.assetId.trim().slice(0, 128) : "";
    const fileName = typeof music.fileName === "string" ? music.fileName.trim().slice(0, 240) : "";
    if (!assetId || !fileName) return undefined;
    const byteLength = Math.max(0, Math.min(100_000_000, Math.round(Number(music.byteLength) || 0)));
    const selectedTrackIndexes = Array.isArray(music.selectedTrackIndexes)
      ? [...new Set(music.selectedTrackIndexes.map(Number).filter(
          (index) => Number.isInteger(index) && index >= 0 && index < 256,
        ))]
      : [];
    const mutedTrackIndexes = Array.isArray(music.mutedTrackIndexes)
      ? [...new Set(music.mutedTrackIndexes.map(Number).filter(
          (index) => Number.isInteger(index) && index >= 0 && index < 256,
        ))]
      : [];
    const vocalTrack = Math.round(Number(music.vocalTrackIndex));
    const drumTrack = Math.round(Number(music.drumTrackIndex));
    const alternateGuide = parseSongMusic(music.scrollGuide);
    const scrollGuide =
      alternateGuide?.kind === "scroll" ? alternateGuide : undefined;
    return {
      kind: "score",
      ...base,
      ...(scrollGuide ? { scrollGuide } : {}),
      ...(music.liveView === "scroll" && scrollGuide ? { liveView: "scroll" as const } : {}),
      assetId,
      fileName,
      byteLength,
      selectedTrackIndexes,
      ...(mutedTrackIndexes.length ? { mutedTrackIndexes } : {}),
      ...(Number.isInteger(vocalTrack) && vocalTrack >= 0 && vocalTrack < 256
        ? { vocalTrackIndex: vocalTrack }
        : {}),
      ...(music.rc600Drums === true ? { rc600Drums: true } : {}),
      ...(Number.isInteger(drumTrack) && drumTrack >= 0 && drumTrack < 256
        ? { drumTrackIndex: drumTrack }
        : {}),
      metronome: music.metronome === true,
      countIn: music.countIn === true,
      scoreAudio: music.scoreAudio === true,
      playbackSpeed: Math.max(0.25, Math.min(2, Number(music.playbackSpeed) || 1)),
    };
  }

  const legacyFormat =
    music.kind === "chart" || music.kind === "chords" ? music.kind : undefined;
  const format =
    music.format === "chords" || legacyFormat === "chords" ? "chords" : "chart";
  if (music.kind !== "scroll" && !legacyFormat) return undefined;
  const source =
    typeof music.source === "string"
      ? music.source.replace(/\r\n?/g, "\n").slice(0, MAX_SONG_MUSIC_SOURCE_LENGTH)
      : "";
  return {
    kind: "scroll",
    format,
    source,
    ...base,
    ...(autoScrollSeconds === undefined ? {} : { autoScrollSeconds }),
  };
}

function parseTempoGuide(raw: unknown): SetlistTempoGuide | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const guide = raw as Partial<SetlistTempoGuide>;
  const bpm = Math.max(20, Math.min(300, Math.round(Number(guide.bpm) || 120)));
  const beatsPerBar = Math.max(
    1,
    Math.min(12, Math.round(Number(guide.beatsPerBar) || 4)),
  );
  const beatUnit: 2 | 4 | 8 =
    guide.beatUnit === 2 || guide.beatUnit === 8 ? guide.beatUnit : 4;
  const countInBars = Math.max(
    0,
    Math.min(4, Math.round(Number(guide.countInBars) || 0)),
  );
  const timeline = Array.isArray(guide.timeline)
    ? guide.timeline.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const chord = String((entry as Partial<SetlistTimedChord>).chord ?? "").trim();
        const beats = Number((entry as Partial<SetlistTimedChord>).beats);
        const line = Math.round(Number((entry as Partial<SetlistTimedChord>).line));
        const sectionValue = (entry as Partial<SetlistTimedChord>).section;
        const section =
          typeof sectionValue === "string" && sectionValue.trim()
            ? sectionValue.trim().slice(0, 80)
            : undefined;
        return chord && Number.isFinite(beats) && beats > 0
          ? [{
              chord: chord.slice(0, 32),
              beats: Math.min(256, beats),
              ...(Number.isFinite(line) && line >= 1 ? { line: Math.min(10_000, line) } : {}),
              ...(section ? { section } : {}),
            }]
          : [];
      }).slice(0, 1_000)
    : [];
  return {
    mode: guide.mode === "original" ? "original" : "free",
    bpm,
    beatsPerBar,
    beatUnit,
    countInBars,
    timeline,
  };
}

function parseVoiceToneMatch(raw: unknown, hasConfirmedKey: boolean): SetlistVoiceToneMatch | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const enabled = (raw as Partial<SetlistVoiceToneMatch>).enabled === true && hasConfirmedKey;
  return { enabled };
}

export function parseSetlistSong(raw: unknown): SetlistSong | null {
  if (!raw || typeof raw !== "object") return null;
  const song = raw as Partial<SetlistSong> & {
    presetName?: unknown;
    beforeChange?: unknown;
    afterChange?: unknown;
  };
  if (typeof song.id !== "string" || !song.id.trim()) return null;
  const music = parseSongMusic(song.music);
  const voiceToneMatch = parseVoiceToneMatch(song.voiceToneMatch, Boolean(music?.key));
  return {
    id: song.id.trim().slice(0, 100),
    name: cleanText(song.name ?? song.presetName, "Untitled song"),
    memorySlot: clampMemorySlot(song.memorySlot),
    memoryName: cleanText(song.memoryName, ""),
    beforeChange: parseActions(song.beforeChange),
    afterChange: parseActions(song.afterChange),
    ...(music ? { music } : {}),
    ...(voiceToneMatch ? { voiceToneMatch } : {}),
  };
}

export function parseSetlist(raw: unknown): Setlist | null {
  if (!raw || typeof raw !== "object") return null;
  const setlist = raw as Partial<Setlist> & { songs?: unknown; items?: unknown };
  if (typeof setlist.id !== "string" || !setlist.id.trim()) return null;
  if (typeof setlist.name !== "string") return null;
  const songs: SetlistSong[] = [];
  const seen = new Set<string>();
  const rawSongs = Array.isArray(setlist.songs) ? setlist.songs : setlist.items;
  if (Array.isArray(rawSongs)) {
    for (const rawSong of rawSongs) {
      const song = parseSetlistSong(rawSong);
      if (!song || seen.has(song.id)) continue;
      seen.add(song.id);
      songs.push(song);
    }
  }
  const updatedAt =
    typeof setlist.updatedAt === "string" && Number.isFinite(Date.parse(setlist.updatedAt))
      ? setlist.updatedAt
      : new Date(0).toISOString();
  return {
    id: setlist.id.trim().slice(0, 80),
    name: normalizeSetlistName(setlist.name),
    updatedAt,
    songs,
  };
}

export function parseSetlistCatalog(raw: unknown): Setlist[] {
  if (!raw || typeof raw !== "object") return [];
  const catalog = raw as Partial<SetlistCatalog> & { playlists?: unknown };
  const rawSetlists = Array.isArray(catalog.setlists) ? catalog.setlists : catalog.playlists;
  if (!Array.isArray(rawSetlists)) return [];
  const setlists: Setlist[] = [];
  const seen = new Set<string>();
  for (const rawSetlist of rawSetlists) {
    const setlist = parseSetlist(rawSetlist);
    if (!setlist || seen.has(setlist.id)) continue;
    seen.add(setlist.id);
    setlists.push(setlist);
  }
  return setlists;
}

export function serializeSetlistCatalog(setlists: readonly Setlist[]): SetlistCatalog {
  return {
    version: SETLIST_CATALOG_VERSION,
    setlists: setlists.map((setlist) => ({
      ...setlist,
      songs: setlist.songs.map((song) => ({
        ...song,
        beforeChange: song.beforeChange.map((action) => ({ ...action })),
        afterChange: song.afterChange.map((action) => ({ ...action })),
      })),
    })),
  };
}

export function setlistsToJson(setlists: readonly Setlist[]): string {
  return `${JSON.stringify(serializeSetlistCatalog(setlists), null, 2)}\n`;
}

export function upsertSetlist(list: readonly Setlist[], incoming: Setlist): Setlist[] {
  const next = list.filter((setlist) => setlist.id !== incoming.id);
  next.push(incoming);
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

export function removeSetlist(list: readonly Setlist[], id: string): Setlist[] {
  return list.filter((setlist) => setlist.id !== id);
}

export function reorderSetlistSong(
  songs: readonly SetlistSong[],
  itemId: string,
  direction: -1 | 1,
): SetlistSong[] {
  const next = [...songs];
  const index = next.findIndex((item) => item.id === itemId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
