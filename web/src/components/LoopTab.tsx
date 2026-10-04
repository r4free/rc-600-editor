import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { usePersistedTab } from "../uiTabs";
import {
  PLAY_ALL_START_BITS,
  PLAY_ALL_STOP_BITS,
  PLAY_PARAMS,
  REC_BOUNCE_TRACK_BITS,
  REC_PARAMS,
  RHYTHM_PARAMS,
  TRACK_INPUT_BITS,
  TRACK_PARAMS,
  bitOn,
  fadeTimeOptions,
  rhythmPatternOptions,
  setBit,
} from "@rc600/catalog/params";
import type { ParamDef, TrackInputBit } from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { ParamControl } from "./ParamControl";

const LOOP_SUBS = ["track", "rec", "play", "rhythm"] as const;
type LoopSub = (typeof LOOP_SUBS)[number];
const TRACK_NOS = [1, 2, 3, 4, 5, 6] as const;

const SUBS: { id: LoopSub; label: string; icon: IconName }[] = [
  { id: "track", label: "Tracks", icon: "loop" },
  { id: "rec", label: "Record", icon: "record" },
  { id: "play", label: "Play", icon: "play" },
  { id: "rhythm", label: "Rhythm", icon: "tempo" },
];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type PatchHandler = (ops: PatchOp | PatchOp[]) => void;

const TRACK_LEVEL_TAGS = ["D", "C"];

type TrackState = {
  icon: IconName;
  text: string;
  /** What the state means; "Click for <next>." is appended. */
  title: string;
  /** Accent color; defaults to the theme OK green. */
  color?: string;
  /** Outline the card: the state differs from the usual setup. */
  alert?: boolean;
  /** Grey out the icon (input left out). */
  dim?: boolean;
};

/** One state per parameter value (index = stored value); clicks cycle through them. */
type TrackStateView = {
  label: string;
  variant: string;
  states: TrackState[];
};

