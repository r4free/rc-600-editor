import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GM_DRUM_INSTRUMENTS,
  PAD_SLOT_COUNT,
  clampDrumNote,
  clampMidiChannel,
  defaultPadNotes,
  drumLabelForNote,
} from "../drumMap";
import {
  DEFAULT_GLOBAL_BPM,
  DEFAULT_GLOBAL_METER,
  STEPS_PER_BAR,
  TIME_SIGNATURES,
  clampBpm,
  clampHitsPerBar,
  evenDistributeHits,
  isTimeSignature,
  type PadTimingOverride,
  type TimeSignature,
} from "../drumLoop";
import { usePadLoopEngine } from "../usePadLoopEngine";
import { Icon } from "./Icon";

const PAD_IDS = Array.from({ length: PAD_SLOT_COUNT }, (_, i) => i);
const PLAY_DRUM_PREFS_KEY = "rc600.playDrum.prefs";
/** RC-600 ignores ~0 ms notes; keep a one-shot gate even on tap. */
const MIN_PAD_GATE_MS = 90;

interface PlayDrumPrefs {
  notes: number[];
  bpm: number;
  meter: TimeSignature;
  velocity: number;
  overrides: Record<string, PadTimingOverride>;
  showSettings: boolean;
}

function loadPlayDrumPrefs(): PlayDrumPrefs {
  const fallback: PlayDrumPrefs = {
    notes: defaultPadNotes(),
    bpm: DEFAULT_GLOBAL_BPM,
    meter: DEFAULT_GLOBAL_METER,
    velocity: 100,
    overrides: {},
    showSettings: false,
  };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PLAY_DRUM_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayDrumPrefs>;
    const notes = Array.isArray(parsed.notes)
      ? PAD_IDS.map((i) => clampDrumNote(Number(parsed.notes?.[i] ?? fallback.notes[i])))
      : fallback.notes;
    const overrides: Record<string, PadTimingOverride> = {};
    if (parsed.overrides && typeof parsed.overrides === "object") {
      for (const [k, v] of Object.entries(parsed.overrides)) {
        if (!v || typeof v !== "object") continue;
        overrides[k] = {
          bpm: typeof v.bpm === "number" ? clampBpm(v.bpm) : v.bpm ?? null,
          meter: v.meter && isTimeSignature(v.meter) ? v.meter : null,
          hitsPerBar: typeof v.hitsPerBar === "number" ? clampHitsPerBar(v.hitsPerBar) : 0,
        };
      }
    }
    return {
      notes,
      bpm: typeof parsed.bpm === "number" ? clampBpm(parsed.bpm) : fallback.bpm,
      meter: parsed.meter && isTimeSignature(parsed.meter) ? parsed.meter : fallback.meter,
      velocity:
        typeof parsed.velocity === "number"
          ? Math.max(1, Math.min(127, Math.round(parsed.velocity)))
          : fallback.velocity,
      overrides,
      showSettings: parsed.showSettings === true,
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

function overridesFromPrefs(raw: Record<string, PadTimingOverride>): Record<number, PadTimingOverride> {
  const out: Record<number, PadTimingOverride> = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (Number.isInteger(id)) out[id] = v;
  }
  return out;
}

export function PlayDrumTab({
  midiLinked,
  midiOutHint,
  usbStorageActive,
  rhythmChannel,
  systemRhythmCh,
  onRhythmChannel,
  onPlayNotes,
  onSilence,
  onRequestMidi,
}: {
  midiLinked: boolean;
  midiOutHint?: string;
  /** True when the ROLAND folder is open — USB Storage usually kills USB MIDI. */
  usbStorageActive?: boolean;
  /** 0-based MIDI channel used for pad notes. */
  rhythmChannel: number;
  /** 1-based Rx Rhythm CH from the loaded SYSTEM file, if any. */
  systemRhythmCh: number | null;
  onRhythmChannel: (channel: number) => void;
  onPlayNotes: (notes: readonly number[], velocity: number, down: boolean) => void;
  onSilence?: () => void;
  onRequestMidi?: () => void;
}) {
  const initial = useMemo(() => loadPlayDrumPrefs(), []);
  const [velocity, setVelocity] = useState(initial.velocity);
  const [activePads, setActivePads] = useState<Set<number>>(() => new Set());
  const [globalBpm, setGlobalBpm] = useState(initial.bpm);
  const [globalMeter, setGlobalMeter] = useState<TimeSignature>(initial.meter);
  const [drumPadNotes, setDrumPadNotes] = useState<number[]>(() => initial.notes);
  const [padOverrides, setPadOverrides] = useState<Record<number, PadTimingOverride>>(
    () => overridesFromPrefs(initial.overrides),
  );
  const [showPadSettings, setShowPadSettings] = useState(initial.showSettings);
  const [lastMidi, setLastMidi] = useState<string | null>(null);

  const heldRef = useRef(new Map<number, number>());
  const soundingRef = useRef(new Map<number, number[]>());
  const pointerUnbindRef = useRef(new Map<number, () => void>());
  const downAtRef = useRef(new Map<number, number>());
  const pendingOffRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
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

  const padIds = useMemo(() => PAD_IDS, []);

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
      notes: drumPadNotes,
      bpm: globalBpm,
      meter: globalMeter,
      velocity,
      overrides: Object.fromEntries(
        Object.entries(padOverrides).map(([k, v]) => [k, v]),
      ),
      showSettings: showPadSettings,
    });
  }, [drumPadNotes, globalBpm, globalMeter, velocity, padOverrides, showPadSettings]);

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

  function markActive(padId: number, on: boolean) {
    setActivePads((prev) => {
      const next = new Set(prev);
      if (on) next.add(padId);
      else next.delete(padId);
      return next;
    });
  }

  function pressDrum(pointerId: number, padId: number) {
    if (heldRef.current.has(pointerId)) return;
    heldRef.current.set(pointerId, padId);
    clearPendingOff(padId);
    downAtRef.current.set(padId, performance.now());
    markActive(padId, true);
    const midi = clampDrumNote(drumPadNotes[padId] ?? 36);
    soundingRef.current.set(padId, [midi]);
    emitNotes([midi], velocityRef.current, true);
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

  function sendTestKick() {
    const note = 36;
    emitNotes([note], velocityRef.current, true);
    window.setTimeout(() => emitNotes([note], 0, false), 200);
  }

  function setHits(padId: number, hits: number) {
    const n = clampHitsPerBar(hits);
    setPadOverrides((prev) => ({
      ...prev,
      [padId]: { ...prev[padId], hitsPerBar: n },
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
    <div className="play-drum-body">
      {usbStorageActive ? (
        <p className="drum-pad-hint warn">
          USB Storage is open. The RC-600 cannot receive USB MIDI while STORAGE is ON. Click{" "}
          <strong>Eject USB</strong>, wait until the pedal leaves DISCONNECTING, then Allow MIDI and
          Connect to the port named RC-600 (not MIDIOUT2).
        </p>
      ) : !midiLinked ? (
        <p className="drum-pad-hint warn">
          MIDI not connected — pads animate locally but no notes leave the browser.{" "}
          {onRequestMidi ? (
            <button type="button" className="btn primary" onClick={onRequestMidi}>
              Allow MIDI
            </button>
          ) : (
            "Connect in the MIDI bar first."
          )}{" "}
          STORAGE must be OFF on the pedal (MENU → USB → STORAGE Off).
        </p>
      ) : (
        <p className="drum-pad-hint">
          Notes go to every RC-600 USB port on {channelLabel}
          {midiOutHint ? ` (linked ${midiOutHint})` : ""}. Factory Rx Rhythm CH is 10. The CTL Ch in
          the MIDI bar is only for Program Change.
          {lastMidi ? ` Last send: ${lastMidi}.` : ""}
        </p>
      )}

      <div className="drum-pad-source-row">
        <div className="drum-pad-source-copy">
          <span className="drum-pad-source-label">Rhythm notes</span>
          <span className="drum-pad-source-status">
            Send GM kit notes on {channelLabel}
            {midiOutHint ? ` → ${midiOutHint}` : ""}. Match System → MIDI → Rx Rhythm CH
            {systemRhythmCh != null ? ` (currently ${systemRhythmCh})` : " (factory 10)"}.
          </span>
        </div>
        <label className="drum-pad-field">
          <span>Rx CH</span>
          <select
            value={channel}
            aria-label="Rhythm MIDI channel"
            onChange={(e) => onRhythmChannel(Number(e.target.value))}
          >
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        {systemRhythmCh != null && systemRhythmCh - 1 !== channel ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => onRhythmChannel(systemRhythmCh - 1)}
          >
            Use Rx Rhythm CH {systemRhythmCh}
          </button>
        ) : null}
      </div>

      <div className="drum-pad-transport" role="group" aria-label="Global loop">
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
        <button type="button" className="btn ghost" onClick={sendTestKick}>
          Test Kick
        </button>
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
      >
        {padIds.map((padId) => {
          const midi = clampDrumNote(drumPadNotes[padId] ?? 36);
          const label = drumLabelForNote(midi);
          const isDown = activePads.has(padId);
          const isLooping = loop.isPlaying(padId);
          const hits = padOverrides[padId]?.hitsPerBar ?? 0;
          const lit = new Set(evenDistributeHits(hits));
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
                    {GM_DRUM_INSTRUMENTS.map((inst) => (
                      <option key={inst.note} value={inst.note}>
                        {inst.label} ({inst.note})
                      </option>
                    ))}
                    {!GM_DRUM_INSTRUMENTS.some((i) => i.note === midi) ? (
                      <option value={midi}>
                        N{midi} ({midi})
                      </option>
                    ) : null}
                  </select>
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
