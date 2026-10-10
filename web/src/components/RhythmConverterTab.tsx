import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  DEFAULT_CONVERT_OPTIONS,
  PART_FILE_NAMES,
  QUANTIZE_OPTIONS,
  buildPartEvents,
  meterMismatches,
  resolveParts,
  songSlug,
  type PartEvents,
  type PartOverrides,
  type ConvertOptions,
  type FillLength,
  type QuantizeGrid,
} from "../rhythmConverter/exportPack";
import {
  MAX_USER_PATTERNS,
  PATTERN_NAME_MAX,
  RHYTHM_RC0_PATH,
  mergeRecordsByName,
  patternMeter,
  sanitizePatternName,
  upsertRecord,
  type SlotRecord,
} from "../rhythmConverter/rhythmRc0";
import {
  autoMapPlans,
  buildMidiPack,
  classifySelection,
  encodeRhythms,
  guessKit,
  readRhythmFile,
  renameSlot as renameSlotRecord,
  suggestPlan,
  writeRhythmFile,
  type AutoMapOption,
  type GrooveGuess,
  type KitSuggestion,
} from "../rhythmConverter/rhythmApi";
import {
  PART_KIND_LABELS,
  defaultRoleForKind,
  eventsFromLibraryPart,
  libraryPartFromEvents,
  libraryTags,
  normalizeTag,
  normalizeTags,
  partKindForRole,
  type LibraryPart,
} from "../rhythmConverter/partLibrary";
import { LibraryDraftForm, RhythmLibraryPanel, type LibraryDraft } from "./RhythmLibraryPanel";
import { Modal } from "./Modal";
import { browserPartLibrary } from "../rhythmConverter/partLibraryRepository";
import { browserRhythmLibrary } from "../rhythmConverter/rhythmLibraryRepository";
import {
  libraryPartsFromRhythm,
  partsFromRhythm,
  rhythmsFromSlots,
  rhythmFromParts,
  type LibraryRhythm,
} from "../rhythmConverter/rhythmLibrary";
import {
  PedalImportForm,
  RhythmDraftForm,
  RhythmPresetLibrary,
  type PedalImport,
  type RhythmDraft,
} from "./RhythmPresetLibrary";
import { RhythmPartPicker } from "./RhythmPartPicker";
import { RhythmSlotManager, type SlotInfo } from "./RhythmSlotManager";
import { loadOfflineSlots, saveOfflineSlots, type OfflineSlots } from "../rhythmConverter/slotStore";
import {
  DEFAULT_PLAYER_PREFS,
  PLAYER_TEMPO_MAX,
  PLAYER_TEMPO_MIN,
  RhythmPlayerBar,
  type PlayerPrefs,
} from "./RhythmPlayerBar";
import { RHYTHM_KITS } from "@rc600/catalog/params";
import { readBinaryFromDirectory, writeFileToDirectory, type DirectoryHandleLike } from "@rc600/files/roland";
import { extractMidiDrumScore, isMidiFile, parseMidiFile, type MidiSource } from "../rhythmConverter/midiDrumScore";
import {
  DRUM_SOUNDS,
  loadDrumVoice,
  partPlayback,
  rhythmPlayback,
  rhythmSequence,
  segmentAt,
  songPlayback,
  startPlayback,
  type AudioVoice,
  type DrumSoundId,
} from "../rhythmConverter/previewPlayer";
import {
  SCORE_FILE_ACCEPT,
  dominantMeter,
  extractDrumScore,
  loadAlphaTab,
  loadScoreBytes,
  meterLabel,
  type DrumScore,
  type PlayedBar,
} from "../rhythmConverter/scoreDrumEvents";
import {
  FILL_ROLES,
  PART_LABELS,
  PART_ROLES,
  VARIATION_ROLES,
  PART_SHORT,
  partLength,
  roleAtBar,
  barRepeats,
  sectionSegments,
  type Confidence,
  type PartPlan,
  type PartRole,
} from "../rhythmConverter/sectionSuggest";
import { emptyPart, type EditGrid } from "../rhythmConverter/partEdit";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { BarThumb, RhythmPartEditor, type EditorView } from "./RhythmPartEditor";

const OPTIONS_KEY = "rc600.rhythmConverter.options";
const EDITOR_KEY = "rc600.rhythmConverter.editor";

/** A part that replaces the song bars: picked from the library or edited by hand. */
interface PartOverride {
  events: PartEvents;
  source: "library" | "edited";
  /** Library part name (also kept after editing it). */
  name: string;
  /** What Revert restores; null goes back to the song bars. */
  revertTo: PartOverride | null;
}

type Overrides = Partial<Record<PartRole, PartOverride>>;

interface Snapshot {
  plan: PartPlan;
  overrides: Overrides;
}

const HISTORY_LIMIT = 100;

type BarLayout = "sections" | "4" | "8" | "16";

const BAR_LAYOUTS: { value: BarLayout; label: string }[] = [
  { value: "sections", label: "By Section" },
  { value: "4", label: "4 per Row" },
  { value: "8", label: "8 per Row" },
  { value: "16", label: "16 per Row" },
];

interface EditorPrefs {
  view: EditorView;
  grid: EditGrid;
  velocity: number;
  barLayout: BarLayout;
  /** Bars without drum hits are hidden from the strip unless this is on. */
  showEmptyBars: boolean;
  /** Off: only the first of identical bars is shown on the strip. */
  showRepeatedBars: boolean;
  /** Settings panels (Options, RC-600 Rhythm) the user folded away. */
  foldedSettings: SettingsPanel[];
}

type SettingsPanel = "options" | "rhythm" | "bars";

const PLAYER_KEY = "rc600.rhythmConverter.player";

function loadPlayerPrefs(): PlayerPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_PLAYER_PREFS;
  try {
    const raw = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? "{}") as Partial<PlayerPrefs>;
    return {
      skip: Array.isArray(raw.skip)
        ? raw.skip.filter((r): r is PartRole => (PART_ROLES as readonly string[]).includes(r))
        : [],
      repeats: Math.min(8, Math.max(1, Math.round(Number(raw.repeats) || DEFAULT_PLAYER_PREFS.repeats))),
      loop: typeof raw.loop === "boolean" ? raw.loop : DEFAULT_PLAYER_PREFS.loop,
      tempo: null,
    };
  } catch {
    return DEFAULT_PLAYER_PREFS;
  }
}

function loadEditorPrefs(): EditorPrefs {
  const fallback: EditorPrefs = {
    view: "instruments",
    grid: "1/16",
    velocity: 96,
    barLayout: "sections",
    showEmptyBars: false,
    showRepeatedBars: false,
    foldedSettings: [],
  };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = JSON.parse(localStorage.getItem(EDITOR_KEY) ?? "{}") as Partial<EditorPrefs>;
    return {
      ...fallback,
      ...raw,
      foldedSettings: Array.isArray(raw.foldedSettings)
        ? raw.foldedSettings.filter((p): p is SettingsPanel => p === "options" || p === "rhythm" || p === "bars")
        : [],
    };
  } catch {
    return fallback;
  }
}

const ROLE_ICON: Record<PartRole, IconName> = {
  intro: "intro",
  varA: "variationA",
  varB: "variationB",
  varC: "variationC",
  varD: "variationD",
  fillA: "fill",
  fillB: "fill",
  fillC: "fill",
  fillD: "fill",
  ending: "ending",
};

const ROLE_COLOR: Record<PartRole, string> = {
  intro: "#7c8cff",
  varA: "#3ecf8e",
  varB: "#00c7fd",
  varC: "#e0a84a",
  varD: "#e05ad0",
  fillA: "#2a9466",
  fillB: "#0a8fb5",
  fillC: "#a8782f",
  fillD: "#a33e97",
  ending: "#e05a5a",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Sure",
  medium: "Likely",
  low: "Guess",
  manual: "Set by you",
};

const PREPARE_TEXT =
  "Use one drum track with the standard Guitar Pro drum kit. Add Section markers named Intro, Verse, Chorus, Bridge, Fill, Outro or Ending (Portuguese names such as Refrão, Ponte and Virada also work): they drive the automatic split. Keep one time signature, because an RC-600 rhythm has a single Beat. Repeats and alternate endings are expanded, and ghost notes, accents and dynamics become velocity. MIDI files: put the drums on channel 10 with General MIDI drum notes; each track and channel can be picked separately, and Marker events act as section names. MIDI repeats are already written out.";

const TIMELINE_TEXT =
  "Each block is one bar of the song, in playback order with repeats written out; each row is a section (from its markers) or a fixed 4, 8 or 16 bars, picked with the Sections / 4 / 8 / 16 buttons. The small picture shows what plays: cymbals, hi-hats, toms, snare and kick from top to bottom, and the colored band shows which part of this rhythm already uses the bar. Click a bar or drag across bars to select them (for example bars 4 to 8); Shift+click stretches the selection, or type First Bar and Last Bar. Then Play the selection, Save to Library with a category (Intro, Variation, Fill, Ending) and tags, or Use As to put it straight into a part of this rhythm. Variations loop, so 1, 2, 4 or 8 bars work best; a fill is usually the last bar before the next section. Undo and Redo (Ctrl+Z, Ctrl+Shift+Z) step through part changes.";

const IMPORT_TEXT =
  "The ZIP has one Standard MIDI File per part (format 0, channel 10, General MIDI drum notes) and a README. Use it when you prefer BOSS RC Rhythm Converter: open each file, place it in the matching slot (Intro, Variation A–D, Fill, Ending) and transfer the pattern to the pedal.";

const TRACKS_TEXT =
  "Only drum tracks are listed (MIDI channel 10, Guitar Pro percussion tracks, or tracks named Drums / Percussion); melody, bass and other instruments are hidden because the RC-600 rhythm plays drum sounds only. When a file opens, every drum track with notes is turned on and merged. Click tracks to turn them off or on again, for example a drum kit track plus a percussion track, or kick, snare and cymbals written on separate tracks. Notes that land on the same step and drum sound are kept once. At least one track stays selected. Changing tracks suggests the parts again.";

const PLAYBACK_TEXT =
  "Play Song plays the selected drum track from the chosen bar to the end, as written in the file (no quantize), and follows it on the bar strip. Sound picks the drums: RC-600 Kit Preview plays a browser model of the RC-600 kit picked in Kit (Studio, Rock, Jazz, Cajon, 808+909…), built from sampled and synthesized drums with each kit's tuning, punch and room, so you hear roughly how the rhythm will sound on the pedal; it is an approximation, not the pedal's own samples. Standard, Room, Jazz and Brush are sampled General MIDI kits; Basic and Electronic Synth are generated in the browser. RC-600 Kit (MIDI) plays the pedal's own kit over MIDI (STORAGE must be OFF) and switches it to the Kit chosen under RC-600 Rhythm when the current memory has a Rhythm Kit assign on a MIDI CC.";

const SAVE_TEXT =
  "Save to Slot puts the rhythm in the builder into ROLAND/DATA/RHYTHM.RC0, the same file BOSS RC Rhythm Converter writes, in the slot picked under Slot (or in RC-600 Slots below). With the RC-600 drive open (USB storage mode) it is written to the pedal at once; eject the drive and the rhythm appears under Rhythm → Genre: User. Without the pedal it goes into the offline slot list; Download RHYTHM.RC0 there when you are done and copy it to ROLAND/DATA. Other user rhythms in the file are kept. Unset variations reuse Variation A, unset fills use the last bar of their variation, and fills longer than one bar keep only their last bar. To send several rhythms at once, tick them in the Rhythm Library.";

const NEW_SLOT = -1;
const DRIVE_ORIGIN = "RC-600 drive";

const partLibrary = browserPartLibrary();

const WAND_TEXT =
  "The Magic Wand reads the whole song and fills every RC-600 part at once. It groups bars that play the same groove (the drums on the same 1/16 steps), counts how often each groove plays, and treats the most played grooves as Variations. Bars that break a groove, busy with toms and snare and usually right before a new section, become that Variation's Fill. Bars before the first groove are the Intro and bars after the last groove are the Ending (section markers such as Intro and Outro are used when the file has them). Songs usually have one Intro and one Ending but several grooves and fills, so it builds up to 8 arrangements: more or fewer Variations, in song order or by how often they play, shorter or longer loops, another fill, a shorter Intro or Ending. 1 is the best match; click another number to try it, and Undo goes back. It replaces the parts set by hand or from the library.";

const PARTS_TEXT =
  "A rhythm has up to ten parts: Intro, Variation A–D, Fill A–D and Ending. Fill each one from the song bars (select bars, then Use As) or with its Library button, which shows only parts of the same category (Intro, Variation, Fill or Ending). You can build a whole rhythm from library parts without opening a file. Play loops a part exactly as it will be saved, with the Sound picked above the bars; the save button stores a part in the library, and the trash button clears it.";

const LIBRARY_TEXT =
  partLibrary.saveTarget() === "native"
    ? "Reusable parts for building rhythms, each with a category (Intro, Variation, Fill, Ending) and tags for style and feel. Development build: parts you save go to the factory library file (web/public/rhythm-converter/parts.json) through the editor API, so every user gets them. Filter by category, tags or name, play a part, and Use As to place it in this rhythm; then edit it under Edit like any other part. Works without opening a file."
    : "Reusable parts for building rhythms, each with a category (Intro, Variation, Fill, Ending) and tags for style and feel. Factory parts come with the editor; parts you save stay in this browser on this computer, and Export / Import move them to another computer. Filter by category, tags or name, play a part, and Use As to place it in this rhythm; then edit it under Edit like any other part. Works without opening a file.";

const rhythmLibrary = browserRhythmLibrary();