const TRACK_STATE_VIEWS: Record<string, TrackStateView> = {
  A: {
    label: "Direction",
    variant: "direction",
    states: [
      { icon: "refresh", text: "Forward", title: "Playing forward." },
      { icon: "refresh", text: "Reverse", title: "Playing in reverse.", color: "#ef4444", alert: true },
    ],
  },
  B: {
    label: "Playback",
    variant: "one-shot",
    states: [
      { icon: "loop", text: "Loop", title: "Loops continuously." },
      {
        icon: "oneShot",
        text: "1 Shot",
        title: "Plays once, then stops.",
        color: "var(--warn)",
        alert: true,
      },
    ],
  },
  E: {
    label: "Start Mode",
    variant: "start-mode",
    states: [
      { icon: "play", text: "Immediate", title: "Starts playback at once." },
      { icon: "fadeIn", text: "Fade", title: "Fades the track in.", color: "#facc15", alert: true },
    ],
  },
  F: {
    label: "Stop Mode",
    variant: "stop-mode",
    states: [
      { icon: "stop", text: "Immediate", title: "Stops at once." },
      { icon: "fadeOut", text: "Fade", title: "Fades the track out.", color: "#facc15", alert: true },
      {
        icon: "loopEnd",
        text: "Loop End",
        title: "Plays to the end of the loop, then stops.",
        color: "#c084fc",
        alert: true,
      },
    ],
  },
  G: {
    label: "Dub Mode",
    variant: "dub-mode",
    states: [
      { icon: "overdub", text: "Overdub", title: "Overdub layers new material on top of the existing take." },
      {
        icon: "replace1",
        text: "Replace 1",
        title: "Replace 1 overwrites the existing take while you record.",
        color: "#f87171",
        alert: true,
      },
      {
        icon: "replace2",
        text: "Replace 2",
        title: "Replace 2 overwrites the existing take while you record (second Replace variant).",
        color: "#fb923c",
        alert: true,
      },
    ],
  },
  P: {
    label: "Rec Source",
    variant: "bounce",
    states: [
      { icon: "mic", text: "Input", title: "Records the inputs only." },
      {
        icon: "merge",
        text: "Bounce",
        title: "Records the inputs plus playback from other tracks (Bounce In).",
        color: "#a78bfa",
        alert: true,
      },
    ],
  },
  L: {
    label: "Loop Sync",
    variant: "loop-sync",
    states: [
      {
        icon: "disconnect",
        text: "Free",
        title: "Runs at its own phrase length.",
        color: "var(--warn)",
        alert: true,
      },
      { icon: "connect", text: "Synced", title: "Synced to the memory tempo." },
    ],
  },
  S: {
    label: "Loop Sync Mode",
    variant: "loop-sync-mode",
    states: [
      {
        icon: "syncImmediate",
        text: "Immediate",
        title: "Starts when you press the switch.",
        color: "#e879f9",
        alert: true,
      },
      {
        icon: "syncMeasure",
        text: "Measure",
        title: "Waits for the next measure.",
        color: "#a3e635",
        alert: true,
      },
      { icon: "loop", text: "Loop Length", title: "Follows the LOOP LENGTH setting." },
    ],
  },
  M: {
    label: "Tempo Sync",
    variant: "tempo-sync",
    states: [
      {
        icon: "record",
        text: "Original",
        title: "Plays at the original recording tempo.",
        color: "#f472b6",
        alert: true,
      },
      { icon: "tempo", text: "Memory", title: "Plays at the memory tempo." },
    ],
  },
  N: {
    label: "Tempo Sync Mode",
    variant: "sync-mode",
    states: [
      {
        icon: "note",
        text: "Pitch",
        title: "Pitch follows the tempo when Tempo Sync is ON.",
        color: "#fb7185",
        alert: true,
      },
      {
        icon: "xfade",
        text: "XFade",
        title: "Keeps the pitch and changes playback speed when Tempo Sync is ON.",
      },
    ],
  },
  O: {
    label: "Tempo Sync Speed",
    variant: "sync-speed",
    states: [
      {
        icon: "speedSlow",
        text: "Half",
        title: "Plays at half speed.",
        color: "#60a5fa",
        alert: true,
      },
      { icon: "speedNormal", text: "Normal", title: "Plays at the original speed." },
      {
        icon: "speedFast",
        text: "Double",
        title: "Plays at double speed.",
        color: "#f97316",
        alert: true,
      },
    ],
  },
  I: {
    label: "Play Mode",
    variant: "play-mode",
    states: [
      { icon: "playMulti", text: "Multi", title: "Plays together with the other tracks." },
      {
        icon: "playSingle",
        text: "Single",
        title: "Plays alone; starting another track stops this one.",
        color: "#818cf8",
        alert: true,
      },
    ],
  },
  H: {
    label: "FX",
    variant: "fx",
    states: [
      {
        icon: "dry",
        text: "Dry",
        title: "Input FX / Track FX bypassed on this track.",
        color: "#fb923c",
        alert: true,
      },
      { icon: "mfx", text: "Wet", title: "Input FX / Track FX applied to this track." },
    ],
  },
};

/** OFF greyed out, ON green and outlined (inclusion toggles). */
function onOffView(label: string, icon: IconName, offTitle: string, onTitle: string): TrackStateView {
  return {
    label,
    variant: "input",
    states: [
      { icon, text: "Off", title: offTitle, color: "var(--muted)", dim: true },
      { icon, text: "On", title: onTitle, alert: true },
    ],
  };
}

function inputStateView(inp: TrackInputBit): TrackStateView {
  const icon: IconName = inp.name.startsWith("MIC")
    ? "mic"
    : inp.name.startsWith("INST")
      ? "guitar"
      : "tempo";
  return onOffView(
    inp.name,
    icon,
    `${inp.name} is not recorded onto this track.`,
    `${inp.name} is recorded onto this track.`,
  );
}

