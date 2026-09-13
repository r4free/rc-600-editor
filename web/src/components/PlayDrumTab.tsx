import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  DRUM_INSTRUMENTS,
  MAX_PAD_COUNT,
  MIN_PAD_COUNT,
  PAD_SLOT_COUNT,
  clampDrumNote,
  clampMidiChannel,
  clampPadCount,
  drumLabelForNote,
  notesForPadCount,
  padGridMetrics,
  padIdsForCount,
} from "../drumMap";
import {
  DEFAULT_GLOBAL_BPM,
  STEPS_PER_BAR,
  TIME_SIGNATURES,
  clampHitsPerBar,
  evenDistributeHits,
  resolvePadVelocity,
  type PadTimingOverride,
  type TimeSignature,
} from "../drumLoop";
import { usePadLoopEngine } from "../usePadLoopEngine";
import {
  emptyDrumPresetPayload,
  overridesToPadMap,
  padMapToOverrides,
  parseDrumPresetPayload,
  payloadForKit,
  type DrumPreset,
  type DrumPresetPayload,
} from "../presets/drumPreset";
import {
  DEFAULT_KIT_ID,
  factoryDrumKits,
  findKit,
  kitFromNotes,
  kitsEqualLayout,
  type DrumKit,
} from "../presets/drumKit";
import { browserKitRepository } from "../presets/kitRepository";
import { DrumKitGallery } from "./DrumKitGallery";
import { DrumPresetGallery } from "./DrumPresetGallery";
import { Icon } from "./Icon";

const PAD_COUNT_OPTIONS = Array.from(
  { length: MAX_PAD_COUNT - MIN_PAD_COUNT + 1 },
  (_, i) => i + MIN_PAD_COUNT,
);
const PLAY_DRUM_PREFS_KEY = "rc600.playDrum.prefs";
/** RC-600 ignores ~0 ms notes; keep a one-shot gate even on tap. */
const MIN_PAD_GATE_MS = 90;

interface PlayDrumPrefs extends DrumPresetPayload {
  kitId: string;
  kitName: string;
  padCount: number;
  showSettings: boolean;
  galleryCollapsed: boolean;
  kitGalleryCollapsed: boolean;
}

function loadPlayDrumPrefs(): PlayDrumPrefs {
  const empty = emptyDrumPresetPayload();
  const fallback: PlayDrumPrefs = {
    ...empty,
    kitId: DEFAULT_KIT_ID,
    kitName: "Studio",
    padCount: empty.notes.length,
    showSettings: false,
    galleryCollapsed: false,
    kitGalleryCollapsed: false,
  };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PLAY_DRUM_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayDrumPrefs>;
    const payload = parseDrumPresetPayload(parsed);
    const padCount = clampPadCount(parsed.padCount ?? payload.notes.length);
    return {
      ...payload,
      kitId: typeof parsed.kitId === "string" && parsed.kitId.trim() ? parsed.kitId.trim() : DEFAULT_KIT_ID,
      kitName: typeof parsed.kitName === "string" && parsed.kitName.trim() ? parsed.kitName.trim() : "Studio",
      padCount,
      showSettings: parsed.showSettings === true,
      galleryCollapsed: parsed.galleryCollapsed === true,
      kitGalleryCollapsed: parsed.kitGalleryCollapsed === true,
    };
  } catch {
    return fallback;
  }
}