const RHYTHM_LIBRARY_TEXT =
  rhythmLibrary.saveTarget() === "native"
    ? "Ready-made rhythms: every part (Intro, Variations, Fills, Ending) plus Kit, saved together. Load puts the whole rhythm in the builder, where you can still change or edit any part. Development build: rhythms you save go to the factory file (web/public/rhythm-converter/rhythms.json) through the editor API, so every user gets them."
    : "Ready-made rhythms: every part (Intro, Variations, Fills, Ending) plus Kit, saved together. Load puts the whole rhythm in the builder, where you can still change or edit any part. Factory rhythms come with the editor; rhythms you save stay in this browser, and Export / Import move them to another computer.";

function loadOptions(): ConvertOptions {
  if (typeof localStorage === "undefined") return DEFAULT_CONVERT_OPTIONS;
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    return raw
      ? {
          ...DEFAULT_CONVERT_OPTIONS,
          ...(JSON.parse(raw) as Partial<ConvertOptions>),
        }
      : DEFAULT_CONVERT_OPTIONS;
  } catch {
    return DEFAULT_CONVERT_OPTIONS;
  }
}

const SOUND_KEY = "rc600.rhythmConverter.sound";

function loadSound(): DrumSoundId {
  if (typeof localStorage === "undefined") return "rc-model";
  const raw = localStorage.getItem(SOUND_KEY);
  return DRUM_SOUNDS.some((s) => s.id === raw) ? (raw as DrumSoundId) : "rc-model";
}

function barRangeText(start: number, end: number): string {
  return end - start === 1 ? `Bar ${start + 1}` : `Bars ${start + 1}–${end}`;
}