const REC_STATE_VIEWS: Record<string, TrackStateView> = {
  A: {
    label: "Rec Play Action",
    variant: "rec-action",
    states: [
      { icon: "overdub", text: "Rec → Dub", title: "REC/PLAY order: record, overdub, play." },
      {
        icon: "play",
        text: "Rec → Play",
        title: "REC/PLAY order: record, play, overdub.",
        color: "#a78bfa",
        alert: true,
      },
    ],
  },
  B: {
    label: "Quantize",
    variant: "quantize",
    states: [
      { icon: "syncImmediate", text: "Off", title: "Recording starts at once; stop still snaps to the measure." },
      {
        icon: "syncMeasure",
        text: "Measure",
        title: "Recording waits for the start of the measure.",
        color: "#a3e635",
        alert: true,
      },
    ],
  },
  C: {
    label: "Auto Rec",
    variant: "auto-rec",
    states: [
      { icon: "record", text: "Manual", title: "Recording starts when you press REC/PLAY." },
      {
        icon: "measureAuto",
        text: "Auto",
        title: "REC/PLAY enters standby; recording starts when the input exceeds Auto Rec Sens.",
        color: "#f87171",
        alert: true,
      },
    ],
  },
  E: onOffView(
    "Bounce",
    "merge",
    "Bounce recording is off for this memory.",
    "Bounce recording is on for this memory.",
  ),
};

function TrackStateCard({
  id,
  def,
  view,
  value,
  onChange,
}: {
  id: string;
  def: ParamDef;
  view: TrackStateView;
  value: number;
  onChange: (v: number) => void;
}) {
  const { states } = view;
  const index = value >= 0 && value < states.length ? value : 0;
  const state = states[index];
  const nextValue = (index + 1) % states.length;
  const binary = states.length === 2;
  const style = state.color
    ? ({ "--play-state-color": state.color } as CSSProperties)
    : undefined;
  return (
    <div
      className={`param-row play-state-param is-${view.variant} is-v${index}${state.alert ? " is-alert" : ""}${state.dim ? " is-dim" : ""}`}
      style={style}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, .param-label")) return;
        onChange(nextValue);
      }}
    >
      <div className="param-label">
        <label htmlFor={id}>{view.label}</label>
        {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
      </div>
      <button
        id={id}
        type="button"
        role={binary ? "switch" : undefined}
        className="play-state-btn"
        aria-checked={binary ? index === 1 : undefined}
        aria-label={`${def.name}: ${state.text}`}
        title={`${state.title} Click for ${states[nextValue].text}.`}
        onClick={() => onChange(nextValue)}
      >
        <Icon name={state.icon} className="play-state-icon" />
        <span className="play-state-text">{state.text}</span>
      </button>
    </div>
  );
}

const SCRUB_DRAG_STEP_PX = 14;
const SCRUB_WHEEL_STEP = 40;

/** Value scrubbed by mouse wheel, horizontal drag (touch-friendly), arrows or keyboard. */
function ScrubControl({
  id,
  value,
  min,
  max,
  onChange,
  onTap,
  ariaLabel,
  title,
  children,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** Plain click (no drag) on the value. */
  onTap?: () => void;
  ariaLabel: string;
  title: string;
  children: ReactNode;
}) {
  const scrubRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const dragRef = useRef<{ pointerId: number; startX: number; steps: number; moved: boolean } | null>(
    null,
  );
  const wheelRef = useRef(0);
  const draggedRef = useRef(false);

  const step = (delta: number) => {
    const next = Math.max(min, Math.min(max, valueRef.current + delta));
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const el = scrubRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
      while (Math.abs(wheelRef.current) >= SCRUB_WHEEL_STEP) {
        const dir = Math.sign(wheelRef.current);
        wheelRef.current -= dir * SCRUB_WHEEL_STEP;
        stepRef.current(dir);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="measure-count">
      <button
        type="button"
        className="measure-arrow"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={value <= min}
        onClick={() => step(-1)}
      >
        <Icon name="chevronLeft" />
      </button>
      <div
        ref={scrubRef}
        id={id}
        className="measure-scrub"
        role="spinbutton"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        title={title}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          } else if (onTap && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onTap();
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          dragRef.current = { pointerId: e.pointerId, startX: e.clientX, steps: 0, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== e.pointerId) return;
          const dx = e.clientX - drag.startX;
          if (Math.abs(dx) > 4) drag.moved = true;
          const steps = Math.trunc(dx / SCRUB_DRAG_STEP_PX);
          if (steps !== drag.steps) {
            step(steps - drag.steps);
            drag.steps = steps;
          }
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== e.pointerId) return;
          dragRef.current = null;
          draggedRef.current = drag.moved;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onClick={() => {
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          onTap?.();
        }}
      >
        {children}
      </div>
      <button
        type="button"
        className="measure-arrow"
        aria-label={`Increase ${ariaLabel}`}
        disabled={value >= max}
        onClick={() => step(1)}
      >
        <Icon name="chevronRight" />
      </button>
    </div>
  );
}

