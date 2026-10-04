import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { syncRateLabel, type InputFxStepLayout } from "@rc600/catalog/input-fx";
import type { ParamDef } from "@rc600/catalog/params";
import type { TagMap } from "@rc600/rc0/memory";
import { StepPreviewEngine, type PreviewSound, type VibratoPreview } from "../audio/stepPreview";
import { RANDOM_STYLES, randomPattern, type RandomStyle } from "../audio/stepRandom";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";
import { ScrubCard, TrackStateCard, type TrackStateView } from "./LoopTab";
import type { IconName } from "./Icon";

const SOUNDS: { id: PreviewSound; label: string }[] = [
  { id: "tone", label: "Tone" },
  { id: "beat", label: "Beat" },
  { id: "synth", label: "Synth" },
];

const TARGET_CAPTION = {
  volume: "volume",
  filter: "filter cutoff",
  pitch: "pitch",
  pan: "pan",
  vibrato: "vibrato depth",
} as const;

type Lane = "level" | "length";
type BarsView = Lane | "both";

const VIEWS: { id: BarsView; label: string; title: string }[] = [
  { id: "level", label: "Level", title: "Bars set the volume of each step" },
  { id: "length", label: "Length", title: "Bars set how long each step sounds" },
  { id: "both", label: "Both", title: "Level and Length bars side by side" },
];

const HEADER_VIEWS: Record<string, TrackStateView> = {
  Sequence: {
    label: "Sequence",
    variant: "input",
    states: [
      { icon: "blocks", text: "Off", title: "The effect ignores the steps.", color: "var(--muted)", dim: true },
      { icon: "blocks", text: "On", title: "The steps change the Target parameter.", alert: true },
    ],
  },
  "Step Sync": {
    label: "Step Sync",
    variant: "input",
    states: [
      { icon: "measureFree", text: "Free", title: "The sequence runs on its own.", color: "var(--muted)", dim: true },
      { icon: "loop", text: "Loop", title: "Step 1 is cued up with loop playback.", alert: true },
    ],
  },
  Retrigger: {
    label: "Retrigger",
    variant: "input",
    states: [
      { icon: "restore", text: "Off", title: "Turning the effect on continues the sequence.", color: "var(--muted)", dim: true },
      { icon: "restore", text: "On", title: "Turning the effect on restarts at step 1 with the phrase.", alert: true },
    ],
  },
};

function targetIcon(name: string): IconName {
  if (/Level$/.test(name)) return "master";
  if (name === "Depth") return "mfx";
  if (/Cutoff|Frequency|Manual/.test(name)) return "equalizer";
  if (name === "Rate") return "speedFast";
  if (name === "Position") return "xfade";
  if (/Trans|Bend|Note/.test(name)) return "note";
  return "tune";
}

function vibratoStepParam(name: string | undefined): VibratoPreview["stepParam"] {
  if (name === "Depth") return "depth";
  if (name === "D.Level") return "dryLevel";
  if (name === "E.Level") return "wetLevel";
  return null;
}

function targetView(def: ParamDef): TrackStateView {
  return {
    label: def.name,
    variant: "input",
    states: (def.options ?? []).map((o) => ({
      icon: targetIcon(o.label),
      text: o.label,
      title: `The steps change ${o.label}.`,
      alert: true,
    })),
  };
}

const TAP_VALUE = 100;
const KEY_STEP = 5;
const MIN_BPM = 40;
const MAX_BPM = 250;