function downloadBytes(bytes: Uint8Array, fileName: string, type = "application/zip"): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RhythmConverterTab({
  active = true,
  midiLive,
  onPlayNotes,
  onSilence,
  onRequestMidi,
  onSelectPedalKit,
  dirHandle,
  writeBlockedReason,
  onUnsavedChange,
  onConnectUsb,
  onBackupDone,
}: {
  /** Opens the editor's USB Storage connect dialog. */
  onConnectUsb?: () => void;
  /** Set while saving is blocked only because the backup was not confirmed. */
  onBackupDone?: () => void;
  /** Called with a sentence describing what is not saved yet, or null when everything is saved. */
  onUnsavedChange?: (pending: string | null) => void;
  /** False while the converter is hidden; playback stops. */
  active?: boolean;
  midiLive: boolean;
  onPlayNotes: (notes: readonly number[], velocity: number, down: boolean) => void;
  onSilence?: () => void;
  onRequestMidi?: () => void;
  /** Switches the RC-600 rhythm kit over MIDI (needs a Rhythm Kit assign on the memory). */
  onSelectPedalKit?: (kit: number) => void;
  /** Opened ROLAND folder; null when the RC-600 drive is not open. */
  dirHandle: DirectoryHandleLike | null;
  writeBlockedReason: string | null;
}) {
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<DrumScore | null>(null);
  const [plan, setPlan] = useState<PartPlan>({});
  const [selectedRole, setSelectedRole] = useState<PartRole>("varA");
  /** Part open in the editor modal. */
  const [editorRole, setEditorRole] = useState<PartRole | null>(null);
  const [options, setOptions] = useState<ConvertOptions>(loadOptions);
  const [previewRole, setPreviewRole] = useState<PartRole | null>(null);
  const [sound, setSound] = useState<DrumSoundId>(loadSound);
  const [soundLoading, setSoundLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [songFrom, setSongFrom] = useState<number | null>(null);
  const [songBar, setSongBar] = useState<number | null>(null);
  const [startBar, setStartBar] = useState(0);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [wandOptions, setWandOptions] = useState<AutoMapOption[] | null>(null);
  const [wandBusy, setWandBusy] = useState(false);
  const wandIndex = useMemo(() => {
    const i = wandOptions?.findIndex((o) => o.plan === plan) ?? -1;
    return i >= 0 && !Object.keys(overrides).length ? i : null;
  }, [wandOptions, plan, overrides]);
  /** Parts as they were last saved or loaded; any other plan/overrides counts as unsaved work. */
  const [savedParts, setSavedParts] = useState<{ plan: PartPlan; overrides: Overrides } | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [editorPrefs, setEditorPrefs] = useState<EditorPrefs>(loadEditorPrefs);
  const panelOpen = (panel: SettingsPanel) => !editorPrefs.foldedSettings.includes(panel);
  const togglePanel = (panel: SettingsPanel) =>
    setEditorPrefs((prev) => ({
      ...prev,
      foldedSettings: prev.foldedSettings.includes(panel)
        ? prev.foldedSettings.filter((p) => p !== panel)
        : [...prev.foldedSettings, panel],
    }));
  const [library, setLibrary] = useState<{
    native: LibraryPart[];
    user: LibraryPart[];
  }>({ native: [], user: [] });
  const [libraryDraft, setLibraryDraft] = useState<LibraryDraft | null>(null);
  /** Open library picker; `role` limits it to that part's category. */
  const [libraryModal, setLibraryModal] = useState<{
    role: PartRole | null;
  } | null>(null);
  /** Bars picked on the strip: [first, end) in playback order. */
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [previewSelection, setPreviewSelection] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  /** Last library save, shown next to where the save started. */
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);

  useEffect(() => {
    setLibraryError(null);
    if (libraryDraft) setLibraryNotice(null);
  }, [libraryDraft?.from]);

  useEffect(() => {
    if (!libraryNotice) return;
    const t = window.setTimeout(() => setLibraryNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [libraryNotice]);
  const [libraryPreviewId, setLibraryPreviewId] = useState<string | null>(null);
  const libraryImportRef = useRef<HTMLInputElement>(null);
  const [rhythms, setRhythms] = useState<{
    native: LibraryRhythm[];
    user: LibraryRhythm[];
  }>({ native: [], user: [] });
  const [rhythmModal, setRhythmModal] = useState(false);
  const [rhythmDraft, setRhythmDraft] = useState<RhythmDraft | null>(null);
  const [rhythmError, setRhythmError] = useState<string | null>(null);
  const [rhythmPreviewId, setRhythmPreviewId] = useState<string | null>(null);
  const rhythmImportRef = useRef<HTMLInputElement>(null);
  const [pedalImport, setPedalImport] = useState<PedalImport | null>(null);
  const pedalFileRef = useRef<HTMLInputElement>(null);
  const [player, setPlayer] = useState<PlayerPrefs>(loadPlayerPrefs);
  const [rhythmPlaying, setRhythmPlaying] = useState(false);
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [patternName, setPatternName] = useState("");
  const [kit, setKit] = useState(0);
  /** Follow the suggested kit until the user picks one or loads a saved rhythm. */
  const [kitAuto, setKitAuto] = useState(false);
  const [slot, setSlot] = useState(NEW_SLOT);
  /** Working copy of RHYTHM.RC0: read from the open drive, or an offline list kept in the browser. */
  /** With the drive open: the offline list kept in this browser, ready to send to the pedal. */
  const [offlineCopy, setOfflineCopy] = useState<OfflineSlots | null>(null);
  const [slotList, setSlotList] = useState<OfflineSlots | null>(null);
  const [saving, setSaving] = useState(false);
  const slotFileRef = useRef<HTMLInputElement>(null);

  const sourceRef = useRef<
    | {
        kind: "score";
        at: Awaited<ReturnType<typeof loadAlphaTab>>;
        score: unknown;
      }
    | { kind: "midi"; midi: MidiSource }
    | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragAnchorRef = useRef<number | null>(null);
  const dragRangeRef = useRef<[number, number] | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onPlayNotes, onSilence, onSelectPedalKit });
  callbacksRef.current = { onPlayNotes, onSilence, onSelectPedalKit };

  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
      localStorage.setItem(SOUND_KEY, sound);
      localStorage.setItem(EDITOR_KEY, JSON.stringify(editorPrefs));
      localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
    } catch {
      /* quota / private mode */
    }
  }, [options, sound, editorPrefs, player]);

  const meter = useMemo(() => (score ? dominantMeter(score.bars) : null), [score]);
  const fixedRow = editorPrefs.barLayout === "sections" ? 0 : Number(editorPrefs.barLayout);
  const showEmptyBars = editorPrefs.showEmptyBars;
  const hideRepeatedBars = !editorPrefs.showRepeatedBars;
  const repeats = useMemo(
    () => (score ? barRepeats(score.bars, score.ppq) : { firstOf: [], count: new Map<number, number>() }),
    [score],
  );
  const repeatedBarCount = useMemo(
    () => repeats.firstOf.filter((first, i) => first !== i && (score?.bars[i]?.hits.length ?? 0) > 0).length,
    [repeats, score],
  );
  const emptyBarCount = useMemo(() => score?.bars.filter((b) => !b.hits.length).length ?? 0, [score]);
  const barRows = useMemo(() => {
    if (!score) return [];
    const visible = (b: PlayedBar) =>
      (showEmptyBars || b.hits.length > 0) && (!hideRepeatedBars || repeats.firstOf[b.index] === b.index);
    if (!fixedRow) {
      return sectionSegments(score.bars)
        .map(({ label, start, end }) => ({
          label,
          start,
          end,
          bars: score.bars.slice(start, end).filter(visible),
        }))
        .filter((row) => row.bars.length);
    }
    const shown = score.bars.filter(visible);
    const rows: {
      label: string | null;
      start: number;
      end: number;
      bars: PlayedBar[];
    }[] = [];
    for (let i = 0; i < shown.length; i += fixedRow) {
      const bars = shown.slice(i, i + fixedRow);
      const named = bars.find((b) => b.section);
      rows.push({
        label: named?.section ?? null,
        start: bars[0]!.index,
        end: bars.at(-1)!.index + 1,
        bars,
      });
    }
    return rows;
  }, [score, fixedRow, showEmptyBars, hideRepeatedBars, repeats]);
  const visibleBarCount = barRows.reduce((n, row) => n + row.bars.length, 0);
  const mismatched = useMemo(() => (score ? meterMismatches(score, plan, meter) : []), [score, plan, meter]);
  const onPedal = sound === "rc600";
  const useMidiPreview = onPedal && midiLive;
  const pedalKit = useMidiPreview ? kit : -1;
  /** RC-600 kit modelled in the browser (also the fallback when MIDI is not connected). */
  const modelKit = sound === "rc-model" || (onPedal && !midiLive) ? kit : -1;

  const overrideEvents = useMemo(() => {
    const out: PartOverrides = {};
    for (const [role, own] of Object.entries(overrides) as [PartRole, PartOverride][]) {
      const origin =
        own.source === "library" ? `library "${own.name}"` : own.name ? `edited from library "${own.name}"` : "edited";
      out[role] = { ...own.events, role, origin };
    }
    return out;
  }, [overrides]);
  const resolved = useMemo(
    () => resolveParts(score, plan, options, overrideEvents),
    [score, plan, options, overrideEvents],
  );
  const resolvedByRole = useMemo(() => new Map(resolved.map((p) => [p.role, p])), [resolved]);
  const partsUnsaved = resolved.length > 0 && (savedParts?.plan !== plan || savedParts?.overrides !== overrides);
  const offlineUnsaved = !dirHandle && Boolean(slotList?.dirty);
  const unsavedText =
    [
      partsUnsaved ? "The rhythm parts are not saved to a slot or the Rhythm Library." : null,
      offlineUnsaved ? "The offline slot list has changes that were not downloaded as RHYTHM.RC0." : null,
    ]
      .filter(Boolean)
      .join(" ") || null;
  const onUnsavedRef = useRef(onUnsavedChange);
  onUnsavedRef.current = onUnsavedChange;
  useEffect(() => {
    onUnsavedRef.current?.(unsavedText);
  }, [unsavedText]);
  const libraryMismatch = useMemo(() => {
    if (!resolved.length) return [];
    const [n, d] = patternMeter(resolved);
    return resolved.filter((p) => overrides[p.role] && (p.numerator !== n || p.denominator !== d));
  }, [resolved, overrides]);
  const libraryAll = useMemo(() => [...library.native, ...library.user], [library]);
  const knownTags = useMemo(() => libraryTags(libraryAll), [libraryAll]);
  const [selectionGuess, setSelectionGuess] = useState<GrooveGuess | null>(null);
  useEffect(() => {
    setSelectionGuess(null);
    if (!score || !selection) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      classifySelection(score.bars, selection[0], selection[1], score.ppq, ctrl.signal).then(
        setSelectionGuess,
        () => undefined,
      );
    }, 150);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [score, selection]);
  const kitRangesKey = VARIATION_ROLES.map((r) => (plan[r] ? `${plan[r].start}-${plan[r].end}` : "")).join(",");
  const [kitGuess, setKitGuess] = useState<KitSuggestion | null>(null);
  useEffect(() => {
    if (!score) {
      setKitGuess(null);
      return;
    }
    const ranges = kitRangesKey
      .split(",")
      .filter(Boolean)
      .map((r) => r.split("-").map(Number) as [number, number]);
    const bars = ranges.length ? ranges.flatMap(([s, e]) => score.bars.slice(s, e)) : score.bars;
    const ctrl = new AbortController();
    guessKit(bars, score.ppq, ctrl.signal).then(setKitGuess, () => undefined);
    return () => ctrl.abort();
  }, [score, kitRangesKey]);
  useEffect(() => {
    if (kitAuto && kitGuess) setKit(kitGuess.kit);
  }, [kitAuto, kitGuess]);
  const suggestedRole = useMemo((): PartRole | null => {
    if (!selectionGuess) return null;
    const firstFree = (roles: readonly PartRole[]) => roles.find((r) => !resolvedByRole.has(r)) ?? roles[0]!;
    switch (selectionGuess.kind) {
      case "intro":
        return "intro";
      case "ending":
        return "ending";
      case "variation":
        return selectedRole.startsWith("var") ? selectedRole : firstFree(VARIATION_ROLES);
      default:
        if (selectedRole.startsWith("fill")) return selectedRole;
        if (selectedRole.startsWith("var")) return `fill${selectedRole.slice(3)}` as PartRole;
        return firstFree(FILL_ROLES);
    }
  }, [selectionGuess, selectedRole, resolvedByRole]);
  const selectionEvents = useMemo(() => {
    if (!score || !selection) return null;
    const [start, end] = selection;
    return buildPartEvents(
      score,
      { varA: { role: "varA", start, end, confidence: "manual", reason: "" } },
      "varA",
      options,
    );
  }, [score, selection, options]);

  const selectionPb = useMemo(
    () => (previewSelection && selectionEvents?.notes.length ? partPlayback(selectionEvents) : null),
    [previewSelection, selectionEvents],
  );
  const partPb = useMemo(() => {
    const part = previewRole ? resolvedByRole.get(previewRole) : undefined;
    return part && part.notes.length ? partPlayback(part) : null;
  }, [previewRole, resolvedByRole]);
  const libraryPb = useMemo(() => {
    const part = libraryAll.find((p) => p.id === libraryPreviewId);
    return part && part.notes.length ? partPlayback(eventsFromLibraryPart(part, "varA")) : null;
  }, [libraryAll, libraryPreviewId]);
  const rhythmAll = useMemo(() => [...rhythms.native, ...rhythms.user], [rhythms]);
  const pedalNames = useMemo(() => (slotList ? slotList.records.map((r) => r.name) : null), [slotList]);
  const slotRhythms = useMemo(() => {
    const out = new Map<number, LibraryRhythm>();
    if (slotList?.records.length) {
      for (const p of rhythmsFromSlots(slotList.records)) {
        out.set(p.slot, { ...p.rhythm, id: `slot:${p.slot}:${p.rhythm.name}` });
      }
    }
    return out;
  }, [slotList]);
  const slotInfos = useMemo(
    (): SlotInfo[] | null =>
      slotList
        ? slotList.records.map((p, i) => ({
            name: p.name,
            kit: p.kit,
            tempo: p.tempo,
            meter: `${p.numerator}/${p.denominator}`,
            bars: p.totalBars,
            previewId: slotRhythms.get(i)?.id ?? null,
          }))
        : null,
    [slotList, slotRhythms],
  );
  const rhythmPb = useMemo(() => {
    const r =
      rhythmAll.find((x) => x.id === rhythmPreviewId) ??
      [...slotRhythms.values()].find((x) => x.id === rhythmPreviewId);
    if (!r) return null;
    const parts = partsFromRhythm(r);
    const part = parts.find((p) => p.role === "varA") ?? parts[0];
    return part && part.notes.length ? partPlayback(part) : null;
  }, [rhythmAll, slotRhythms, rhythmPreviewId]);
  const rhythmTempo = Math.round(resolvedByRole.get("varA")?.tempoBpm ?? resolved[0]?.tempoBpm ?? 120);
  const playerTempo = Math.min(PLAYER_TEMPO_MAX, Math.max(PLAYER_TEMPO_MIN, player.tempo ?? rhythmTempo));
  const sequencePb = useMemo(() => {
    if (!rhythmPlaying) return null;
    const picked = PART_ROLES.filter((r) => resolvedByRole.has(r) && !player.skip.includes(r));
    return rhythmPlayback(resolved, rhythmSequence(picked, player.repeats), {
      tempoBpm: playerTempo,
      loop: player.loop,
    });
  }, [rhythmPlaying, resolved, resolvedByRole, player.skip, player.repeats, player.loop, playerTempo]);
  const songPb = useMemo(() => (score && songFrom != null ? songPlayback(score, songFrom) : null), [score, songFrom]);
  const activePb = rhythmPlaying
    ? sequencePb
    : previewSelection
      ? selectionPb
      : previewRole
        ? partPb
        : libraryPreviewId
          ? libraryPb
          : rhythmPreviewId
            ? rhythmPb
            : songPb;
  const activePbRef = useRef(activePb);
  activePbRef.current = activePb;
  /** Restarts playback only when what plays changes, not when the playing part is edited. */
  const playKey = !activePb
    ? null
    : rhythmPlaying
      ? "sequence"
      : previewSelection
        ? `selection:${selection?.join("-")}`
        : previewRole
          ? `part:${previewRole}`
          : libraryPreviewId
            ? `library:${libraryPreviewId}`
            : rhythmPreviewId
              ? `rhythm:${rhythmPreviewId}`
              : `song:${songFrom}`;

  function stopPlayback() {
    setRhythmPlaying(false);
    setPreviewRole(null);
    setLibraryPreviewId(null);
    setRhythmPreviewId(null);
    setPreviewSelection(false);
    setSongFrom(null);
    setSongBar(null);
  }

  useEffect(() => {
    if (!active) stopPlayback();
  }, [active]);

  useEffect(() => {
    if (rhythmPlaying && !sequencePb) setRhythmPlaying(false);
  }, [rhythmPlaying, sequencePb]);

  const sequenceNow = rhythmPlaying && sequencePb ? segmentAt(sequencePb, progress * sequencePb.lengthMs) : null;
  /** Editor playhead (0–1 of the part): its own loop, or the rhythm player while it plays this part. */
  const editorPlayhead = (() => {
    if (previewRole === selectedRole) return progress;
    if (sequenceNow?.segment.role !== selectedRole) return null;
    const bars = resolvedByRole.get(selectedRole)?.bars ?? 1;
    return selectedRole.startsWith("fill") && bars > 1 ? (bars - 1 + sequenceNow.within) / bars : sequenceNow.within;
  })();

  function toggleRhythm() {
    const wasPlaying = rhythmPlaying;
    stopPlayback();
    setRhythmPlaying(!wasPlaying);
  }

  useEffect(() => {
    if (previewSelection && !selectionPb) setPreviewSelection(false);
  }, [previewSelection, selectionPb]);

  useEffect(() => {
    if (previewRole && !partPb) setPreviewRole(null);
  }, [previewRole, partPb]);

  useEffect(() => {
    if (libraryPreviewId && !libraryPb) setLibraryPreviewId(null);
  }, [libraryPreviewId, libraryPb]);

  const reloadLibrary = useCallback(async () => {
    try {
      setLibrary(await partLibrary.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the part library.");
    }
  }, []);

  useEffect(() => {
    void reloadLibrary();
  }, [reloadLibrary]);

  useEffect(() => {
    if (rhythmPreviewId && !rhythmPb) setRhythmPreviewId(null);
  }, [rhythmPreviewId, rhythmPb]);

  const reloadRhythms = useCallback(async () => {
    try {
      setRhythms(await rhythmLibrary.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the rhythm library.");
    }
  }, []);

  useEffect(() => {
    void reloadRhythms();
  }, [reloadRhythms]);

  useEffect(() => {
    if (!playKey || !activePbRef.current) return;
    let latest = activePbRef.current;
    const current = () => {
      if (activePbRef.current) latest = activePbRef.current;
      return latest;
    };
    let cancelled = false;
    let stop: (() => void) | null = null;
    const begin = (voice: AudioVoice | null) => {
      if (cancelled) return;
      stop = startPlayback(current, {
        voice,
        midi:
          pedalKit >= 0
            ? (note, velocity, down) => callbacksRef.current.onPlayNotes([note], velocity, down)
            : undefined,
        onPosition: (ms) => {
          const pb = current();
          if (pb.loop || pb.segments) {
            setProgress(Math.min(1, ms / pb.lengthMs));
            return;
          }
          const starts = pb.barStartsMs ?? [];
          let i = 0;
          while (i + 1 < starts.length && starts[i + 1]! <= ms) i++;
          setSongBar((pb.firstBar ?? 0) + i);
        },
        onEnd: () => {
          setRhythmPlaying(false);
          setSongFrom(null);
          setSongBar(null);
        },
      });
    };
    if (pedalKit >= 0) {
      callbacksRef.current.onSelectPedalKit?.(pedalKit);
      begin(null);
    } else {
      setSoundLoading(true);
      loadDrumVoice(modelKit >= 0 ? "rc-model" : sound, modelKit)
        .then(begin)
        .catch((cause) => {
          if (cancelled) return;
          setError(cause instanceof Error ? cause.message : "Could not load the drum sounds.");
          stopPlayback();
        })
        .finally(() => setSoundLoading(false));
    }
    return () => {
      cancelled = true;
      stop?.();
      setProgress(0);
      if (pedalKit >= 0) callbacksRef.current.onSilence?.();
    };
  }, [playKey, sound, pedalKit, modelKit]);

  useEffect(() => {
    if (songBar == null) return;
    timelineRef.current
      ?.querySelector<HTMLElement>(`[data-bar="${songBar}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [songBar]);

  function playPart(role: PartRole | null) {
    stopPlayback();
    setPreviewRole(role);
  }

  function playLibraryPart(id: string | null) {
    stopPlayback();
    setLibraryPreviewId(id);
  }

  function playSelection(on: boolean) {
    stopPlayback();
    setPreviewSelection(on);
  }

  function assignSelection(role: PartRole) {
    if (!selection) return;
    setPart(role, selection[0], selection[1]);
    setSelectedRole(role);
    setStatus(`${PART_LABELS[role]} now uses ${barRangeText(selection[0], selection[1]).toLowerCase()}.`);
  }

  function partStatus(role: PartRole): string {
    const own = overrides[role];
    if (own) return own.source === "library" ? `Library: ${own.name}` : "Edited";
    const range = score ? plan[role] : undefined;
    return range ? barRangeText(range.start, range.end) : "Not set";
  }

  function startSelectionSave() {
    if (!selection) return;
    const kind = selectionGuess?.kind ?? partKindForRole(selectedRole);
    const base = patternName || score?.title || "Part";
    setLibraryDraft({
      from: { kind: "selection", start: selection[0], end: selection[1] },
      name: `${base} ${barRangeText(selection[0], selection[1])}`,
      kind,
      tags: selectionGuess?.tags ?? [],
    });
  }

  function openLibrary(role: PartRole | null) {
    if (role) setSelectedRole(role);
    setLibraryModal({ role });
  }

  function closeLibrary() {
    setLibraryModal(null);
    setLibraryPreviewId(null);
    setLibraryDraft((d) => (d?.from.kind === "existing" ? null : d));
  }

  function requestCloseLibrary() {
    if (
      libraryDraft?.from.kind === "existing" &&
      !window.confirm(`The changes to "${libraryDraft.from.part.name}" are not saved. Close the Part Library anyway?`)
    )
      return;
    closeLibrary();
  }

  function requestCloseRhythmModal() {
    const pending = rhythmDraft
      ? `The rhythm "${rhythmDraft.name.trim() || "Untitled"}" is not saved yet.`
      : pedalImport
        ? "The rhythms read from the RC-600 are not imported yet."
        : null;
    if (pending && !window.confirm(`${pending} Close the Rhythm Library anyway?`)) return;
    closeRhythmModal();
  }

  function openEditor(role: PartRole) {
    setSelectedRole(role);
    setEditorRole(role);
  }

  function applyLibraryPart(part: LibraryPart, role: PartRole) {
    if (libraryModal) closeLibrary();
    pushHistory();
    setOverrides((prev) => ({
      ...prev,
      [role]: {
        events: eventsFromLibraryPart(part, role),
        source: "library",
        name: part.name,
        revertTo: null,
      },
    }));
    setSelectedRole(role);
    setStatus(`${PART_LABELS[role]} now uses "${part.name}" from the library.`);
  }

  /** Call before any change to the bar ranges or part notes, so Undo can step back over it. */
  function pushHistory() {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), { plan, overrides }]);
    setFuture([]);
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setFuture((f) => [...f, { plan, overrides }]);
    setHistory((h) => h.slice(0, -1));
    setPlan(prev.plan);
    setOverrides(prev.overrides);
  }

  function redo() {
    const next = future[future.length - 1];
    if (!next) return;
    setHistory((h) => [...h, { plan, overrides }]);
    setFuture((f) => f.slice(0, -1));
    setPlan(next.plan);
    setOverrides(next.overrides);
  }

  function applyWandOption(index: number, options = wandOptions) {
    const option = options?.[index];
    if (!option) return;
    pushHistory();
    setPlan(option.plan);
    setOverrides({});
    setStatus(null);
  }

  async function runMagicWand() {
    if (!score || wandBusy) return;
    setWandBusy(true);
    try {
      const options = await autoMapPlans(score.bars, score.ppq);
      if (!options.length) {
        setStatus("The Magic Wand found no drum bars to map in this song.");
        return;
      }
      setWandOptions(options);
      applyWandOption(0, options);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "The Magic Wand could not map this song.");
    } finally {
      setWandBusy(false);
    }
  }

  function resetParts() {
    pushHistory();
    stopPlayback();
    setPlan({});
    setOverrides({});
    setStatus("All parts are empty. Set them again from song bars or the libraries, or press Undo to bring them back.");
  }

  const undoRef = useRef({ undo, redo });
  undoRef.current = { undo, redo };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        undoRef.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  function editPart(next: PartEvents) {
    const role = selectedRole;
    setOverrides((prev) => {
      const own = prev[role];
      const revertTo = own ? (own.source === "edited" ? own.revertTo : own) : null;
      return {
        ...prev,
        [role]: {
          events: { ...next, role },
          source: "edited",
          name: own?.name ?? "",
          revertTo,
        },
      };
    });
  }

  function revertPart() {
    const own = overrides[selectedRole];
    if (!own || own.source !== "edited") return;
    pushHistory();
    if (own.revertTo) setOverrides((prev) => ({ ...prev, [selectedRole]: own.revertTo! }));
    else dropOverride(selectedRole);
  }

  function createEmptyPart(bars: number) {
    const [numerator, denominator] = resolved.length ? patternMeter(resolved) : [4, 4];
    const tempoBpm = resolved[0]?.tempoBpm ?? Math.round(firstTempo ?? 120);
    pushHistory();
    editPart(emptyPart(selectedRole, { bars, numerator, denominator, tempoBpm }));
  }

  function startLibrarySave(role: PartRole) {
    const base = patternName || score?.title || "Part";
    const own = overrides[role];
    const fromLibrary = own?.name ? libraryAll.find((p) => p.name === own.name) : undefined;
    setLibraryDraft({
      from: { kind: "role", role },
      name: own?.name || `${base} ${PART_LABELS[role]}`,
      kind: partKindForRole(role),
      tags: fromLibrary?.tags ?? [],
    });
  }

  function startLibraryEdit(part: LibraryPart) {
    setLibraryDraft({
      from: { kind: "existing", part },
      name: part.name,
      kind: part.kind,
      tags: [...part.tags],
    });
  }

  async function saveLibraryDraft() {
    if (!libraryDraft) return;
    const { from } = libraryDraft;
    const meta = {
      name: libraryDraft.name,
      tags: libraryDraft.tags,
      kind: libraryDraft.kind,
    };
    let part: LibraryPart | null = null;
    if (from.kind === "existing") {
      part = libraryPartFromEvents(eventsFromLibraryPart(from.part, defaultRoleForKind(from.part.kind)), {
        ...meta,
        id: from.part.id,
        source: from.part.source,
      });
    } else {
      const events = from.kind === "role" ? resolvedByRole.get(from.role) : selectionEvents;
      if (events)
        part = libraryPartFromEvents(events, {
          ...meta,
          source: partLibrary.saveTarget(),
        });
    }
    if (!part) {
      setLibraryError("This part has no notes to save. Set it from song bars or the library first.");
      return;
    }
    setLibraryBusy(true);
    setLibraryError(null);
    try {
      const into = from.kind === "existing" ? from.part.source : undefined;
      const saved = await partLibrary.save(part, into);
      setLibraryDraft(null);
      await reloadLibrary();
      const message =
        saved.source === "native"
          ? `Saved "${saved.name}" to the factory part library file.`
          : `Saved "${saved.name}" to your part library in this browser.`;
      setStatus(message);
      setLibraryNotice(message);
    } catch (cause) {
      setLibraryError(cause instanceof Error ? cause.message : "Could not save the part.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function deleteLibraryPart(part: LibraryPart) {
    if (!window.confirm(`Delete "${part.name}" from the part library?`)) return;
    setLibraryBusy(true);
    setError(null);
    try {
      await partLibrary.remove(part);
      if (libraryPreviewId === part.id) setLibraryPreviewId(null);
      await reloadLibrary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the part.");
    } finally {
      setLibraryBusy(false);
    }
  }

  function exportLibrary() {
    downloadBytes(new TextEncoder().encode(partLibrary.exportUser()), "rc600-rhythm-parts.json", "application/json");
  }

  async function importLibrary(file: File) {
    setError(null);
    try {
      const count = partLibrary.importUser(JSON.parse(await file.text()));
      await reloadLibrary();
      setStatus(`Imported ${count} part${count === 1 ? "" : "s"} into your library.`);
    } catch {
      setError("Could not read this library file.");
    }
  }

  function closeRhythmModal() {
    setRhythmModal(false);
    setRhythmDraft(null);
    setPedalImport(null);
    setRhythmPreviewId(null);
    setRhythmError(null);
  }

  function loadRhythm(r: LibraryRhythm) {
    pushHistory();
    const next: Overrides = {};
    for (const events of partsFromRhythm(r)) {
      next[events.role] = {
        events,
        source: "library",
        name: r.name,
        revertTo: null,
      };
    }
    const emptyPlan: PartPlan = {};
    setPlan(emptyPlan);
    setOverrides(next);
    setSavedParts({ plan: emptyPlan, overrides: next });
    setPatternName(sanitizePatternName(r.name));
    setKit(r.kit);
    setKitAuto(false);
    setSelectedRole("varA");
    closeRhythmModal();
    setStatus(`Loaded the rhythm "${r.name}". Change or edit any part, then save it to the RC-600.`);
  }

  function startRhythmSave() {
    const name = patternName || score?.title || "";
    const current = rhythmAll.find((r) => r.name.toLowerCase() === name.toLowerCase());
    setRhythmError(null);
    setRhythmDraft({
      existing: null,
      name,
      tags: current ? [...current.tags] : [],
      withParts: true,
    });
  }

  function startSlotRhythmSave(index: number) {
    const rhythm = slotRhythms.get(index);
    if (!rhythm) return;
    const current = rhythmAll.find((r) => r.name.toLowerCase() === rhythm.name.toLowerCase());
    stopPlayback();
    setRhythmModal(true);
    setPedalImport(null);
    setRhythmError(null);
    setRhythmDraft({
      existing: null,
      slot: { index, rhythm },
      name: rhythm.name,
      tags: current ? [...current.tags] : [],
      withParts: true,
    });
  }

  async function saveRhythmDraft() {
    if (!rhythmDraft) return;
    const { existing, slot: fromSlot, name, tags, withParts } = rhythmDraft;
    const parts = fromSlot ? partsFromRhythm(fromSlot.rhythm) : resolved;
    if (!existing && !parts.length) {
      setRhythmError("This rhythm has no parts yet. Set parts from song bars or the part library first.");
      return;
    }
    const rhythm = existing
      ? { ...existing, name: name.trim(), tags }
      : rhythmFromParts(parts, {
          name,
          kit: fromSlot ? fromSlot.rhythm.kit : kit,
          tags,
          source: rhythmLibrary.saveTarget(),
        });
    setLibraryBusy(true);
    setRhythmError(null);
    try {
      const saved = await rhythmLibrary.save(rhythm, existing?.source);
      if (!existing && !fromSlot) setSavedParts({ plan, overrides });
      let partCount = 0;
      if (!existing && withParts) {
        const target = partLibrary.saveTarget();
        for (const part of libraryPartsFromRhythm(saved, target)) {
          await partLibrary.save({ ...part, tags: normalizeTags([saved.name, ...saved.tags]) }, target);
          partCount++;
        }
        await reloadLibrary();
      }
      setRhythmDraft(null);
      await reloadRhythms();
      const where =
        saved.source === "native" ? "the factory rhythm library file" : "your rhythm library in this browser";
      setStatus(
        `Saved the rhythm "${saved.name}" to ${where}${
          partCount
            ? ` and its ${partCount} part${partCount === 1 ? "" : "s"} to the part library, tagged "${normalizeTag(saved.name)}"`
            : ""
        }.`,
      );
    } catch (cause) {
      setRhythmError(cause instanceof Error ? cause.message : "Could not save the rhythm.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function deleteRhythm(r: LibraryRhythm) {
    if (!window.confirm(`Delete the rhythm "${r.name}" from the library?`)) return;
    setLibraryBusy(true);
    setRhythmError(null);
    try {
      await rhythmLibrary.remove(r);
      if (rhythmPreviewId === r.id) setRhythmPreviewId(null);
      await reloadRhythms();
    } catch (cause) {
      setRhythmError(cause instanceof Error ? cause.message : "Could not delete the rhythm.");
    } finally {
      setLibraryBusy(false);
    }
  }

  /** Writes the slot list: straight to the open drive, or to the offline copy in this browser. */
  async function commitSlots(records: SlotRecord[], origin?: string | null): Promise<void> {
    if (dirHandle) {
      if (writeBlockedReason) throw new Error(writeBlockedReason);
      await writeFileToDirectory(dirHandle, RHYTHM_RC0_PATH, await writeRhythmFile(records));
      setSlotList({ records, origin: DRIVE_ORIGIN, dirty: false });
      return;
    }
    const next = {
      records,
      origin: origin !== undefined ? origin : (slotList?.origin ?? null),
      dirty: true,
    };
    setSlotList(next);
    await saveOfflineSlots(next);
  }

  /** Pedal slots for library rhythms, placed by name into `base`. */
  async function rhythmsToRecords(base: readonly SlotRecord[], list: readonly LibraryRhythm[]) {
    const encoded = await encodeRhythms(
      list.map((r) => ({ parts: partsFromRhythm(r), name: sanitizePatternName(r.name), kit: r.kit })),
    );
    return mergeRecordsByName(base, encoded);
  }

  /** Records to save into; offline without a list, asks before starting an empty one (null = cancelled). */
  function slotBase(): SlotRecord[] | null {
    if (slotList) return slotList.records;
    if (dirHandle) return [];
    return window.confirm(
      "No RHYTHM.RC0 is open, so this starts a new empty slot list. Copying that file to the pedal later replaces every user rhythm there. To keep them, cancel and use Open RHYTHM.RC0… under RC-600 Slots with a copy of the pedal's file. Start an empty list?",
    )
      ? []
      : null;
  }

  function slotsText(slots: { name: string; index: number }[]): string {
    return slots.map((s) => `${s.name} → ${s.index + 1}`).join(", ");
  }

  async function sendRhythmsToPedal(list: LibraryRhythm[]) {
    const base = slotBase();
    if (!base) return;
    setLibraryBusy(true);
    setRhythmError(null);
    try {
      const res = await rhythmsToRecords(base, list);
      await commitSlots(res.records);
      const count = `${res.slots.length} rhythm${res.slots.length === 1 ? "" : "s"}`;
      setStatus(
        dirHandle
          ? `Saved ${count} to the RC-600 (${slotsText(res.slots)}). Eject the drive to load them.`
          : `Added ${count} to the offline slot list (${slotsText(res.slots)}). Download RHYTHM.RC0 under RC-600 Slots when you are done.`,
      );
      closeRhythmModal();
    } catch (cause) {
      setRhythmError(cause instanceof Error ? cause.message : "Could not save to the RC-600.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function downloadRhythms(list: LibraryRhythm[]) {
    if (
      !slotList &&
      !window.confirm(
        "No RHYTHM.RC0 is open, so this file will hold only the ticked rhythms. Copying it to ROLAND/DATA replaces every user rhythm on the pedal. Continue?",
      )
    ) {
      return;
    }
    setRhythmError(null);
    try {
      const { records, slots } = await rhythmsToRecords(slotList?.records ?? [], list);
      downloadBytes(await writeRhythmFile(records), "RHYTHM.RC0", "application/octet-stream");
      setStatus(`Downloaded RHYTHM.RC0 (${slotsText(slots)}). Copy it to ROLAND/DATA on the RC-600.`);
    } catch (cause) {
      setRhythmError(cause instanceof Error ? cause.message : "Could not build RHYTHM.RC0.");
    }
  }

  async function openPedalImport(bytes: Uint8Array, source: string) {
    const items = rhythmsFromSlots(await readRhythmFile(bytes));
    setPedalImport({
      source,
      items,
      picked: items.map((i) => i.slot),
      withParts: true,
    });
  }

  async function startPedalImport() {
    setRhythmError(null);
    if (!dirHandle) {
      pedalFileRef.current?.click();
      return;
    }
    try {
      const bytes = await readBinaryFromDirectory(dirHandle, RHYTHM_RC0_PATH);
      if (!bytes) throw new Error("The RC-600 drive has no ROLAND/DATA/RHYTHM.RC0 yet (no user rhythms).");
      await openPedalImport(bytes, "Open RC-600 drive");
    } catch (cause) {
      setRhythmError(cause instanceof Error ? cause.message : "Could not read RHYTHM.RC0.");
    }
  }

  async function importPedalFile(file: File) {
    setRhythmError(null);
    try {
      await openPedalImport(new Uint8Array(await file.arrayBuffer()), file.name);
    } catch (cause) {
      setRhythmError(cause instanceof Error ? cause.message : "Could not read this RHYTHM.RC0 file.");
    }
  }

  async function confirmPedalImport() {
    if (!pedalImport) return;
    const chosen = pedalImport.items.filter((i) => pedalImport.picked.includes(i.slot)).map((i) => i.rhythm);
    setLibraryBusy(true);
    setRhythmError(null);
    try {
      rhythmLibrary.importUser(chosen);
      let partCount = 0;
      if (pedalImport.withParts) {
        const parts = chosen.flatMap((r) => libraryPartsFromRhythm(r, "user"));
        partCount = partLibrary.importUser(parts);
        await reloadLibrary();
      }
      await reloadRhythms();
      setPedalImport(null);
      setStatus(
        `Imported ${chosen.length} rhythm${chosen.length === 1 ? "" : "s"} from the RC-600 into your rhythm library${
          partCount ? ` and ${partCount} part${partCount === 1 ? "" : "s"} into your part library` : ""
        }.`,
      );
    } catch (cause) {
      setRhythmError(cause instanceof Error ? cause.message : "Could not import the rhythms.");
    } finally {
      setLibraryBusy(false);
    }
  }

  async function importRhythms(file: File) {
    setRhythmError(null);
    try {
      const count = rhythmLibrary.importUser(JSON.parse(await file.text()));
      await reloadRhythms();
      setStatus(`Imported ${count} rhythm${count === 1 ? "" : "s"} into your library.`);
    } catch {
      setRhythmError("Could not read this rhythm library file.");
    }
  }

  function toggleSong() {
    if (songFrom != null) {
      setSongFrom(null);
      setSongBar(null);
      return;
    }
    stopPlayback();
    setSongFrom(Math.min(startBar, Math.max(0, (score?.bars.length ?? 1) - 1)));
  }

  const scoreRef = useRef<DrumScore | null>(null);
  const applyScore = useCallback((next: DrumScore) => {
    scoreRef.current = next;
    setScore(next);
    setPlan({});
    suggestPlan(next.bars, next.ppq).then(
      (suggested) => {
        if (scoreRef.current === next) setPlan(suggested);
      },
      (e: unknown) => {
        if (scoreRef.current === next) {
          setStatus(e instanceof Error ? `Could not suggest parts: ${e.message}` : "Could not suggest parts.");
        }
      },
    );
    setWandOptions(null);
    setKitAuto(true);
    setPreviewRole(null);
    setSongFrom(null);
    setSongBar(null);
    setStartBar(0);
    setSelectedRole("varA");
    setSelection(null);
    setPreviewSelection(false);
    setLibraryDraft((d) => (d?.from.kind === "existing" ? d : null));
    setHistory([]);
    setFuture([]);
  }, []);

  async function openFile(file: File) {
    setLoading(true);
    setError(null);
    setStatus(null);
    setPreviewRole(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let next: DrumScore;
      if (isMidiFile(file.name, bytes)) {
        const midi = parseMidiFile(bytes);
        sourceRef.current = { kind: "midi", midi };
        next = extractMidiDrumScore(midi);
      } else {
        const at = await loadAlphaTab();
        const raw = loadScoreBytes(at, bytes);
        sourceRef.current = { kind: "score", at, score: raw };
        next = extractDrumScore(at, raw);
      }
      setFileName(file.name);
      setPatternName(sanitizePatternName(songSlug(next, file.name).replace(/_/g, " ")));
      applyScore(next);
      if (!next.trackIndices.length) {
        setError("No drum track was found. Pick the track that holds the drums.");
      }
    } catch (cause) {
      setScore(null);
      setPlan({});
      setError(
        cause instanceof Error && cause.message
          ? `Could not read this file: ${cause.message}`
          : "Could not read this file. Use a Guitar Pro (.gp, .gpx, .gp3–.gp5), MusicXML or MIDI (.mid) file.",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleTrack(trackIndex: number) {
    const src = sourceRef.current;
    if (!src || !score) return;
    const current = score.trackIndices;
    const next = current.includes(trackIndex) ? current.filter((i) => i !== trackIndex) : [...current, trackIndex];
    if (!next.length) return;
    setError(null);
    applyScore(src.kind === "midi" ? extractMidiDrumScore(src.midi, next) : extractDrumScore(src.at, src.score, next));
  }

  function setPart(role: PartRole, start: number, end: number) {
    const cur = plan[role];
    if (cur && cur.start === start && cur.end === end && !overrides[role]) return;
    pushHistory();
    setPlan((prev) => ({
      ...prev,
      [role]: { role, start, end, confidence: "manual", reason: "Set by you" },
    }));
    dropOverride(role);
    setStatus(null);
  }

  function dropOverride(role: PartRole) {
    setOverrides((prev) => {
      if (!prev[role]) return prev;
      const next = { ...prev };
      delete next[role];
      return next;
    });
  }

  /** Clears the library pick first; a second click clears the song bars. */
  function clearPart(role: PartRole) {
    pushHistory();
    if (overrides[role]) {
      dropOverride(role);
    } else {
      setPlan((prev) => {
        const next = { ...prev };
        delete next[role];
        return next;
      });
    }
    if (previewRole === role) playPart(null);
  }

  function barFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-bar]");
    const n = Number(el?.dataset.bar);
    return Number.isInteger(n) ? n : null;
  }

  function updateDrag(range: [number, number] | null) {
    dragRangeRef.current = range;
    setDragRange(range);
  }

  function finishDrag() {
    const range = dragRangeRef.current;
    dragAnchorRef.current = null;
    updateDrag(null);
    if (range) setSelection([range[0], range[1] + 1]);
  }

  useEffect(() => {
    const onUp = () => {
      if (dragAnchorRef.current != null) finishDrag();
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  });

  async function exportPack() {
    if (!resolved.length) {
      setStatus("Nothing to export. Set at least one part.");
      return;
    }
    try {
      const pack = await buildMidiPack(resolved, score?.title || patternName || fileName.replace(/\.[^.]+$/, ""));
      downloadBytes(pack.bytes, pack.fileName);
      setStatus(`Exported ${resolved.length} part${resolved.length === 1 ? "" : "s"} to ${pack.fileName}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not build the MIDI pack.");
    }
  }

  const readDriveSlots = useCallback(async () => {
    if (!dirHandle) return;
    const bytes = await readBinaryFromDirectory(dirHandle, RHYTHM_RC0_PATH);
    setSlotList({
      records: bytes ? await readRhythmFile(bytes) : [],
      origin: DRIVE_ORIGIN,
      dirty: false,
    });
  }, [dirHandle]);

  useEffect(() => {
    let cancelled = false;
    setSlotList(null);
    setOfflineCopy(null);
    setSlot(NEW_SLOT);
    const offline = loadOfflineSlots().then(async (saved) => {
      if (cancelled || !saved) return;
      const records = saved.records ?? (saved.bytes ? await readRhythmFile(saved.bytes) : []);
      const list = { records, origin: saved.origin, dirty: saved.dirty };
      if (!saved.records) await saveOfflineSlots(list);
      if (cancelled) return;
      if (dirHandle) setOfflineCopy(list);
      else setSlotList(list);
    });
    const load = dirHandle ? Promise.all([readDriveSlots(), offline]) : offline;
    load.catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not read RHYTHM.RC0.");
    });
    return () => {
      cancelled = true;
    };
  }, [dirHandle, readDriveSlots]);

  /** Puts the offline list on the pedal: "merge" adds its rhythms (same name replaces), "replace" swaps the whole file. */
  async function sendOfflineToPedal(mode: "merge" | "replace") {
    if (!dirHandle || !offlineCopy || !slotList) return;
    const count = offlineCopy.records.length;
    const question =
      mode === "replace"
        ? `Replace all ${slotList.records.length} user rhythms on the RC-600 with the ${count} rhythms of the offline list? Download a backup first if you may want them back.`
        : `Add the ${count} rhythms of the offline list to the RC-600? A rhythm whose name is already on the pedal replaces that slot; the others take the next free slots.`;
    if (!window.confirm(question)) return;
    await runSlotChange(async () => {
      const records =
        mode === "replace"
          ? [...offlineCopy.records]
          : mergeRecordsByName(slotList.records, offlineCopy.records).records;
      await commitSlots(records);
      const sent = { ...offlineCopy, dirty: false };
      setOfflineCopy(sent);
      await saveOfflineSlots(sent);
      setStatus(
        mode === "replace"
          ? `The RC-600 now has the ${count} rhythms of the offline list.`
          : `Added the offline list to the RC-600: ${records.length} user rhythms on the pedal now.`,
      );
    });
  }

  /** Keeps a copy of the pedal's rhythms in this browser, to keep working without the RC-600. */
  async function copyPedalToOffline() {
    if (!dirHandle || !slotList) return;
    if (
      offlineCopy?.dirty &&
      !window.confirm(
        "The offline list has changes that were not sent or downloaded. Replace it with the RC-600's rhythms?",
      )
    )
      return;
    await runSlotChange(async () => {
      const origin = `RC-600 on ${new Date().toLocaleDateString()}`;
      const copy = { records: [...slotList.records], origin, dirty: false };
      await saveOfflineSlots(copy);
      setOfflineCopy(copy);
      setStatus(`Copied the ${copy.records.length} RC-600 rhythms to the offline list in this browser.`);
    });
  }

  async function saveToSlot() {
    if (!resolved.length) return;
    const base = slotBase();
    if (!base) return;
    setSaving(true);
    setError(null);
    try {
      const [record] = await encodeRhythms([{ parts: resolved, name: patternName, kit }]);
      const next = upsertRecord(base, record!, slot === NEW_SLOT ? null : slot);
      await commitSlots(next.records);
      setSavedParts({ plan, overrides });
      setSlot(next.index);
      const name = next.records[next.index]!.name;
      setStatus(
        dirHandle
          ? `Saved "${name}" to user rhythm ${next.index + 1}. Eject the drive to load it on the RC-600.`
          : `Saved "${name}" to slot ${next.index + 1} of the offline list. Download RHYTHM.RC0 under RC-600 Slots and copy it to ROLAND/DATA on the pedal.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the rhythm.");
    } finally {
      setSaving(false);
    }
  }

  async function runSlotChange(change: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await change();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the slots.");
    } finally {
      setSaving(false);
    }
  }

  async function openSlotFile(file: File) {
    if (
      slotList?.dirty &&
      !window.confirm("The offline list has changes that were not downloaded. Replace it with this file?")
    )
      return;
    await runSlotChange(async () => {
      const records = await readRhythmFile(new Uint8Array(await file.arrayBuffer()));
      const list = { records, origin: file.name, dirty: false };
      setSlotList(list);
      setSlot(NEW_SLOT);
      await saveOfflineSlots(list);
      setStatus(`Opened ${file.name}: ${records.length} user rhythm${records.length === 1 ? "" : "s"}.`);
    });
  }

  async function startEmptySlots() {
    if (
      slotList?.dirty &&
      !window.confirm("The offline list has changes that were not downloaded. Start an empty list anyway?")
    )
      return;
    await runSlotChange(async () => {
      setSlot(NEW_SLOT);
      const list = { records: [], origin: null, dirty: false };
      setSlotList(list);
      await saveOfflineSlots(list);
    });
  }

  async function closeSlotList() {
    if (slotList?.dirty && !window.confirm("The offline list has changes that were not downloaded. Close it anyway?"))
      return;
    setSlotList(null);
    setSlot(NEW_SLOT);
    await saveOfflineSlots(null).catch(() => undefined);
  }

  async function downloadSlots() {
    if (!slotList) return;
    let bytes: Uint8Array;
    try {
      bytes = await writeRhythmFile(slotList.records);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not build RHYTHM.RC0.");
      return;
    }
    downloadBytes(bytes, "RHYTHM.RC0", "application/octet-stream");
    if (dirHandle) {
      setStatus("Downloaded a backup of the pedal's RHYTHM.RC0.");
      return;
    }
    const saved = { ...slotList, dirty: false };
    setSlotList(saved);
    await saveOfflineSlots(saved).catch(() => undefined);
    setStatus(
      "Downloaded RHYTHM.RC0. Copy it to ROLAND/DATA on the RC-600 (USB storage mode), replacing the file there, then eject.",
    );
  }

  function loadSlot(index: number) {
    const r = slotRhythms.get(index);
    const p = slotList?.records[index];
    if (!r || !p) return;
    loadRhythm(r);
    setPatternName(p.name);
    setKit(p.kit);
    setSlot(index);
    setStatus(
      `Slot ${index + 1} "${p.name}" is in the builder. Change any part, then Save to Slot ${index + 1} to replace it.`,
    );
  }

  function renameSlot(index: number, name: string) {
    const list = slotList;
    const record = list?.records[index];
    if (!list || !record) return;
    void runSlotChange(async () => {
      const renamed = await renameSlotRecord(record, name);
      await commitSlots(list.records.map((r, i) => (i === index ? renamed : r)));
    });
  }

  function moveSlot(index: number, delta: -1 | 1) {
    if (!slotList) return;
    const to = index + delta;
    const records = [...slotList.records];
    [records[index], records[to]] = [records[to]!, records[index]!];
    setSlot((s) => (s === index ? to : s === to ? index : s));
    void runSlotChange(() => commitSlots(records));
  }

  function deleteSlot(index: number) {
    if (!slotList) return;
    const name = slotList.records[index]?.name || "(no name)";
    if (!window.confirm(`Delete slot ${index + 1} "${name}"? The slots after it move up by one.`)) return;
    setSlot((s) => (s === index ? NEW_SLOT : s > index ? s - 1 : s));
    void runSlotChange(() => commitSlots(slotList.records.filter((_, i) => i !== index)));
  }

  const patchOptions = (patch: Partial<ConvertOptions>) => setOptions((prev) => ({ ...prev, ...patch }));
  const firstTempo = score?.bars.find((b) => b.hits.length)?.tempo ?? score?.bars[0]?.tempo;
  const pickedTracks = score?.tracks.filter((t) => score.trackIndices.includes(t.index)) ?? [];
  const pickedNotes = pickedTracks.reduce((sum, t) => sum + t.noteCount, 0);
  const drumTracks = score?.tracks.filter((t) => t.isPercussion && t.noteCount > 0) ?? [];
  const hiddenTracks = (score?.tracks.length ?? 0) - drumTracks.length;

  return (
    <div className="rhythm-converter">
      <section
        className={`rhythm-conv-drop${score ? " is-loaded" : ""}${dropActive ? " is-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void openFile(file);
        }}
      >
        <div className="rhythm-conv-drop-head" title={score ? fileName : undefined}>
          <Icon name="fileMusic" size={18} />
          <strong>{score ? score.title || fileName : "Drop a Guitar Pro or MIDI file here"}</strong>
          {score?.artist ? <span className="rhythm-conv-artist">{score.artist}</span> : null}
          <InfoTip label="Preparing the file" text={PREPARE_TEXT} />
        </div>
        {score ? (
          <>
            <span className="rhythm-conv-stats">
              {firstTempo ? `${Math.round(firstTempo)} BPM` : "—"} · {meter ?? "—"} · {score.bars.length} bars
            </span>
            <div className="rhythm-conv-tracks" role="group" aria-label="Tracks">
              <span className="rhythm-conv-tracks-label">Tracks</span>
              <InfoTip label="Tracks" text={TRACKS_TEXT} />
              {drumTracks.map((t) => {
                const on = score.trackIndices.includes(t.index);
                return (
                  <button
                    key={t.index}
                    type="button"
                    className={`rhythm-conv-track${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    disabled={on && score.trackIndices.length === 1}
                    onClick={() => toggleTrack(t.index)}
                    title={`${t.noteCount} notes${t.isPercussion ? " · drums" : ""}`}
                  >
                    {t.name}
                    <span className="rhythm-conv-track-count">{t.noteCount}</span>
                  </button>
                );
              })}
              {hiddenTracks > 0 ? (
                <span
                  className="rhythm-conv-track-hidden"
                  title={`${hiddenTracks} non-drum instrument${hiddenTracks === 1 ? "" : "s"} hidden: the RC-600 rhythm plays drums only`}
                >
                  +{hiddenTracks} hidden
                </span>
              ) : null}
            </div>
            <span className="rhythm-editor-spacer" />
            <button
              type="button"
              className="btn primary rhythm-wand-btn"
              title="Magic Wand: fill Intro, Variations, Fills and Ending from the song, with up to 8 alternatives"
              disabled={wandBusy}
              onClick={() => void runMagicWand()}
            >
              <Icon name="autoFix" size={16} />
              {wandBusy ? "Mapping…" : "Magic Wand"}
            </button>
          </>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept={SCORE_FILE_ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void openFile(file);
          }}
        />
        <button
          type="button"
          className={`btn${score ? "" : " primary"}`}
          disabled={loading}
          title="Guitar Pro 3–8 (.gp3, .gp4, .gp5, .gpx, .gp), MusicXML or MIDI (.mid)"
          onClick={() => fileInputRef.current?.click()}
        >
          <Icon name="upload" size={14} />
          {loading ? "Reading…" : score ? "Open Another File" : "Choose File"}
        </button>
        {score ? null : (
          <span className="rhythm-conv-formats">
            Guitar Pro 3–8 (.gp3, .gp4, .gp5, .gpx, .gp), MusicXML or MIDI (.mid)
          </span>
        )}
      </section>

      {score && wandOptions?.length ? (
        <div className="rhythm-wand-bar" role="group" aria-label="Magic Wand alternatives">
          <span className="rhythm-wand-title">
            <Icon name="autoFix" size={16} />
            Magic Wand
          </span>
          <div className="rhythm-segmented" role="radiogroup" aria-label="Arrangement">
            {wandOptions.map((o, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={wandIndex === i}
                className={wandIndex === i ? "is-active" : ""}
                title={`${i === 0 ? "Best match" : `Option ${i + 1}`}: ${o.summary}`}
                onClick={() => applyWandOption(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <span className="rhythm-wand-summary">
            {wandIndex != null ? (
              <>
                <strong>{wandIndex === 0 ? "Best match" : `Option ${wandIndex + 1}`}</strong> ·{" "}
                {wandOptions[wandIndex]!.summary}
              </>
            ) : (
              "Parts changed by hand; pick a number to go back to an arrangement."
            )}
          </span>
          <InfoTip label="Magic Wand" text={WAND_TEXT} />
          <span className="rhythm-editor-spacer" />
          <button
            type="button"
            className="btn ghost"
            aria-label="Hide the Magic Wand alternatives"
            title="Hide the alternatives (the parts stay as they are)"
            onClick={() => setWandOptions(null)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="drum-pad-hint warn" role="alert">
          {error}
        </p>
      ) : null}

      {score ? (
        <>
          {!drumTracks.length ? (
            <p className="drum-pad-hint warn">
              This file has no drum track (MIDI channel 10 or a track named Drums / Percussion), so there is nothing to
              convert. Open a file with drums.
            </p>
          ) : score.trackIndices.length && pickedNotes === 0 ? (
            <p className="drum-pad-hint warn">The selected tracks have no notes. Pick the drum track.</p>
          ) : null}
          {mismatched.length ? (
            <p className="drum-pad-hint warn">
              {mismatched.map((r) => PART_LABELS[r]).join(", ")} {mismatched.length === 1 ? "uses" : "use"} a time
              signature other than {meter}. An RC-600 rhythm has a single Beat, so keep every part in {meter}.
            </p>
          ) : null}

          <section className={`rhythm-conv-timeline-wrap${panelOpen("bars") ? "" : " is-collapsed"}`} aria-label="Bars">
            <div className="rhythm-bars-toolbar">
              <div className="rhythm-bars-title">
                <h3>Bars</h3>
                <InfoTip label="Selecting bars" text={TIMELINE_TEXT} />
                <span className="rhythm-bars-count">
                  {visibleBarCount === score.bars.length
                    ? `${score.bars.length} bars`
                    : `${visibleBarCount} of ${score.bars.length} shown`}
                </span>
              </div>
              {panelOpen("bars") ? (
                <>
                  <div className="rhythm-bars-group" role="group" aria-label="Bars to show">
                    <ViewToggle
                      id="rc-conv-show-empty"
                      label="Empty"
                      count={emptyBarCount}
                      checked={showEmptyBars}
                      title={`Show bars without drum hits (count-ins, breaks). Hidden bars still play in Play Song and stay inside selections that span them.${
                        emptyBarCount ? ` ${emptyBarCount} in this file.` : ""
                      }`}
                      onChange={(on) => setEditorPrefs((p) => ({ ...p, showEmptyBars: on }))}
                    />
                    <ViewToggle
                      id="rc-conv-show-repeats"
                      label="Repeats"
                      count={repeatedBarCount}
                      checked={!hideRepeatedBars}
                      title={`Show every copy of identical bars (same drum notes on the same 1/16 steps). Off shows each groove and fill once, with a ×N count.${
                        repeatedBarCount ? ` ${repeatedBarCount} repeats in this file.` : ""
                      }`}
                      onChange={(on) => setEditorPrefs((p) => ({ ...p, showRepeatedBars: on }))}
                    />
                  </div>
                  <div className="rhythm-segmented" role="radiogroup" aria-label="Bars per row">
                    {BAR_LAYOUTS.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        role="radio"
                        aria-checked={editorPrefs.barLayout === l.value}
                        className={editorPrefs.barLayout === l.value ? "is-active" : ""}
                        title={l.label}
                        onClick={() => setEditorPrefs((p) => ({ ...p, barLayout: l.value }))}
                      >
                        {l.value === "sections" ? "Sections" : l.value}
                      </button>
                    ))}
                  </div>
                  <span className="rhythm-editor-spacer" />
                  <div className="rhythm-bars-history">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={!history.length}
                      aria-label="Undo"
                      title="Undo (Ctrl+Z)"
                      onClick={undo}
                    >
                      <Icon name="undo" size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={!future.length}
                      aria-label="Redo"
                      title="Redo (Ctrl+Shift+Z)"
                      onClick={redo}
                    >
                      <Icon name="redo" size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <span className="rhythm-editor-spacer" />
              )}
              <button
                type="button"
                className="btn ghost rhythm-settings-toggle"
                aria-expanded={panelOpen("bars")}
                aria-controls="rc-conv-bars-body"
                aria-label={panelOpen("bars") ? "Collapse Bars" : "Expand Bars"}
                title={panelOpen("bars") ? "Collapse Bars" : "Expand Bars"}
                onClick={() => togglePanel("bars")}
              >
                <Icon name="chevronDown" size={18} />
              </button>
            </div>

            {panelOpen("bars") ? (
              <div id="rc-conv-bars-body">
                <div className={`rhythm-song-player${songFrom != null ? " is-playing" : ""}`}>
                  <button
                    type="button"
                    className="rhythm-song-play"
                    onClick={toggleSong}
                    disabled={!pickedNotes}
                    aria-label={songFrom != null ? "Stop" : "Play Song"}
                  >
                    <Icon name={songFrom != null ? "stop" : "play"} size={20} />
                  </button>
                  <div className="rhythm-song-now">
                    <strong>{songFrom != null ? "Playing Song" : "Play Song"}</strong>
                    <span>
                      {songBar != null
                        ? `Bar ${songBar + 1} of ${score.bars.length}${score.bars[songBar]?.section ? ` · ${score.bars[songBar]!.section}` : ""}`
                        : soundLoading
                          ? "Loading sounds…"
                          : "Whole drum track, as written"}
                    </span>
                  </div>
                  <label className="rhythm-song-field">
                    <span>From bar</span>
                    <input
                      type="number"
                      min={1}
                      max={score.bars.length}
                      value={startBar + 1}
                      onChange={(e) =>
                        setStartBar(
                          Math.max(0, Math.min(score.bars.length - 1, Math.round(Number(e.target.value) || 1) - 1)),
                        )
                      }
                    />
                  </label>
                  <PartRangeInputs
                    key={selection ? `${selection[0]}:${selection[1]}` : "none"}
                    range={selection ? { start: selection[0], end: selection[1] } : null}
                    barCount={score.bars.length}
                    onSet={(start, end) => setSelection([start, end])}
                  />
                  <InfoTip
                    label="Selecting bars"
                    text={`Click or drag across the bars below to select them, or type the first and last bar here; Shift+click stretches the selection. Then Play the selection, use it for ${PART_LABELS[selectedRole]} or another part, or Save to Library.`}
                  />
                  <span className="rhythm-editor-spacer" />
                  <div className="rhythm-song-sound">
                    <Icon name="speaker" size={16} />
                    <select
                      aria-label="Sound"
                      value={sound}
                      onChange={(e) => {
                        const next = e.target.value as DrumSoundId;
                        if (next === "rc600" && !midiLive) onRequestMidi?.();
                        setSound(next);
                      }}
                    >
                      {DRUM_SOUNDS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {modelKit >= 0 ? (
                      <select
                        aria-label="Kit"
                        value={kit}
                        title="RC-600 kit to preview; also the Kit saved with the rhythm"
                        onChange={(e) => {
                          setKitAuto(false);
                          setKit(Number(e.target.value));
                        }}
                      >
                        {RHYTHM_KITS.map((label, value) => (
                          <option key={label} value={value}>
                            {kitGuess?.kit === value ? `${label} (Suggested)` : label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <InfoTip label="Playback" text={PLAYBACK_TEXT} />
                  </div>
                </div>
                {onPedal && !midiLive ? (
                  <p className="drum-pad-hint warn">
                    MIDI is not connected, so playback uses the RC-600 Kit Preview in the browser.
                  </p>
                ) : null}
                {selection || libraryNotice ? (
                  <div className={`rhythm-selection${selection ? " is-active" : ""}`}>
                    {libraryNotice ? <span className="rhythm-conv-status is-ok">{libraryNotice}</span> : null}
                    {selection ? (
                      <>
                        <span className="rhythm-selection-label">
                          {selection[1] - selection[0]} bar
                          {selection[1] - selection[0] === 1 ? "" : "s"}
                          {selectionEvents
                            ? ` · ${selectionEvents.numerator}/${selectionEvents.denominator} · ${selectionEvents.notes.length} hits`
                            : ""}
                        </span>
                        <button
                          type="button"
                          className={`btn${previewSelection ? " is-on" : ""}`}
                          disabled={!selectionEvents?.notes.length}
                          onClick={() => playSelection(!previewSelection)}
                        >
                          <Icon name={previewSelection ? "stop" : "play"} size={14} />
                          {previewSelection ? "Stop" : "Play"}
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          style={
                            {
                              "--role-color": ROLE_COLOR[selectedRole],
                            } as CSSProperties
                          }
                          onClick={() => assignSelection(selectedRole)}
                        >
                          <Icon name={ROLE_ICON[selectedRole]} size={14} />
                          Use for {PART_LABELS[selectedRole]}
                        </button>
                        <RhythmPartPicker
                          label="Other Part"
                          colors={ROLE_COLOR}
                          icons={ROLE_ICON}
                          status={partStatus}
                          suggested={suggestedRole}
                          exclude={selectedRole}
                          onPick={assignSelection}
                        />
                        {selectionGuess ? (
                          <span className="rhythm-guess" title={selectionGuess.kindReason}>
                            <Icon name="autoFix" size={14} />
                            Looks like <strong>{PART_KIND_LABELS[selectionGuess.kind]}</strong>
                            {selectionGuess.tags.length ? ` · ${selectionGuess.tags.slice(0, 4).join(", ")}` : ""}
                            {suggestedRole && suggestedRole !== selectedRole ? (
                              <button
                                type="button"
                                className="btn ghost rhythm-guess-use"
                                style={
                                  {
                                    "--role-color": ROLE_COLOR[suggestedRole],
                                  } as CSSProperties
                                }
                                onClick={() => assignSelection(suggestedRole)}
                              >
                                Use for {PART_LABELS[suggestedRole]}
                              </button>
                            ) : null}
                            <InfoTip
                              label="Automatic classification"
                              text={`${selectionGuess.kindReason} The category comes from the song's section markers when there are any, then from where the bars sit in the song (first or last drum bars), then from the groove itself: toms and snare rolls point to a Fill. Tags come from the drums: meter, tempo, shuffle or swing feel, backbeat, four-on-the-floor kick, reggae one drop and Latin percussion. They are suggestions; Save to Library starts with them and you can change them.`}
                            />
                          </span>
                        ) : null}
                        <button type="button" className="btn" disabled={!selectionEvents} onClick={startSelectionSave}>
                          <Icon name="library" size={14} />
                          Save to Library…
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          aria-label="Clear the selection"
                          onClick={() => {
                            setSelection(null);
                            setPreviewSelection(false);
                          }}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {libraryDraft?.from.kind === "selection" ? (
                  <LibraryDraftForm
                    draft={libraryDraft}
                    onDraft={setLibraryDraft}
                    onSave={() => void saveLibraryDraft()}
                    busy={libraryBusy}
                    error={libraryError}
                    known={knownTags}
                    title={`Save ${barRangeText(libraryDraft.from.start, libraryDraft.from.end)} ${
                      partLibrary.saveTarget() === "native" ? "to the factory library" : "to your library"
                    }`}
                  />
                ) : null}
                <div className="rhythm-conv-legend" aria-label="Part colors">
                  {PART_ROLES.map((role) => (
                    <span
                      key={role}
                      className="rhythm-conv-legend-chip"
                      style={{ "--role-color": ROLE_COLOR[role] } as CSSProperties}
                    >
                      <b>{PART_SHORT[role]}</b>
                      {PART_LABELS[role]}
                    </span>
                  ))}
                </div>
                <div
                  ref={timelineRef}
                  className="rhythm-conv-timeline"
                  onPointerMove={(e) => {
                    if (dragAnchorRef.current == null) return;
                    const bar = barFromPoint(e.clientX, e.clientY);
                    if (bar == null) return;
                    const a = dragAnchorRef.current;
                    updateDrag([Math.min(a, bar), Math.max(a, bar)]);
                  }}
                >
                  {barRows.map((seg) => (
                    <div key={seg.start} className="rhythm-conv-section-row">
                      <div className="rhythm-conv-section-name" title={seg.label ?? "No section marker"}>
                        <strong>{seg.label ?? "—"}</strong>
                        <span>{barRangeText(seg.start, seg.end)}</span>
                      </div>
                      <div
                        className={`rhythm-conv-section-bars${fixedRow ? " is-fixed" : ""}`}
                        style={fixedRow ? ({ "--per-row": fixedRow } as CSSProperties) : undefined}
                      >
                        {seg.bars.map((bar) => {
                          const role = roleAtBar(plan, bar.index);
                          const inDrag = dragRange
                            ? bar.index >= dragRange[0] && bar.index <= dragRange[1]
                            : Boolean(selection && bar.index >= selection[0] && bar.index < selection[1]);
                          const shown = role;
                          const isPlayingPart =
                            previewRole != null &&
                            plan[previewRole] &&
                            bar.index >= plan[previewRole]!.start &&
                            bar.index < plan[previewRole]!.end;
                          return (
                            <button
                              key={bar.index}
                              type="button"
                              data-bar={bar.index}
                              className={`rhythm-conv-bar${shown ? " has-role" : ""}${inDrag ? " is-drag" : ""}${
                                bar.hits.length ? "" : " is-empty"
                              }${isPlayingPart ? " is-playing" : ""}${songBar === bar.index ? " is-current" : ""}`}
                              style={
                                {
                                  "--role-color": shown ? ROLE_COLOR[shown] : undefined,
                                } as CSSProperties
                              }
                              title={`Bar ${bar.index + 1}${
                                bar.masterBarIndex !== bar.index ? ` (score bar ${bar.masterBarIndex + 1})` : ""
                              } · ${meterLabel(bar)} · ${bar.hits.length} hits${role ? ` · ${PART_LABELS[role]}` : ""}`}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                e.preventDefault();
                                if (e.shiftKey && selection) {
                                  setSelection([
                                    Math.min(selection[0], bar.index),
                                    Math.max(selection[1], bar.index + 1),
                                  ]);
                                  return;
                                }
                                dragAnchorRef.current = bar.index;
                                updateDrag([bar.index, bar.index]);
                              }}
                            >
                              <span className="rhythm-conv-bar-role">{shown ? PART_SHORT[shown] : ""}</span>
                              <span className="rhythm-conv-bar-num">
                                {bar.index + 1}
                                {fixedRow && bar.section ? <em title={bar.section}>{bar.section}</em> : null}
                              </span>
                              {hideRepeatedBars && (repeats.count.get(bar.index) ?? 1) > 1 ? (
                                <span
                                  className="rhythm-conv-bar-repeat"
                                  title={`This bar occurs ${repeats.count.get(bar.index)} times in the song`}
                                >
                                  ×{repeats.count.get(bar.index)}
                                </span>
                              ) : null}
                              <BarThumb hits={bar.hits} lengthTicks={bar.lengthTicks} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {libraryMismatch.length ? (
        <p className="drum-pad-hint warn">
          {libraryMismatch.map((p) => `${PART_LABELS[p.role]} (${p.numerator}/${p.denominator})`).join(", ")}{" "}
          {libraryMismatch.length === 1 ? "uses" : "use"} a different time signature from the rest of the rhythm. An
          RC-600 rhythm has a single Beat, so notes past the bar length are cut.
        </p>
      ) : null}

      <section className="rhythm-conv-parts" aria-label="Rhythm parts">
        <div className="rhythm-conv-section-head">
          <h3>Parts</h3>
          <InfoTip label="Building a rhythm" text={PARTS_TEXT} />
          {libraryNotice ? <span className="rhythm-conv-status is-ok">{libraryNotice}</span> : null}
          <span className="rhythm-editor-spacer" />
          <button type="button" className="btn" onClick={() => openLibrary(null)}>
            <Icon name="library" size={14} />
            Part Library
          </button>
          <button type="button" className="btn" onClick={() => setRhythmModal(true)}>
            <Icon name="library" size={14} />
            Rhythm Library
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!Object.keys(plan).length && !Object.keys(overrides).length}
            title="Empty every part to start the rhythm over (Undo brings them back)"
            onClick={resetParts}
          >
            <Icon name="eraser" size={14} />
            Reset Parts
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!resolved.length}
            title="Save every part set here as one rhythm in the rhythm library; each part also goes to the part library, tagged with the rhythm name"
            onClick={() => {
              setRhythmModal(true);
              startRhythmSave();
            }}
          >
            <Icon name="save" size={14} />
            Save Rhythm…
          </button>
        </div>
        <RhythmPlayerBar
          available={resolvedByRole}
          prefs={{ ...player, tempo: playerTempo }}
          onPrefs={(next) =>
            setPlayer({
              ...next,
              tempo: next.tempo === rhythmTempo ? null : next.tempo,
            })
          }
          rhythmTempo={rhythmTempo}
          playing={rhythmPlaying}
          now={sequenceNow}
          progress={progress}
          colors={ROLE_COLOR}
          onToggle={toggleRhythm}
        />
        <div className="rhythm-conv-part-list">
          {PART_ROLES.map((role) => {
            const part = score ? plan[role] : undefined;
            const own = overrides[role];
            const ready = resolvedByRole.has(role);
            const playing = previewRole === role;
            const sounding = sequenceNow?.segment.role === role;
            const rangeText = own
              ? `${own.source === "library" ? `Library: ${own.name}` : own.name ? `Edited: ${own.name}` : "Edited"} · ${
                  own.events.bars
                } bar${own.events.bars === 1 ? "" : "s"}`
              : part
                ? `${barRangeText(part.start, part.end)} · ${partLength(part)} bar${partLength(part) === 1 ? "" : "s"}`
                : "Not set";
            return (
              <div
                key={role}
                className={`rhythm-conv-part${selectedRole === role ? " is-selected" : ""}${ready ? "" : " is-empty"}${
                  sounding ? " is-sounding" : ""
                }`}
                style={{ "--role-color": ROLE_COLOR[role] } as CSSProperties}
              >
                <button
                  type="button"
                  className="rhythm-conv-part-pick"
                  aria-pressed={selectedRole === role}
                  onClick={() => setSelectedRole(role)}
                  title={score ? `Click bars to set ${PART_LABELS[role]}` : PART_LABELS[role]}
                >
                  <Icon name={ROLE_ICON[role]} size={16} />
                  <span className="rhythm-conv-part-name">{PART_LABELS[role]}</span>
                  <span className="rhythm-conv-part-range" title={rangeText}>
                    {rangeText}
                  </span>
                  {own ? (
                    <span
                      className="rhythm-conv-badge is-manual"
                      title={own.source === "library" ? "Picked from the part library" : "Changed in the part editor"}
                    >
                      {own.source === "library" ? "Library" : "Edited"}
                    </span>
                  ) : part ? (
                    <span className={`rhythm-conv-badge is-${part.confidence}`} title={part.reason}>
                      {CONFIDENCE_LABEL[part.confidence]}
                    </span>
                  ) : null}
                </button>
                <div className="rhythm-conv-part-foot">
                  <span className="rhythm-conv-part-file" title={`Exported as ${PART_FILE_NAMES[role]}`}>
                    {PART_FILE_NAMES[role]}
                  </span>
                  <button
                    type="button"
                    className="btn primary"
                    aria-label={`Edit ${PART_LABELS[role]}`}
                    title={`Edit ${PART_LABELS[role]}`}
                    onClick={() => openEditor(role)}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn"
                    aria-label={`Pick ${PART_LABELS[role]} from the library`}
                    title={`Pick a ${PART_KIND_LABELS[partKindForRole(role)]} part from the library`}
                    onClick={() => openLibrary(role)}
                  >
                    <Icon name="library" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`btn ghost${playing ? " is-on" : ""}`}
                    disabled={!ready}
                    aria-label={playing ? `Stop ${PART_LABELS[role]}` : `Play ${PART_LABELS[role]}`}
                    title={playing ? "Stop" : "Play"}
                    onClick={() => playPart(playing ? null : role)}
                  >
                    <Icon name={playing ? "stop" : "play"} size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!ready}
                    aria-label={`Save ${PART_LABELS[role]} to the library`}
                    title="Save to Library"
                    onClick={() => startLibrarySave(role)}
                  >
                    <Icon name="save" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!own && !part}
                    aria-label={
                      own
                        ? `Remove the ${own.source === "library" ? "library part" : "edits"} from ${PART_LABELS[role]}`
                        : `Clear ${PART_LABELS[role]}`
                    }
                    onClick={() => clearPart(role)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                {playing ? <span className="rhythm-conv-progress" style={{ width: `${progress * 100}%` }} /> : null}
              </div>
            );
          })}
        </div>
      </section>

      {libraryDraft?.from.kind === "role" ? (
        <LibraryDraftForm
          draft={libraryDraft}
          onDraft={setLibraryDraft}
          onSave={() => void saveLibraryDraft()}
          busy={libraryBusy}
          error={libraryError}
          known={knownTags}
          title={`Save ${PART_LABELS[libraryDraft.from.role]} ${
            partLibrary.saveTarget() === "native" ? "to the factory library" : "to your library"
          }`}
        />
      ) : null}

      {editorRole ? (
        <Modal
          title={`Edit ${PART_LABELS[editorRole]}`}
          onClose={() => setEditorRole(null)}
          wide
          className="rhythm-editor-modal"
        >
          <RhythmPartEditor
            label={PART_LABELS[editorRole]}
            color={ROLE_COLOR[editorRole]}
            part={resolvedByRole.get(editorRole) ?? null}
            edited={overrides[editorRole]?.source === "edited"}
            view={editorPrefs.view}
            onView={(view) => setEditorPrefs((p) => ({ ...p, view }))}
            grid={editorPrefs.grid}
            onGrid={(grid) => setEditorPrefs((p) => ({ ...p, grid }))}
            velocity={editorPrefs.velocity}
            onVelocity={(velocity) => setEditorPrefs((p) => ({ ...p, velocity }))}
            playing={previewRole === editorRole}
            progress={progress}
            playhead={editorPlayhead}
            onPlay={() => playPart(previewRole === editorRole ? null : editorRole)}
            onBeginEdit={pushHistory}
            onChange={editPart}
            onCreate={createEmptyPart}
            onPickLibrary={() => openLibrary(editorRole)}
            onUseSelection={selection ? () => assignSelection(editorRole) : undefined}
            selectionLabel={selection ? barRangeText(selection[0], selection[1]) : ""}
            canUndo={history.length > 0}
            onUndo={undo}
            canRedo={future.length > 0}
            onRedo={redo}
            onRevert={revertPart}
          />
        </Modal>
      ) : null}

      {libraryModal ? (
        <Modal
          title={libraryModal.role ? `Part Library · ${PART_LABELS[libraryModal.role]}` : "Part Library"}
          onClose={requestCloseLibrary}
          wide
          className="rhythm-library-modal"
        >
          {libraryDraft?.from.kind === "existing" ? (
            <LibraryDraftForm
              draft={libraryDraft}
              onDraft={setLibraryDraft}
              onSave={() => void saveLibraryDraft()}
              busy={libraryBusy}
              error={libraryError}
              known={knownTags}
              title={`Edit "${libraryDraft.from.part.name}"`}
            />
          ) : null}
          <RhythmLibraryPanel
            key={libraryModal.role ?? "all"}
            targetRole={libraryModal.role}
            parts={libraryAll}
            infoText={LIBRARY_TEXT}
            devTarget={partLibrary.saveTarget() === "native"}
            busy={libraryBusy}
            previewId={libraryPreviewId}
            progress={progress}
            onPreview={playLibraryPart}
            onUse={applyLibraryPart}
            onEdit={startLibraryEdit}
            onDelete={(p) => void deleteLibraryPart(p)}
            onExport={exportLibrary}
            onImport={() => libraryImportRef.current?.click()}
            hasUserParts={library.user.length > 0}
          />
        </Modal>
      ) : null}
      {rhythmModal ? (
        <Modal title="Rhythm Library" onClose={requestCloseRhythmModal} wide className="rhythm-library-modal">
          {rhythmDraft ? (
            <RhythmDraftForm
              draft={rhythmDraft}
              onDraft={setRhythmDraft}
              onSave={() => void saveRhythmDraft()}
              busy={libraryBusy}
              known={libraryTags(rhythmAll)}
              error={rhythmError}
            />
          ) : pedalImport ? (
            <PedalImportForm
              value={pedalImport}
              onChange={setPedalImport}
              onImport={() => void confirmPedalImport()}
              onCancel={() => setPedalImport(null)}
              busy={libraryBusy}
              kitLabel={(k) => RHYTHM_KITS[k] ?? `Kit ${k + 1}`}
            />
          ) : null}
          {!rhythmDraft && rhythmError ? (
            <p className="drum-pad-hint warn" role="alert">
              {rhythmError}
            </p>
          ) : null}
          <RhythmPresetLibrary
            rhythms={rhythmAll}
            infoText={RHYTHM_LIBRARY_TEXT}
            devTarget={rhythmLibrary.saveTarget() === "native"}
            busy={libraryBusy}
            kitLabel={(k) => RHYTHM_KITS[k] ?? `Kit ${k + 1}`}
            previewId={rhythmPreviewId}
            progress={progress}
            canSaveCurrent={resolved.length > 0}
            canWritePedal={!dirHandle || !writeBlockedReason}
            sendLabel={dirHandle ? "Save to RC-600" : "Add to Offline Slots"}
            writeTitle={
              !dirHandle
                ? "No RC-600 connected: adds them to the offline slot list (RC-600 Slots); download RHYTHM.RC0 there when you are done."
                : (writeBlockedReason ?? undefined)
            }
            onPreview={(id) => {
              stopPlayback();
              setRhythmPreviewId(id);
            }}
            onLoad={loadRhythm}
            onSaveCurrent={startRhythmSave}
            onEdit={(r) => {
              setRhythmError(null);
              setRhythmDraft({ existing: r, name: r.name, tags: [...r.tags], withParts: false });
            }}
            onDelete={(r) => void deleteRhythm(r)}
            onExport={() =>
              downloadBytes(
                new TextEncoder().encode(rhythmLibrary.exportUser()),
                "rc600-rhythms.json",
                "application/json",
              )
            }
            onImport={() => rhythmImportRef.current?.click()}
            onImportPedal={() => void startPedalImport()}
            hasUserRhythms={rhythms.user.length > 0}
            onSendToPedal={(list) => void sendRhythmsToPedal(list)}
            onDownload={(list) => void downloadRhythms(list)}
          />
        </Modal>
      ) : null}
      <input
        ref={pedalFileRef}
        type="file"
        accept=".RC0,.rc0"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importPedalFile(file);
        }}
      />
      <input
        ref={rhythmImportRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importRhythms(file);
        }}
      />
      <input
        ref={libraryImportRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importLibrary(file);
        }}
      />

      <div className="rhythm-settings">
        {score ? (
          <section
            className={`rhythm-settings-panel${panelOpen("options") ? "" : " is-collapsed"}`}
            aria-label="Conversion options"
          >
            <SettingsPanelHead
              id="rc-conv-options-list"
              title="Options"
              open={panelOpen("options")}
              summary={[
                QUANTIZE_OPTIONS.find((o) => o.value === options.quantize)?.label,
                `Velocity ${options.velocityScale}%`,
                options.fillLength === "half" ? "Half Bar fill" : "1 Bar fill",
                options.humanize ? "Humanize" : null,
              ]}
              onToggle={() => togglePanel("options")}
            />
            {panelOpen("options") ? (
              <div className="rhythm-settings-list" id="rc-conv-options-list">
                <div className="rhythm-setting">
                  <div className="param-label">
                    <label htmlFor="rc-conv-quantize">Quantize</label>
                    <InfoTip
                      label="Quantize"
                      text="Moves every hit to the nearest step of this grid. Off keeps the timing from the score. Use a triplet grid for shuffle and 6/8 feels."
                    />
                  </div>
                  <select
                    id="rc-conv-quantize"
                    value={options.quantize}
                    onChange={(e) => patchOptions({ quantize: e.target.value as QuantizeGrid })}
                  >
                    {QUANTIZE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rhythm-setting">
                  <div className="param-label">
                    <label htmlFor="rc-conv-velocity">Velocity</label>
                    <InfoTip
                      label="Velocity"
                      text="Scales how hard every hit is played, from 50% to 150% of the score dynamics. Ghost notes stay softer than accents."
                    />
                  </div>
                  <div className="rhythm-setting-slider">
                    <input
                      id="rc-conv-velocity"
                      type="range"
                      min={50}
                      max={150}
                      step={5}
                      value={options.velocityScale}
                      onChange={(e) => patchOptions({ velocityScale: Number(e.target.value) })}
                    />
                    <span className="param-val">{options.velocityScale}%</span>
                  </div>
                </div>
                <div className="rhythm-setting">
                  <div className="param-label">
                    <label htmlFor="rc-conv-fill">Fill Length</label>
                    <InfoTip
                      label="Fill Length"
                      text="1 Bar exports the whole fill bar. Half Bar plays the variation groove for the first half and the fill for the second half, as with a short fill."
                    />
                  </div>
                  <select
                    id="rc-conv-fill"
                    value={options.fillLength}
                    onChange={(e) => patchOptions({ fillLength: e.target.value as FillLength })}
                  >
                    <option value="bar">1 Bar</option>
                    <option value="half">Half Bar</option>
                  </select>
                </div>
                <div className="rhythm-setting">
                  <div className="param-label">
                    <label htmlFor="rc-conv-humanize">Humanize</label>
                    <InfoTip
                      label="Humanize"
                      text="Adds small timing and velocity changes so a quantized part feels less mechanical. The same file always gives the same result."
                    />
                  </div>
                  <OptionSwitch
                    id="rc-conv-humanize"
                    checked={options.humanize}
                    onChange={(humanize) => patchOptions({ humanize })}
                  />
                </div>
                <div className="rhythm-setting">
                  <div className="param-label">
                    <label htmlFor="rc-conv-drop">Kit Notes Only</label>
                    <InfoTip
                      label="Kit Notes Only"
                      text="Guitar Pro extras such as rim shots, half-open hi-hats and choked cymbals are always mapped to the closest RC-600 kit sound. ON also drops notes the kit cannot play (metronome clicks, effects). OFF keeps them as they are."
                    />
                  </div>
                  <OptionSwitch
                    id="rc-conv-drop"
                    checked={options.dropNonKit}
                    onChange={(dropNonKit) => patchOptions({ dropNonKit })}
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          className={`rhythm-settings-panel${panelOpen("rhythm") ? "" : " is-collapsed"}`}
          aria-label="Save to RC-600"
        >
          <SettingsPanelHead
            id="rc-conv-rhythm-list"
            title="RC-600 Rhythm"
            open={panelOpen("rhythm")}
            summary={[
              patternName.trim() || null,
              RHYTHM_KITS[kit],
              slot === NEW_SLOT ? `New Slot ${(pedalNames?.length ?? 0) + 1}` : `Slot ${slot + 1}`,
            ]}
            onToggle={() => togglePanel("rhythm")}
          >
            <InfoTip label="Saving to the RC-600" text={SAVE_TEXT} />
          </SettingsPanelHead>
          {panelOpen("rhythm") ? (
            <div className="rhythm-settings-list" id="rc-conv-rhythm-list">
              <div className="rhythm-setting">
                <div className="param-label">
                  <label htmlFor="rc-conv-name">Name</label>
                  <InfoTip
                    label="Name"
                    text={`Shown on the RC-600 for this user rhythm. Up to ${PATTERN_NAME_MAX} plain letters, digits and symbols.`}
                  />
                </div>
                <input
                  id="rc-conv-name"
                  type="text"
                  maxLength={PATTERN_NAME_MAX}
                  value={patternName}
                  onChange={(e) => setPatternName(e.target.value)}
                />
              </div>
              <div className="rhythm-setting">
                <div className="param-label">
                  <label htmlFor="rc-conv-kit">Kit</label>
                  <InfoTip
                    label="Kit"
                    text={`Default drum kit saved with the rhythm; the RC-600 plays it whenever this rhythm is selected, and you can still change Kit per memory on the pedal. With Sound set to RC-600 Kit (MIDI), playback switches the pedal to this kit. Suggested: picked from the imported song's Variation bars (tempo, swing, ride vs hi-hat, kick pattern, Latin percussion). A new file sets the suggested kit until you choose one yourself.${
                      kitGuess ? ` For this song: ${kitGuess.reason}` : ""
                    }`}
                  />
                </div>
                <div className="rhythm-setting-control">
                  <select
                    id="rc-conv-kit"
                    value={kit}
                    onChange={(e) => {
                      setKitAuto(false);
                      setKit(Number(e.target.value));
                    }}
                  >
                    {RHYTHM_KITS.map((label, value) => (
                      <option key={label} value={value}>
                        {kitGuess?.kit === value ? `${label} (Suggested)` : label}
                      </option>
                    ))}
                  </select>
                  {kitGuess ? (
                    <span className="rhythm-kit-guess" title={kitGuess.reason}>
                      <Icon name="autoFix" size={14} />
                      {kit === kitGuess.kit ? (
                        <>Suggested for this song</>
                      ) : (
                        <>
                          Suggested: <strong>{RHYTHM_KITS[kitGuess.kit]}</strong>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => {
                              setKit(kitGuess.kit);
                              setKitAuto(true);
                            }}
                          >
                            Use
                          </button>
                        </>
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="rhythm-setting">
                <div className="param-label">
                  <label htmlFor="rc-conv-slot">Slot</label>
                  <InfoTip
                    label="Slot"
                    text={`User rhythm slot to write. New Slot appends after the existing ones (up to ${MAX_USER_PATTERNS}); picking a used slot replaces that rhythm. The list comes from RC-600 Slots below: the open RC-600 drive, or the offline list when the pedal is not connected.`}
                  />
                </div>
                <select id="rc-conv-slot" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
                  {(pedalNames?.length ?? 0) < MAX_USER_PATTERNS ? (
                    <option value={NEW_SLOT}>New Slot ({(pedalNames?.length ?? 0) + 1})</option>
                  ) : null}
                  {(pedalNames ?? []).map((name, i) => (
                    <option key={i} value={i}>
                      {`Replace ${i + 1}: ${name || "(no name)"}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <RhythmSlotManager
        mode={dirHandle ? "drive" : "offline"}
        origin={slotList?.origin ?? null}
        slots={slotInfos}
        dirty={slotList?.dirty ?? false}
        target={slot}
        newSlot={NEW_SLOT}
        previewId={rhythmPreviewId}
        progress={progress}
        busy={saving}
        writeBlocked={writeBlockedReason ?? undefined}
        kitLabel={(k) => RHYTHM_KITS[k] ?? `Kit ${k + 1}`}
        onOpenFile={() => slotFileRef.current?.click()}
        onStartEmpty={() => void startEmptySlots()}
        onCloseList={() => void closeSlotList()}
        onReload={() => void runSlotChange(readDriveSlots)}
        onDownload={() => void downloadSlots()}
        onPreview={(id) => {
          stopPlayback();
          setRhythmPreviewId(id);
        }}
        onLoad={loadSlot}
        onRename={renameSlot}
        onMove={moveSlot}
        onDelete={deleteSlot}
        onTarget={setSlot}
        onSaveToLibrary={startSlotRhythmSave}
        offline={
          offlineCopy
            ? { count: offlineCopy.records.length, origin: offlineCopy.origin, dirty: offlineCopy.dirty }
            : null
        }
        onSendOffline={(mode) => void sendOfflineToPedal(mode)}
        onCopyToOffline={() => void copyPedalToOffline()}
        onConnectUsb={onConnectUsb}
        onBackupDone={onBackupDone}
      />
      <input
        ref={slotFileRef}
        type="file"
        accept=".rc0,.RC0"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void openSlotFile(file);
        }}
      />

      <footer className="rhythm-conv-footer">
        <button
          type="button"
          className="btn primary"
          onClick={() => void saveToSlot()}
          disabled={!resolved.length || (Boolean(dirHandle) && Boolean(writeBlockedReason)) || saving}
          title={
            dirHandle
              ? (writeBlockedReason ?? "Write this rhythm to the RC-600 drive")
              : "No RC-600 connected: saves into the offline slot list; download RHYTHM.RC0 under RC-600 Slots when you are done"
          }
        >
          <Icon name={dirHandle ? "upload" : "save"} size={14} />
          {saving
            ? "Saving…"
            : `${dirHandle ? "Save to RC-600" : "Save to Offline Slot"} ${slot === NEW_SLOT ? (pedalNames?.length ?? 0) + 1 : slot + 1}`}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!resolved.length}
          onClick={() => {
            setRhythmModal(true);
            startRhythmSave();
          }}
        >
          <Icon name="save" size={14} />
          Save to Rhythm Library…
        </button>
        <button type="button" className="btn" onClick={() => void exportPack()}>
          <Icon name="download" size={14} />
          Export ZIP
        </button>
        <InfoTip label="Importing into the RC-600" text={IMPORT_TEXT} />
        {status ? <span className="rhythm-conv-status">{status}</span> : null}
      </footer>
    </div>
  );
}

/** First/Last Bar fields for the bar selection; applies on Enter or when a field loses focus. */
function PartRangeInputs({
  range,
  barCount,
  onSet,
}: {
  range: { start: number; end: number } | null;
  barCount: number;
  onSet: (start: number, end: number) => void;
}) {
  const [first, setFirst] = useState(range ? String(range.start + 1) : "");
  const [last, setLast] = useState(range ? String(range.end) : "");

  function commit() {
    const a = Math.round(Number(first));
    const b = Math.round(Number(last || first));
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b < 1) return;
    const lo = Math.min(barCount, Math.min(a, b));
    const hi = Math.min(barCount, Math.max(a, b));
    if (range && range.start === lo - 1 && range.end === hi) return;
    onSet(lo - 1, hi);
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <input
      type="number"
      aria-label={label}
      title={label}
      min={1}
      max={barCount}
      value={value}
      placeholder="—"
      onChange={(e) => set(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );

  return (
    <span className={`rhythm-song-field${range ? " is-set" : ""}`} role="group" aria-label="Selected bars">
      <span>Bars</span>
      {field("First Bar", first, setFirst)}
      <span className="rhythm-song-field-dash">–</span>
      {field("Last Bar", last, setLast)}
    </span>
  );
}

/** Collapsible settings panel title; folded panels show their current values as a one-line summary. */
function SettingsPanelHead({
  id,
  title,
  open,
  summary,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  summary: (string | null | undefined)[];
  onToggle: () => void;
  children?: ReactNode;
}) {
  const text = summary.filter(Boolean).join(" · ");
  return (
    <div className="rhythm-settings-head">
      <h3>{title}</h3>
      {children}
      {!open && text ? <span className="rhythm-settings-summary">{text}</span> : null}
      <button
        type="button"
        className="btn ghost rhythm-settings-toggle"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
        title={open ? `Collapse ${title}` : `Expand ${title}`}
        onClick={onToggle}
      >
        <Icon name="chevronDown" size={18} />
      </button>
    </div>
  );
}

/** Compact switch chip for the bar strip view options, with the number of bars it hides. */
function ViewToggle({
  id,
  label,
  count,
  checked,
  title,
  onChange,
}: {
  id: string;
  label: string;
  count: number;
  checked: boolean;
  title: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className={`rhythm-view-toggle${checked ? " is-on" : ""}`}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span className="rhythm-view-toggle-track">
        <span className="rhythm-view-toggle-thumb" />
      </span>
      {label}
      {count ? <span className="rhythm-view-toggle-count">{count}</span> : null}
    </button>
  );
}

function OptionSwitch({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      className={`power-switch${checked ? " on" : ""}`}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="power-switch-track">
        <span className="power-switch-thumb" />
      </span>
      <span className="power-switch-state">{checked ? "ON" : "OFF"}</span>
    </button>
  );
}