function savePlayDrumPrefs(patch: Partial<PlayDrumPrefs>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const next = { ...loadPlayDrumPrefs(), ...patch };
    localStorage.setItem(PLAY_DRUM_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function PlayDrumTab({
  midiLinked,
  midiOutHint,
  usbStorageActive,
  onEjectUsb,
  rhythmChannel,
  onPlayNotes,
  onSilence,
  onRequestMidi,
  memories = [],
  currentSlot = null,
  onSelectMemory,
}: {
  midiLinked: boolean;
  midiOutHint?: string;
  usbStorageActive?: boolean;
  onEjectUsb?: () => void;
  /** 0-based MIDI channel shown in status (MIDI bar Rx CH). */
  rhythmChannel: number;
  onPlayNotes: (notes: readonly number[], velocity: number, down: boolean) => void;
  onSilence?: () => void;
  onRequestMidi?: () => void;
  memories?: { slot: number; name: string }[];
  currentSlot?: number | null;
  onSelectMemory?: (slot: number) => void;
}) {
  const initial = useMemo(() => loadPlayDrumPrefs(), []);
  const kitRepo = useMemo(() => browserKitRepository(), []);
  const [velocity, setVelocity] = useState(initial.velocity);
  const [activePads, setActivePads] = useState<Set<number>>(() => new Set());
  const [globalBpm, setGlobalBpm] = useState(initial.bpm);
  const [globalMeter, setGlobalMeter] = useState<TimeSignature>(initial.meter);
  const [drumPadNotes, setDrumPadNotes] = useState<number[]>(() =>
    notesForPadCount(initial.notes, PAD_SLOT_COUNT),
  );
  const [padCount, setPadCount] = useState(initial.padCount);
  const [kitId, setKitId] = useState(initial.kitId);
  const [kitName, setKitName] = useState(initial.kitName);
  const [kits, setKits] = useState<DrumKit[]>(() => factoryDrumKits());
  const [kitRev, setKitRev] = useState(0);
  const [padOverrides, setPadOverrides] = useState<Record<number, PadTimingOverride>>(
    () => overridesToPadMap(initial.overrides),
  );
  const [showPadSettings, setShowPadSettings] = useState(initial.showSettings);
  const [galleryCollapsed, setGalleryCollapsed] = useState(initial.galleryCollapsed);
  const [kitGalleryCollapsed, setKitGalleryCollapsed] = useState(initial.kitGalleryCollapsed);
  const [stageMode, setStageMode] = useState(false);
  const [lastMidi, setLastMidi] = useState<string | null>(null);

  const heldRef = useRef(new Map<number, number>());
  const soundingRef = useRef(new Map<number, number[]>());
  const pointerUnbindRef = useRef(new Map<number, () => void>());
  const downAtRef = useRef(new Map<number, number>());
  const pendingOffRef = useRef(new Map<number, number>());
  const velocityRef = useRef(velocity);
  velocityRef.current = velocity;

  const channel = clampMidiChannel(rhythmChannel);
  const channelLabel = `Ch.${channel + 1}`;

  const emitNotes = useCallback(
    (notes: readonly number[], vel: number, down: boolean) => {
      onPlayNotes(notes, vel, down);
      const n = notes[0];
      if (n == null) return;
      setLastMidi(
        down
          ? `Note On ${channelLabel} #${n} vel ${vel}`
          : `Note Off ${channelLabel} #${n}`,
      );
    },
    [channelLabel, onPlayNotes],
  );

  function clearPendingOff(padId: number) {
    const t = pendingOffRef.current.get(padId);
    if (t != null) {
      clearTimeout(t);
      pendingOffRef.current.delete(padId);
    }
  }

  function unbindPointer(pointerId: number) {
    const unbind = pointerUnbindRef.current.get(pointerId);
    if (unbind) {
      unbind();
      pointerUnbindRef.current.delete(pointerId);
    }
  }

  function bindPointerRelease(pointerId: number, onRelease: () => void) {
    unbindPointer(pointerId);
    const handler = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      unbindPointer(pointerId);
      onRelease();
    };
    window.addEventListener("pointerup", handler, true);
    window.addEventListener("pointercancel", handler, true);
    pointerUnbindRef.current.set(pointerId, () => {
      window.removeEventListener("pointerup", handler, true);
      window.removeEventListener("pointercancel", handler, true);
    });
  }

  const padIds = useMemo(() => padIdsForCount(padCount), [padCount]);
  const gridMetrics = useMemo(() => padGridMetrics(padCount), [padCount]);
  const visibleNotes = useMemo(
    () => notesForPadCount(drumPadNotes, padCount),
    [drumPadNotes, padCount],
  );

  const fireDrumNote = useCallback(
    (note: number, vel: number, down: boolean) => {
      emitNotes([note], vel, down);
    },
    [emitNotes],
  );

  const loop = usePadLoopEngine({
    open: true,
    padIds,
    padNotes: drumPadNotes,
    globalTiming: { bpm: globalBpm, meter: globalMeter },
    padOverrides,
    velocity,
    onDrumNote: fireDrumNote,
  });

  useEffect(() => {
    savePlayDrumPrefs({
      notes: visibleNotes,
      bpm: globalBpm,
      meter: globalMeter,
      velocity,
      overrides: padMapToOverrides(padOverrides),
      kitId,
      kitName,
      padCount,
      showSettings: showPadSettings,
      galleryCollapsed,
      kitGalleryCollapsed,
    });
  }, [
    visibleNotes,
    globalBpm,
    globalMeter,
    velocity,
    padOverrides,
    kitId,
    kitName,
    padCount,
    showPadSettings,
    galleryCollapsed,
    kitGalleryCollapsed,
  ]);

  const midiLive = midiLinked && !usbStorageActive;

  const flushPads = useCallback(
    (silenceChannel: boolean) => {
      for (const padId of [...pendingOffRef.current.keys()]) clearPendingOff(padId);
      for (const padId of heldRef.current.values()) {
        const notes = soundingRef.current.get(padId) ?? [clampDrumNote(drumPadNotes[padId] ?? 36)];
        emitNotes(notes, 0, false);
      }
      heldRef.current.clear();
      soundingRef.current.clear();
      downAtRef.current.clear();
      for (const pointerId of [...pointerUnbindRef.current.keys()]) {
        unbindPointer(pointerId);
      }
      setActivePads(new Set());
      if (silenceChannel) onSilence?.();
    },
    [drumPadNotes, emitNotes, onSilence],
  );

  const flushPadsRef = useRef(flushPads);
  flushPadsRef.current = flushPads;

  useEffect(() => {
    return () => {
      flushPadsRef.current(true);
    };
  }, []);

  useEffect(() => {
    if (!stageMode) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setStageMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stageMode]);

  function markActive(padId: number, on: boolean) {
    setActivePads((prev) => {
      const next = new Set(prev);
      if (on) next.add(padId);
      else next.delete(padId);
      return next;
    });
  }

  function pressDrum(pointerId: number, padId: number) {
    if (usbStorageActive) return;
    if (heldRef.current.has(pointerId)) return;
    heldRef.current.set(pointerId, padId);
    clearPendingOff(padId);
    downAtRef.current.set(padId, performance.now());
    markActive(padId, true);
    const midi = clampDrumNote(drumPadNotes[padId] ?? 36);
    soundingRef.current.set(padId, [midi]);
    emitNotes([midi], resolvePadVelocity(velocityRef.current, padOverrides[padId]), true);
    bindPointerRelease(pointerId, () => releaseDrum(pointerId));
  }

  function releaseDrum(pointerId: number) {
    unbindPointer(pointerId);
    const padId = heldRef.current.get(pointerId);
    if (padId === undefined) return;
    heldRef.current.delete(pointerId);
    const stillHeld = [...heldRef.current.values()].includes(padId);
    if (!stillHeld) {
      markActive(padId, false);
      const notes = soundingRef.current.get(padId) ?? [clampDrumNote(drumPadNotes[padId] ?? 36)];
      soundingRef.current.delete(padId);
      const started = downAtRef.current.get(padId) ?? performance.now();
      downAtRef.current.delete(padId);
      const wait = Math.max(0, MIN_PAD_GATE_MS - (performance.now() - started));
      const fireOff = () => {
        pendingOffRef.current.delete(padId);
        emitNotes(notes, 0, false);
      };
      if (wait === 0) fireOff();
      else pendingOffRef.current.set(padId, window.setTimeout(fireOff, wait));
    }
  }

  const currentPayload: DrumPresetPayload = useMemo(
    () =>
      payloadForKit(
        {
          notes: visibleNotes,
          bpm: globalBpm,
          meter: globalMeter,
          velocity,
          overrides: padMapToOverrides(padOverrides),
        },
        padCount,
      ),
    [visibleNotes, globalBpm, globalMeter, velocity, padOverrides, padCount],
  );

  const refreshKits = useCallback(async () => {
    const listed = await kitRepo.list();
    setKits([...listed.native, ...listed.user]);
  }, [kitRepo]);

  useEffect(() => {
    void refreshKits();
  }, [refreshKits, kitRev]);

  function applyKit(kit: DrumKit) {
    setKitId(kit.id);
    setKitName(kit.name);
    setPadCount(kit.padCount);
    setDrumPadNotes(notesForPadCount(kit.notes, PAD_SLOT_COUNT));
  }

  function applyPreset(preset: DrumPreset) {
    const kit =
      findKit(kits, preset.kitId) ??
      kitFromNotes(
        preset.payload.notes,
        preset.payload.notes.length,
        preset.kitId || DEFAULT_KIT_ID,
      );
    applyKit(kit);
    const p = preset.payload;
    setGlobalBpm(p.bpm);
    setGlobalMeter(p.meter);
    setVelocity(p.velocity);
    setPadOverrides(overridesToPadMap(p.overrides));
  }

  function setVisiblePadCount(next: number) {
    setPadCount(clampPadCount(next));
    setDrumPadNotes((prev) => notesForPadCount(prev, PAD_SLOT_COUNT));
  }

  async function persistKitIfDirty(): Promise<string> {
    const listed = await kitRepo.list();
    const all = [...listed.native, ...listed.user];
    setKits(all);
    const selected = findKit(all, kitId);
    if (selected && kitsEqualLayout(selected, visibleNotes, padCount)) return selected.id;
    const target = kitRepo.saveTarget();
    const reuseId =
      selected && selected.source === target && selected.source === "user" ? selected.id : undefined;
    const saved = await kitRepo.save({
      name: selected?.name ?? kitName,
      padCount,
      notes: visibleNotes,
      id: reuseId,
    });
    setKitId(saved.id);
    setKitName(saved.name);
    setKitRev((n) => n + 1);
    return saved.id;
  }

  function setHits(padId: number, hits: number) {
    const n = clampHitsPerBar(hits);
    setPadOverrides((prev) => ({
      ...prev,
      [padId]: { ...prev[padId], hitsPerBar: n },
    }));
  }

  function setPadVelocity(padId: number, next: number | null) {
    setPadOverrides((prev) => ({
      ...prev,
      [padId]: { ...prev[padId], velocity: next },
    }));
  }

  function setDrumInstrument(padId: number, note: number) {
    const n = clampDrumNote(note);
    setDrumPadNotes((prev) => {
      const next = [...prev];
      next[padId] = n;
      return next;
    });
  }

  return (
    <div
      className={`play-drum-body${usbStorageActive ? " is-storage-blocked" : ""}${
        stageMode ? " is-stage" : ""
      }`}
    >
      {usbStorageActive ? (
        <p className="drum-pad-hint warn">
          Play Drum is USB MIDI only. STORAGE is ON, so the RC-600 cannot receive notes or Program
          Change. Click <strong>Eject USB</strong>, wait until the pedal leaves DISCONNECTING, set
          MENU → USB → STORAGE Off, then Allow MIDI and connect the port named RC-600 (not
          MIDIOUT2).
          {onEjectUsb ? (
            <>
              {" "}
              <button type="button" className="btn primary" onClick={onEjectUsb}>
                Eject USB
              </button>
            </>
          ) : null}
        </p>
      ) : !midiLinked ? (
        <p className="drum-pad-hint warn">
          MIDI not connected — pads animate locally but no notes leave the browser.{" "}
          {onRequestMidi ? (
            <button type="button" className="btn primary" onClick={onRequestMidi}>
              Allow MIDI
            </button>
          ) : (
            "Allow MIDI in the top bar first."
          )}{" "}
          STORAGE must be OFF on the pedal (MENU → USB → STORAGE Off).
        </p>
      ) : (
        <p className="drum-pad-hint">
          Notes go to every RC-600 USB port on {channelLabel}
          {midiOutHint ? ` (linked ${midiOutHint})` : ""}. Set Rx CH to the pedal
          (Rx CTL / Rx Rhythm — you are on {channelLabel}). Memory follows that
          channel. Play Drum kits are pad layouts (count and instruments); the pedal
          still uses the kit in the current memory.
          {lastMidi ? ` Last send: ${lastMidi}.` : ""}
        </p>
      )}

      <DrumKitGallery
        kit={{ name: kitName, padCount, notes: visibleNotes }}
        selectedId={kitId}
        revision={kitRev}
        collapsed={kitGalleryCollapsed}
        onCollapsedChange={setKitGalleryCollapsed}
        onBeforeLoad={() => loop.stopAll()}
        onLoad={applyKit}
        onPadCountChange={setVisiblePadCount}
        onSaved={(saved) => {
          setKitId(saved.id);
          setKitName(saved.name);
          setPadCount(saved.padCount);
          setDrumPadNotes(notesForPadCount(saved.notes, PAD_SLOT_COUNT));
          setKitRev((n) => n + 1);
        }}
      />

      <DrumPresetGallery
        payload={currentPayload}
        kitId={kitId}
        kits={kits}
        collapsed={galleryCollapsed}
        onCollapsedChange={setGalleryCollapsed}
        onBeforeLoad={() => loop.stopAll()}
        onEnsureKit={() => persistKitIfDirty()}
        onLoad={applyPreset}
      />

      <div className="drum-pad-transport" role="group" aria-label="Global loop">
        {memories.length > 0 ? (
          <label className="drum-pad-field drum-pad-memory-field">
            <span>Memory</span>
            <select
              value={currentSlot ?? ""}
              aria-label="Memory"
              disabled={!midiLive}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next) || next < 1) return;
                loop.stopAll();
                onSilence?.();
                onSelectMemory?.(next);
              }}
            >
              {memories.map((m) => (
                <option key={m.slot} value={m.slot}>
                  {String(m.slot).padStart(2, "0")} {m.name || "—"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="drum-pad-field">
          <span>Pads</span>
          <select
            value={padCount}
            aria-label="Pad count"
            onChange={(e) => setVisiblePadCount(Number(e.target.value))}
          >
            {PAD_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="drum-pad-field">
          <span>BPM</span>
          <input
            type="number"
            min={20}
            max={300}
            value={globalBpm}
            onChange={(e) => setGlobalBpm(Number(e.target.value) || DEFAULT_GLOBAL_BPM)}
          />
        </label>
        <label className="drum-pad-field">
          <span>Meter</span>
          <select
            value={globalMeter}
            onChange={(e) => setGlobalMeter(e.target.value as TimeSignature)}
          >
            {TIME_SIGNATURES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => loop.playAll()}>
          <Icon name="play" />
          Play All
        </button>
        <button type="button" className="btn ghost" onClick={() => loop.stopAll()}>
          <Icon name="stop" />
          Stop All
        </button>
        <button
          type="button"
          className={`btn ghost${showPadSettings ? " is-on" : ""}`}
          aria-pressed={showPadSettings}
          onClick={() => setShowPadSettings((v) => !v)}
        >
          <Icon name="tune" />
          {showPadSettings ? "Hide pad settings" : "Show pad settings"}
        </button>
        <button
          type="button"
          className={`btn ghost${stageMode ? " is-on" : ""}`}
          aria-pressed={stageMode}
          aria-label={stageMode ? "Exit full screen" : "Full screen"}
          title={stageMode ? "Exit full screen (Esc)" : "Play Drum fills the screen"}
          onClick={() => setStageMode((v) => !v)}
        >
          <Icon name={stageMode ? "fullscreenExit" : "fullscreen"} />
          {stageMode ? "Exit full screen" : "Full screen"}
        </button>
        <label className="drum-pad-velocity drum-pad-velocity-inline">
          <span>Vel</span>
          <input
            type="range"
            min={1}
            max={127}
            value={velocity}
            onChange={(e) => setVelocity(Number(e.target.value))}
          />
          <span className="drum-pad-vel-val">{velocity}</span>
        </label>
      </div>

      <div
        className={`drum-pad-grid${showPadSettings ? " with-settings" : ""}`}
        role="group"
        aria-label="Drum pads"
        style={
          {
            "--pad-cols": String(gridMetrics.cols),
            "--pad-rows": String(gridMetrics.rows),
          } as CSSProperties
        }
      >
        {padIds.map((padId) => {
          const midi = clampDrumNote(drumPadNotes[padId] ?? 36);
          const label = drumLabelForNote(midi);
          const isDown = activePads.has(padId);
          const isLooping = loop.isPlaying(padId);
          const hits = padOverrides[padId]?.hitsPerBar ?? 0;
          const lit = new Set(evenDistributeHits(hits));
          const localVel = padOverrides[padId]?.velocity;
          const padVel = resolvePadVelocity(velocity, padOverrides[padId]);
          const inheritsVel = localVel == null;
          return (
            <div
              key={padId}
              className={`drum-pad-cell${isLooping ? " is-looping" : ""}${
                showPadSettings ? " with-config" : ""
              }`}
            >
              {showPadSettings ? (
                <div className="drum-pad-settings">
                  <select
                    className="drum-pad-inst-select"
                    aria-label={`Pad ${padId + 1} instrument`}
                    value={midi}
                    onChange={(e) => setDrumInstrument(padId, Number(e.target.value))}
                  >
                    {DRUM_INSTRUMENTS.map((inst) => (
                      <option key={inst.note} value={inst.note}>
                        {inst.label} ({inst.note})
                      </option>
                    ))}
                    {!DRUM_INSTRUMENTS.some((i) => i.note === midi) ? (
                      <option value={midi}>
                        N{midi} ({midi})
                      </option>
                    ) : null}
                  </select>
                  <div className="drum-pad-hits-row">
                    <span className="drum-pad-vel-tag">Vel</span>
                    <input
                      type="range"
                      className="drum-pad-hits-slider"
                      min={1}
                      max={127}
                      value={padVel}
                      aria-label={`${label} velocity`}
                      onChange={(e) => setPadVelocity(padId, Number(e.target.value))}
                    />
                    <span className="drum-pad-hits-val" title="Velocity">
                      {padVel}
                    </span>
                    <button
                      type="button"
                      className={`drum-pad-play-btn${inheritsVel ? " is-on" : ""}`}
                      aria-pressed={inheritsVel}
                      aria-label={
                        inheritsVel
                          ? `${label} uses global velocity`
                          : `Use global velocity for ${label}`
                      }
                      title={inheritsVel ? "Using global Vel" : "Use global Vel"}
                      onClick={() => setPadVelocity(padId, null)}
                    >
                      G
                    </button>
                  </div>
                  <div className="drum-pad-hits-row">
                    <button
                      type="button"
                      className="drum-pad-hits-btn"
                      aria-label={`Decrease ${label} hits`}
                      onClick={() => setHits(padId, hits - 1)}
                    >
                      −
                    </button>
                    <input
                      type="range"
                      className="drum-pad-hits-slider"
                      min={0}
                      max={STEPS_PER_BAR}
                      value={hits}
                      aria-label={`${label} hits per bar`}
                      onChange={(e) => setHits(padId, Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="drum-pad-hits-btn"
                      aria-label={`Increase ${label} hits`}
                      onClick={() => setHits(padId, hits + 1)}
                    >
                      +
                    </button>
                    <span className="drum-pad-hits-val" title="Hits per bar">
                      {hits}
                    </span>
                    <button
                      type="button"
                      className={`drum-pad-play-btn${isLooping ? " is-on" : ""}`}
                      aria-pressed={isLooping}
                      aria-label={isLooping ? `Stop ${label} loop` : `Play ${label} loop`}
                      onClick={() => loop.togglePad(padId)}
                    >
                      {isLooping ? <Icon name="stop" size={12} /> : <Icon name="play" size={12} />}
                    </button>
                  </div>
                  <div
                    className="drum-pad-steps"
                    aria-hidden="true"
                    title={`${hits} hit(s) evenly across ${STEPS_PER_BAR} steps`}
                  >
                    {Array.from({ length: STEPS_PER_BAR }, (_, i) => (
                      <span key={i} className={`drum-pad-step${lit.has(i) ? " is-on" : ""}`} />
                    ))}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className={`drum-pad${isDown ? " is-down" : ""}${isLooping ? " is-looping" : ""}`}
                aria-pressed={isDown}
                aria-label={`${label} note ${midi}`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* capture not available */
                  }
                  pressDrum(e.pointerId, padId);
                }}
              >
                <span className="drum-pad-label">{label}</span>
                <span className="drum-pad-note">{midi}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