/** Splits "2 meas" / "1/8" into a big value and a small unit caption. */
function ScrubValue({ value, unit }: { value: string; unit?: string }) {
  return (
    <>
      <span className="measure-value">{value}</span>
      {unit ? <span className="play-state-text">{unit}</span> : null}
    </>
  );
}

/** Card whose value is scrubbed instead of picked from a list. */
function ScrubCard({
  id,
  def,
  value,
  min,
  max,
  format,
  alert,
  color = "#c084fc",
  onChange,
}: {
  id: string;
  def: ParamDef;
  value: number;
  min: number;
  max: number;
  format: (v: number) => { value: string; unit?: string };
  alert: boolean;
  color?: string;
  onChange: (v: number) => void;
}) {
  const shown = format(value);
  const style = alert ? ({ "--play-state-color": color } as CSSProperties) : undefined;
  return (
    <div className={`param-row play-state-param is-scrub${alert ? " is-alert" : ""}`} style={style}>
      <div className="param-label">
        <label htmlFor={id}>{def.name}</label>
        {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
      </div>
      <ScrubControl
        id={id}
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        ariaLabel={`${def.name}: ${shown.value}${shown.unit ? ` ${shown.unit}` : ""}`}
        title="Scroll, drag sideways or use the arrows to change."
      >
        <ScrubValue {...shown} />
      </ScrubControl>
    </div>
  );
}

const MEASURE_TAG = "R";
const MEASURE_AUTO = 0;
const MEASURE_FREE = 1;
const MEASURE_MIN = 2;
const MEASURE_MAX = 32;
const MEASURE_DEFAULT_COUNT = 4;

/** AUTO → FREE → measure count → AUTO. The count is scrubbed; a plain click on it returns to AUTO. */
function MeasureCard({
  id,
  def,
  value,
  onChange,
}: {
  id: string;
  def: ParamDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const isCount = value >= MEASURE_MIN;
  const lastCount = useRef(isCount ? value : MEASURE_DEFAULT_COUNT);
  if (isCount) lastCount.current = value;

  const next = () => {
    if (value === MEASURE_AUTO) onChange(MEASURE_FREE);
    else if (value === MEASURE_FREE) onChange(lastCount.current);
    else onChange(MEASURE_AUTO);
  };

  const label = value === MEASURE_AUTO ? "Auto" : value === MEASURE_FREE ? "Free" : `${value} meas.`;
  const nextLabel = value === MEASURE_AUTO ? "Free" : value === MEASURE_FREE ? "measures" : "Auto";
  const style = isCount
    ? ({ "--play-state-color": "#c084fc" } as CSSProperties)
    : value === MEASURE_FREE
      ? ({ "--play-state-color": "var(--warn)" } as CSSProperties)
      : undefined;

  return (
    <div
      className={`param-row play-state-param is-measure${value !== MEASURE_AUTO ? " is-alert" : ""}`}
      style={style}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, .param-label, .measure-scrub")) return;
        next();
      }}
    >
      <div className="param-label">
        <label htmlFor={id}>{def.name}</label>
        {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
      </div>
      {isCount ? (
        <ScrubControl
          id={id}
          value={value}
          min={MEASURE_MIN}
          max={MEASURE_MAX}
          onChange={onChange}
          onTap={next}
          ariaLabel={`${def.name}: ${label}`}
          title="Scroll or drag sideways to change. Click for Auto."
        >
          <ScrubValue value={String(value)} unit="Meas." />
        </ScrubControl>
      ) : (
        <button
          id={id}
          type="button"
          className="play-state-btn"
          aria-label={`${def.name}: ${label}`}
          title={`${value === MEASURE_AUTO ? "Matches the first AUTO track you record." : "Follows the recording length."} Click for ${nextLabel}.`}
          onClick={next}
        >
          <Icon name={value === MEASURE_AUTO ? "measureAuto" : "measureFree"} className="play-state-icon" />
          <span className="play-state-text">{label}</span>
        </button>
      )}
    </div>
  );
}

const PLAY_STATE_VIEWS: Record<string, TrackStateView> = {
  A: {
    label: "Single Track Change",
    variant: "single-change",
    states: [
      { icon: "syncImmediate", text: "Immediate", title: "In Single play mode, switches tracks at once." },
      {
        icon: "loopEnd",
        text: "Loop End",
        title: "In Single play mode, waits until the current loop finishes.",
        color: "#c084fc",
        alert: true,
      },
    ],
  },
  G: {
    label: "Speed Change",
    variant: "speed-change",
    states: [
      { icon: "syncImmediate", text: "Immediate", title: "Tempo Sync Speed switches at once." },
      {
        icon: "loopEnd",
        text: "Loop End",
        title: "Tempo Sync Speed waits until the loop finishes.",
        color: "#c084fc",
        alert: true,
      },
    ],
  },
  H: {
    label: "Sync Adjust",
    variant: "sync-adjust",
    states: [
      {
        icon: "tempo",
        text: "Beat",
        title: "Tracks may be up to one beat out of alignment and still sync.",
        color: "#a3e635",
        alert: true,
      },
      {
        icon: "syncMeasure",
        text: "Measure",
        title: "Tracks may be up to one measure out of alignment and still sync.",
      },
    ],
  },
};

const RHYTHM_SELECT_TAGS = ["A", "B", "D"];
const RHYTHM_BEAT_TAG = "E";

const RHYTHM_STATE_VIEWS: Record<string, TrackStateView> = {
  C: {
    label: "Variation",
    variant: "variation",
    states: (["A", "B", "C", "D"] as const).map((v, i) => ({
      icon: `variation${v}` as IconName,
      text: v,
      title: `Pattern variation ${v}.`,
      ...(i > 0 ? { color: ["#c084fc", "#fbbf24", "#fb923c"][i - 1], alert: true } : {}),
    })),
  },
  F: {
    label: "Start Trig",
    variant: "start-trig",
    states: [
      { icon: "loop", text: "Loop Start", title: "Rhythm starts with loop record/play." },
      {
        icon: "recEnd",
        text: "Rec End",
        title: "Rhythm starts when recording switches to play.",
        color: "#c084fc",
        alert: true,
      },
      {
        icon: "tempo",
        text: "Before Loop",
        title: "Rhythm plays first; record/play starts on the next press.",
        color: "#a3e635",
        alert: true,
      },
    ],
  },
  G: {
    label: "Stop Trig",
    variant: "stop-trig",
    states: [
      {
        icon: "measureFree",
        text: "Off",
        title: "Rhythm keeps playing (useful for MIDI sync).",
        color: "var(--warn)",
        alert: true,
      },
      { icon: "stop", text: "Loop Stop", title: "Rhythm stops when the loop stops." },
      {
        icon: "recEnd",
        text: "Rec End",
        title: "Rhythm stops when recording ends, as a recording guide.",
        color: "#c084fc",
        alert: true,
      },
    ],
  },
  H: onOffView("Intro Rec", "introRec", "No intro while recording.", "Adds an intro while recording."),
  I: onOffView("Intro Play", "intro", "Rhythm plays without an intro.", "Rhythm plays with an intro."),
  J: onOffView("Ending", "ending", "Rhythm plays without an ending.", "Rhythm plays with an ending."),
  K: onOffView("Fill", "fill", "Rhythm plays without a fill-in.", "Rhythm plays with a fill-in."),
  L: {
    label: "Variation Change",
    variant: "variation-change",
    states: [
      { icon: "syncMeasure", text: "Measure", title: "Variation switches at the end of the measure." },
      {
        icon: "loopEnd",
        text: "Loop End",
        title: "Variation switches at the end of the loop.",
        color: "#c084fc",
        alert: true,
      },
    ],
  },
};

function fadeTimeDisplay(v: number): { value: string; unit?: string } {
  const label = fadeTimeOptions()[v]?.label ?? String(v);
  return label.endsWith(" meas")
    ? { value: label.slice(0, -5), unit: "Meas." }
    : { value: label, unit: "Note" };
}

const FADE_TIME_MAX = fadeTimeOptions().length - 1;
const LOOP_LENGTH_TAG = "F";

export function LoopTab({
  model,
  onPatch,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
}) {
  const [sub, setSub] = usePersistedTab<LoopSub>("loop", "track", LOOP_SUBS);
  const [trackNo, setTrackNo] = usePersistedTab("loopTrack", 1, TRACK_NOS);

  const track = model.tracks[trackNo - 1] ?? {};
  const inputMask = num(track, "Q", 127);

  return (
    <div className="loop-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="Loop">
        {SUBS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={sub === t.id}
            className={`tab ${sub === t.id ? "active" : ""}`}
            onClick={() => setSub(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {sub === "track" ? (
        <>
          <div className="tabs tabs-sub" role="tablist" aria-label="Track">
            {TRACK_NOS.map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={trackNo === n}
                className={`tab ${trackNo === n ? "active" : ""}`}
                onClick={() => setTrackNo(n)}
              >
                <Icon name="play" size={12} />
                Track {n}
              </button>
            ))}
          </div>

          <div className="param-columns">
            {TRACK_PARAMS.filter((def) => TRACK_LEVEL_TAGS.includes(def.tag)).map((def) => (
              <ParamControl
                key={def.tag}
                id={`tr-${trackNo}-${def.tag}`}
                def={def}
                value={num(track, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({ type: "track", track: trackNo, tags: { [def.tag]: String(v) } })
                }
              />
            ))}
          </div>
          <div className="track-state-cards">
            {TRACK_PARAMS.filter((def) => TRACK_STATE_VIEWS[def.tag] || def.tag === MEASURE_TAG).map(
              (def) => {
                const value = num(track, def.tag, def.default ?? 0);
                const onChange = (v: number) =>
                  onPatch({ type: "track", track: trackNo, tags: { [def.tag]: String(v) } });
                return def.tag === MEASURE_TAG ? (
                  <MeasureCard
                    key={def.tag}
                    id={`tr-${trackNo}-${def.tag}`}
                    def={def}
                    value={value}
                    onChange={onChange}
                  />
                ) : (
                  <TrackStateCard
                    key={def.tag}
                    id={`tr-${trackNo}-${def.tag}`}
                    def={def}
                    view={TRACK_STATE_VIEWS[def.tag]}
                    value={value}
                    onChange={onChange}
                  />
                );
              },
            )}
          </div>
          <div className="param-columns">
            {TRACK_PARAMS.filter(
              (def) =>
                !TRACK_STATE_VIEWS[def.tag] &&
                def.tag !== MEASURE_TAG &&
                !TRACK_LEVEL_TAGS.includes(def.tag),
            ).map((def) => (
              <ParamControl
                key={def.tag}
                id={`tr-${trackNo}-${def.tag}`}
                def={def}
                value={num(track, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({ type: "track", track: trackNo, tags: { [def.tag]: String(v) } })
                }
              />
            ))}
          </div>

          <div className="track-state-cards">
            {TRACK_INPUT_BITS.map((inp) => (
              <TrackStateCard
                key={inp.bit}
                id={`tr-${trackNo}-in-${inp.bit}`}
                def={{
                  tag: "Q",
                  name: inp.name,
                  kind: "bool",
                  info: inp.info,
                }}
                view={inputStateView(inp)}
                value={bitOn(inputMask, inp.bit) ? 1 : 0}
                onChange={(v) =>
                  onPatch({
                    type: "track",
                    track: trackNo,
                    tags: { Q: String(setBit(inputMask, inp.bit, Boolean(v))) },
                  })
                }
              />
            ))}
          </div>
        </>
      ) : null}

      {sub === "rec" ? (
        <>
          <div className="param-columns">
            {REC_PARAMS.filter((def) => !REC_STATE_VIEWS[def.tag]).map((def) => (
              <ParamControl
                key={def.tag}
                id={`rec-${def.tag}`}
                def={def}
                value={num(model.rec, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({ type: "section", section: "REC", tags: { [def.tag]: String(v) } })
                }
              />
            ))}
          </div>
          <div className="track-state-cards">
            {REC_PARAMS.filter((def) => REC_STATE_VIEWS[def.tag]).map((def) => (
              <TrackStateCard
                key={def.tag}
                id={`rec-${def.tag}`}
                def={def}
                view={REC_STATE_VIEWS[def.tag]}
                value={num(model.rec, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({ type: "section", section: "REC", tags: { [def.tag]: String(v) } })
                }
              />
            ))}
          </div>
          <div className="track-state-cards">
            {REC_BOUNCE_TRACK_BITS.map((inp) => {
              const mask = num(model.rec, "F", 0);
              return (
                <TrackStateCard
                  key={inp.bit}
                  id={`rec-bounce-${inp.bit}`}
                  def={{
                    tag: "F",
                    name: inp.name,
                    kind: "bool",
                    info: inp.info,
                  }}
                  view={onOffView(
                    inp.name,
                    "merge",
                    `${inp.name.replace("Bounce ", "")} is not a bounce source.`,
                    `${inp.name.replace("Bounce ", "")} is a bounce source.`,
                  )}
                  value={bitOn(mask, inp.bit) ? 1 : 0}
                  onChange={(v) =>
                    onPatch({
                      type: "section",
                      section: "REC",
                      tags: { F: String(setBit(mask, inp.bit, Boolean(v))) },
                    })
                  }
                />
              );
            })}
          </div>
        </>
      ) : null}

      {sub === "play" ? (
        <>
          <div className="track-state-cards">
            {PLAY_PARAMS.map((def) => {
              const id = `play-${def.tag}`;
              const value = num(model.play, def.tag, def.default ?? 0);
              const onChange = (v: number) =>
                onPatch({ type: "section", section: "PLAY", tags: { [def.tag]: String(v) } });
              const view = PLAY_STATE_VIEWS[def.tag];
              if (view) {
                return (
                  <TrackStateCard
                    key={def.tag}
                    id={id}
                    def={def}
                    view={view}
                    value={value}
                    onChange={onChange}
                  />
                );
              }
              if (def.tag === LOOP_LENGTH_TAG) {
                return (
                  <ScrubCard
                    key={def.tag}
                    id={id}
                    def={def}
                    value={value}
                    min={def.min ?? 0}
                    max={def.max ?? 0}
                    format={(v) => (v === 0 ? { value: "Auto" } : { value: String(v), unit: "Meas." })}
                    alert={value !== 0}
                    onChange={onChange}
                  />
                );
              }
              return (
                <ScrubCard
                  key={def.tag}
                  id={id}
                  def={def}
                  value={value}
                  min={0}
                  max={FADE_TIME_MAX}
                  format={fadeTimeDisplay}
                  alert={value !== (def.default ?? 0)}
                  onChange={onChange}
                />
              );
            })}
          </div>
          {(
            [
              { tag: "D", title: "All Start", icon: "play", items: PLAY_ALL_START_BITS, verb: "start" },
              { tag: "E", title: "All Stop", icon: "stop", items: PLAY_ALL_STOP_BITS, verb: "stop" },
            ] as const
          ).map((group) => {
            const mask = num(model.play, group.tag, 0);
            return (
              <section key={group.tag}>
                <h3 className="section-title">{group.title}</h3>
                <div className="track-state-cards">
                  {group.items.map((inp) => (
                    <TrackStateCard
                      key={inp.bit}
                      id={`play-${group.tag}-${inp.bit}`}
                      def={{ tag: group.tag, name: inp.name, kind: "bool", info: inp.info }}
                      view={onOffView(
                        inp.name,
                        group.icon,
                        `${inp.name} does not ${group.verb} on ${group.title}.`,
                        `${inp.name} ${group.verb}s on ${group.title}.`,
                      )}
                      value={bitOn(mask, inp.bit) ? 1 : 0}
                      onChange={(v) =>
                        onPatch({
                          type: "section",
                          section: "PLAY",
                          tags: { [group.tag]: String(setBit(mask, inp.bit, Boolean(v))) },
                        })
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : null}

      {sub === "rhythm" ? <RhythmEditor tags={model.rhythm} onPatch={onPatch} /> : null}
    </div>
  );
}

function RhythmEditor({ tags, onPatch }: { tags: TagMap; onPatch: PatchHandler }) {
  const genre = num(tags, "A", 0);

  const patch = (partial: Record<string, string>) =>
    onPatch({ type: "section", section: "RHYTHM", tags: partial });

  return (
    <>
      <div className="param-columns">
        {RHYTHM_PARAMS.filter((def) => RHYTHM_SELECT_TAGS.includes(def.tag)).map((def) => {
          const resolved =
            def.tag === "B" ? { ...def, options: rhythmPatternOptions(genre) } : def;
          return (
            <ParamControl
              key={def.tag}
              id={`rhy-${def.tag}`}
              def={resolved}
              value={num(tags, def.tag, def.default ?? 0)}
              onChange={(v) => {
                if (def.tag === "A") {
                  const names = rhythmPatternOptions(v);
                  const cur = num(tags, "B", 0);
                  const next: Record<string, string> = { A: String(v) };
                  if (cur >= names.length) next.B = "0";
                  patch(next);
                  return;
                }
                patch({ [def.tag]: String(v) });
              }}
            />
          );
        })}
      </div>
      <div className="track-state-cards">
        {RHYTHM_PARAMS.filter((def) => !RHYTHM_SELECT_TAGS.includes(def.tag)).map((def) => {
          const id = `rhy-${def.tag}`;
          const value = num(tags, def.tag, def.default ?? 0);
          const onChange = (v: number) => patch({ [def.tag]: String(v) });
          if (def.tag === RHYTHM_BEAT_TAG) {
            const options = def.options ?? [];
            return (
              <ScrubCard
                key={def.tag}
                id={id}
                def={def}
                value={value}
                min={options[0]?.value ?? 0}
                max={options[options.length - 1]?.value ?? 0}
                format={(v) => ({ value: options.find((o) => o.value === v)?.label ?? String(v) })}
                alert={value !== (def.default ?? 0)}
                onChange={onChange}
              />
            );
          }
          const view = RHYTHM_STATE_VIEWS[def.tag];
          if (!view) return null;
          return (
            <TrackStateCard
              key={def.tag}
              id={id}
              def={def}
              view={view}
              value={value}
              onChange={onChange}
            />
          );
        })}
      </div>
    </>
  );
}