function num(tags: TagMap, tag: string, fallback = 0): number {
  const n = parseInt(tags[tag] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function clampValue(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function rateCardValue(value: number): { value: string; unit: string } {
  const label = syncRateLabel(value);
  if (/^\d+MEAS$/.test(label)) {
    const count = label.replace("MEAS", "");
    return { value: count, unit: count === "1" ? "Measure" : "Measures" };
  }
  if (label.endsWith(".")) return { value: label.slice(0, -1), unit: "Dotted note" };
  if (label.endsWith("T")) return { value: label.slice(0, -1), unit: "Triplet" };
  if (label.includes("/")) return { value: label, unit: "Note" };
  return { value: label, unit: "Free rate" };
}

export function StepSequencer({
  idPrefix,
  layout,
  defs,
  tags,
  slot,
  initialBpm,
  vibrato,
  onSet,
}: {
  idPrefix: string;
  layout: InputFxStepLayout;
  /** Params of the block that holds the steps (type block or `*_SEQ`). */
  defs: ParamDef[];
  tags: TagMap;
  /** FX letter, for the slot color. */
  slot: string;
  initialBpm: number;
  /** Vibrato effect settings, so the preview plays the effect itself. */
  vibrato?: Omit<VibratoPreview, "stepParam">;
  onSet: (tags: Record<string, string>) => void;
}) {
  const defFor = (tag: string) => defs.find((d) => d.tag === tag);
  const read = (laneTags: string[]) => {
    const fallback = defFor(laneTags[0]!)?.default ?? 0;
    return laneTags.map((tag) => num(tags, tag, defFor(tag)?.default ?? fallback));
  };
  const [view, setView] = useState<BarsView>("level");
  const lengthTags = layout.lengthTags;
  const lanes: Lane[] = !lengthTags ? ["level"] : view === "both" ? ["level", "length"] : [view];
  const tagsOf = (lane: Lane) => (lane === "length" && lengthTags ? lengthTags : layout.stepTags);
  const levels = read(layout.stepTags);
  const lengths = lengthTags ? read(lengthTags) : levels;
  const storedOf = (lane: Lane) => (lane === "length" ? lengths : levels);
  const stepMax = num(tags, layout.stepMaxTag, defFor(layout.stepMaxTag)?.default ?? 15);
  const activeCount = Math.min(layout.stepTags.length, stepMax + 1);
  const rateIndex = num(tags, layout.rateTag, defFor(layout.rateTag)?.default ?? 0);
  const targetIndex = layout.targetTag ? num(tags, layout.targetTag, 0) : 0;
  const target = layout.targetPreviews?.[targetIndex] ?? layout.target;
  const targetDef = layout.targetTag ? defFor(layout.targetTag) : undefined;
  const targetName = targetDef?.options?.find((o) => o.value === targetIndex)?.label;
  const sequenceOff = layout.switchTag ? num(tags, layout.switchTag, 0) === 0 : false;
  const previewTags = layout.previewTags;
  const depth = previewTags ? num(tags, previewTags.depth, defFor(previewTags.depth)?.default ?? 100) : 100;
  const compThreshold = previewTags
    ? num(tags, previewTags.compThreshold, defFor(previewTags.compThreshold)?.default ?? 0)
    : 30;
  const compGain = previewTags
    ? num(tags, previewTags.compGain, defFor(previewTags.compGain)?.default ?? 0)
    : 0;

  const [draft, setDraft] = useState<{ lane: Lane; values: number[] } | null>(null);
  const valuesOf = (lane: Lane) => (draft?.lane === lane ? draft.values : storedOf(lane));
  const levelSteps = valuesOf("level");
  const [bpm, setBpm] = useState(() => Math.round(initialBpm));
  const [sound, setSound] = useState<PreviewSound>("synth");
  const [metronome, setMetronome] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const [randomStyle, setRandomStyle] = useState<RandomStyle>("any");

  const restoreDefault = (lane: Lane) =>
    lane === "length" && lengthTags ? (defFor(lengthTags[0]!)?.default ?? 50) : TAP_VALUE;
  const lastNonZero = useRef<Record<Lane, number[]>>({
    level: levels.map((v) => (v > 0 ? v : restoreDefault("level"))),
    length: lengths.map((v) => (v > 0 ? v : restoreDefault("length"))),
  });
  const barsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; lane: Lane; values: number[] } | null>(null);
  const engineRef = useRef<StepPreviewEngine | null>(null);
  const playheadRef = useRef(-1);
  playheadRef.current = playhead;

  const config = useMemo(
    () => ({
      steps: levelSteps,
      activeCount,
      rateIndex,
      bpm,
      target,
      sound,
      metronome,
      depth,
      compressorThresholdDb: compThreshold - 30,
      compressorGainDb: compGain,
      vibrato: vibrato ? { ...vibrato, stepParam: sequenceOff ? null : vibratoStepParam(targetName) } : undefined,
    }),
    [
      levelSteps,
      activeCount,
      rateIndex,
      bpm,
      target,
      sound,
      metronome,
      depth,
      compThreshold,
      compGain,
      vibrato,
      sequenceOff,
      targetName,
    ],
  );

  useEffect(() => {
    engineRef.current?.update(config);
  }, [config]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  function togglePlay() {
    if (!engineRef.current) engineRef.current = new StepPreviewEngine(config, setPlayhead);
    const engine = engineRef.current;
    if (engine.playing) {
      engine.stop();
      setPlaying(false);
    } else {
      engine.update(config);
      engine.start();
      setPlaying(true);
    }
  }

  function commit(lane: Lane, values: number[]) {
    const target = tagsOf(lane);
    const current = storedOf(lane);
    const patch: Record<string, string> = {};
    values.forEach((v, i) => {
      if (v !== current[i]) patch[target[i]!] = String(v);
      if (v > 0) lastNonZero.current[lane][i] = v;
    });
    if (Object.keys(patch).length) onSet(patch);
  }

  function setStep(lane: Lane, index: number, value: number) {
    const next = [...storedOf(lane)];
    next[index] = clampValue(value);
    commit(lane, next);
  }

  function randomize() {
    const pattern = randomPattern(activeCount, randomStyle);
    const patch: Record<string, string> = {};
    const write = (lane: Lane, values: number[]) =>
      values.forEach((v, i) => {
        patch[tagsOf(lane)[i]!] = String(v);
        if (v > 0) lastNonZero.current[lane][i] = v;
      });
    write("level", pattern.level);
    if (lengthTags) write("length", pattern.length);
    setDraft(null);
    onSet(patch);
  }

  function setLevel(index: number, value: number) {
    setStep("level", index, value);
  }

  function tap(on: boolean) {
    const index = playheadRef.current;
    if (index < 0) return;
    if (on === (levels[index]! > 0)) return;
    setLevel(index, on ? (lastNonZero.current.level[index] ?? TAP_VALUE) : 0);
  }
  const tapRef = useRef(tap);
  tapRef.current = tap;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "t" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, select, textarea")) return;
      e.preventDefault();
      tapRef.current(!e.shiftKey);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pointAt(e: PointerEvent<HTMLDivElement>): { index: number; lane: Lane; value: number } | null {
    const el = barsRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pos = ((e.clientX - r.left) / r.width) * layout.stepTags.length;
    const index = Math.floor(pos);
    if (index < 0 || index >= layout.stepTags.length) return null;
    const lane = lanes.length > 1 && pos - index >= 0.5 ? lanes[1]! : lanes[0]!;
    return { index, lane, value: clampValue((1 - (e.clientY - r.top) / r.height) * 100) };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const hit = pointAt(e);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const values = [...valuesOf(hit.lane)];
    values[hit.index] = hit.value;
    dragRef.current = { pointerId: e.pointerId, lane: hit.lane, values };
    setDraft({ lane: hit.lane, values });
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const hit = pointAt(e);
    if (!hit || drag.values[hit.index] === hit.value) return;
    drag.values = [...drag.values];
    drag.values[hit.index] = hit.value;
    setDraft({ lane: drag.lane, values: drag.values });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    commit(drag.lane, drag.values);
    setDraft(null);
  }

  function bar(lane: Lane, i: number) {
    const value = valuesOf(lane)[i]!;
    const name = lengthTags ? (lane === "length" ? " Length" : " Level") : "";
    return (
      <div
        key={lane}
        role="slider"
        tabIndex={0}
        aria-label={`Step ${i + 1}${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className={`step-seq-bar is-${lane}${i >= activeCount ? " is-inactive" : ""}${i === playhead ? " is-playing" : ""}`}
        onKeyDown={(e) => {
          const delta = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
          if (!delta) return;
          e.preventDefault();
          setStep(lane, i, value + delta);
        }}
      >
        <span className="step-seq-fill" style={{ "--step-value": `${value}%` } as CSSProperties} />
        <span className="step-seq-value">{value}</span>
      </div>
    );
  }

  const headerDefs = layout.headerTags.map(defFor).filter((def): def is ParamDef => Boolean(def));
  const rateDef = defFor(layout.rateTag);
  const stepMaxDef = defFor(layout.stepMaxTag);

  return (
    <section className="step-seq" data-fx-slot={slot} aria-label="Step sequencer">
      <div className="step-seq-transport">
        <button
          type="button"
          className={`btn step-seq-play${playing ? " is-on" : ""}`}
          onClick={togglePlay}
          aria-pressed={playing}
        >
          <Icon name={playing ? "stop" : "play"} size={14} />
          {playing ? "Stop" : "Play"}
        </button>
        <button
          type="button"
          className="btn step-seq-tap step-seq-tap-on"
          disabled={!playing}
          title="Turn the playing step on (key T)"
          onClick={() => tap(true)}
        >
          <Icon name="fill" size={14} />
          Tap On
        </button>
        <button
          type="button"
          className="btn step-seq-tap step-seq-tap-off"
          disabled={!playing}
          title="Set the playing step to 0 (Shift+T)"
          onClick={() => tap(false)}
        >
          <Icon name="notesOff" size={14} />
          Tap Off
        </button>
        <label className="step-seq-field">
          <span>BPM</span>
          <input
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v))));
            }}
          />
        </label>
        <label className="step-seq-field">
          <span>Sound</span>
          <select value={sound} onChange={(e) => setSound(e.target.value as PreviewSound)}>
            {SOUNDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`btn step-seq-metro${metronome ? " is-on" : ""}`}
          aria-pressed={metronome}
          onClick={() => setMetronome((m) => !m)}
        >
          <Icon name="tempo" size={14} />
          Metronome
        </button>
        {layout.lengthTags ? (
          <div className="view-toggle step-seq-views" role="radiogroup" aria-label="Bars edit">
            {VIEWS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={view === l.id}
                className={`view-toggle-btn is-${l.id}${view === l.id ? " active" : ""}`}
                title={l.title}
                onClick={() => {
                  setDraft(null);
                  setView(l.id);
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="step-seq-random">
          <label className="step-seq-field">
            <span>Pattern</span>
            <select
              value={randomStyle}
              title={RANDOM_STYLES.find((s) => s.id === randomStyle)?.title}
              onChange={(e) => setRandomStyle(e.target.value as RandomStyle)}
            >
              {RANDOM_STYLES.map((s) => (
                <option key={s.id} value={s.id} title={s.title}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn step-seq-random-btn"
            title={`Generate a random pattern for the ${activeCount} active steps${lengthTags ? " (Level and Length)" : ""}`}
            onClick={randomize}
          >
            <Icon name="dice" size={14} />
            Random
          </button>
        </div>
        <InfoTip
          label="Step sequencer"
          text={`Drag the bars to set each step (0–100); the square under a bar sets it to 0 or brings back its value. Random writes a new pattern over the active steps in the chosen style: Euclidean spreads hits evenly, Gate chops on and off while keeping the beats, Stutter repeats short bursts, Accent plays every step with louder beats, and Chaos is fully random. Play runs a browser-only reference sound whose ${TARGET_CAPTION[target]} follows the steps; BPM is for the preview only. While playing, Tap On (or T) turns the current step on, and Tap Off (or Shift+T) sets it to 0.`}
        />
      </div>

      {targetName || sequenceOff ? (
        <p className={`step-seq-status${sequenceOff ? " is-off" : ""}`}>
          {targetName ? (
            <span>
              Steps change <strong>{targetName}</strong>
            </span>
          ) : null}
          {sequenceOff ? <span>Sequence is OFF — the pedal ignores these steps until you turn it on.</span> : null}
        </p>
      ) : null}

      <div className="step-seq-board">
        <div
          ref={barsRef}
          className="step-seq-bars"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {layout.stepTags.map((tag, i) => (
            <div key={tag} className="step-seq-step">
              {lanes.map((lane) => bar(lane, i))}
            </div>
          ))}
        </div>
        <div className="step-seq-zeros">
          {layout.stepTags.map((tag, i) => (
            <div key={tag} className="step-seq-step">
              {lanes.map((lane) => {
                const value = valuesOf(lane)[i]!;
                const name = lengthTags ? (lane === "length" ? "Length" : "Level") : "Step";
                return (
                  <button
                    key={lane}
                    type="button"
                    className={`step-seq-zero is-${lane}${value > 0 ? " is-on" : ""}${i >= activeCount ? " is-inactive" : ""}${i === playhead ? " is-playing" : ""}`}
                    aria-pressed={value > 0}
                    aria-label={`Step ${i + 1} ${name}: ${value > 0 ? "on" : "zero"}`}
                    title={value > 0 ? `Set ${name} to 0` : `Bring ${name} back`}
                    onClick={() =>
                      setStep(lane, i, value > 0 ? 0 : (lastNonZero.current[lane][i] ?? restoreDefault(lane)))
                    }
                  >
                    {lanes.length > 1 ? (lane === "length" ? "L" : i + 1) : i + 1}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="param-columns step-seq-settings">
        {headerDefs.map((def) => {
          const view = def.kind === "enum" && def.options ? targetView(def) : HEADER_VIEWS[def.name];
          if (!view) return null;
          return (
            <TrackStateCard
              key={def.tag}
              id={`${idPrefix}-${def.tag}`}
              def={def}
              view={view}
              value={num(tags, def.tag, def.default ?? 0)}
              onChange={(v) => onSet({ [def.tag]: String(v) })}
            />
          );
        })}
        {rateDef ? (
          <ScrubCard
            id={`${idPrefix}-${layout.rateTag}`}
            def={rateDef}
            value={rateIndex}
            min={rateDef.options?.[0]?.value ?? 0}
            max={rateDef.options?.at(-1)?.value ?? 118}
            format={rateCardValue}
            alert
            color="var(--slot-color)"
            valueIcon="note"
            onChange={(v) => onSet({ [layout.rateTag]: String(v) })}
          />
        ) : null}
        {stepMaxDef ? (
          <ScrubCard
            id={`${idPrefix}-${layout.stepMaxTag}`}
            def={stepMaxDef}
            value={stepMax}
            min={stepMaxDef.min ?? 0}
            max={stepMaxDef.max ?? 15}
            format={(v) => ({ value: String(v + 1), unit: v === 0 ? "Step" : "Steps" })}
            alert
            color="var(--slot-color)"
            valueIcon="blocks"
            onChange={(v) => onSet({ [layout.stepMaxTag]: String(v) })}
          />
        ) : null}
      </div>
    </section>
  );
}
