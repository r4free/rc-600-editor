import { useEffect, useRef } from "react";
import type { ParamDef } from "@rc600/catalog/params";
import type { TagMap } from "@rc600/rc0/memory";
import { InfoTip } from "./InfoTip";

const WHEEL_STEP = 40;

/** "250 Hz" → 250 / Hz, dB steps centered on 0, Q values captioned. */
export function eqDisplay(def: ParamDef, v: number): { value: string; unit?: string } {
  if (!def.options) {
    const db = v - 20;
    return { value: db > 0 ? `+${db}` : String(db), unit: "dB" };
  }
  const label = def.options.find((o) => o.value === v)?.label ?? String(v);
  if (label === "FLAT") return { value: "Flat" };
  const space = label.lastIndexOf(" ");
  if (space > 0) return { value: label.slice(0, space), unit: label.slice(space + 1) };
  return { value: label, unit: "Q" };
}

export function eqRange(def: ParamDef): { min: number; max: number } {
  return def.options
    ? { min: def.options[0]?.value ?? 0, max: def.options[def.options.length - 1]?.value ?? 0 }
    : { min: def.min ?? 0, max: def.max ?? 0 };
}

/** Bands low to high, then output level. `short` is the caption under each fader. */
const EQ_BANDS: { title: string; faders: { tag: string; short: string }[] }[] = [
  { title: "Lo Cut", faders: [{ tag: "K", short: "Freq" }] },
  { title: "Low", faders: [{ tag: "B", short: "Gain" }] },
  {
    title: "Lo Mid",
    faders: [
      { tag: "D", short: "Freq" },
      { tag: "E", short: "Q" },
      { tag: "F", short: "Gain" },
    ],
  },
  {
    title: "Hi Mid",
    faders: [
      { tag: "G", short: "Freq" },
      { tag: "H", short: "Q" },
      { tag: "I", short: "Gain" },
    ],
  },
  { title: "High", faders: [{ tag: "C", short: "Gain" }] },
  { title: "Hi Cut", faders: [{ tag: "L", short: "Freq" }] },
  { title: "Output", faders: [{ tag: "J", short: "Level" }] },
];

function num(tags: TagMap, tag: string, fallback: number): number {
  const n = parseInt(tags[tag] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export function EqFader({
  id,
  def,
  short,
  value,
  onChange,
  display = eqDisplay,
}: {
  id: string;
  def: ParamDef;
  short: string;
  value: number;
  onChange: (v: number) => void;
  /** Optional value formatter for fader boards that reuse the mixer EQ layout. */
  display?: (def: ParamDef, value: number) => { value: string; unit?: string };
}) {
  const { min, max } = eqRange(def);
  const span = Math.max(1, max - min);
  const bipolar = !def.options;
  const fallback = def.default ?? min;
  const railRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const wheelRef = useRef(0);

  const commit = (v: number) => {
    const next = Math.max(min, Math.min(max, Math.round(v)));
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    const el = railRef.current?.parentElement;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
      while (Math.abs(wheelRef.current) >= WHEEL_STEP) {
        const dir = Math.sign(wheelRef.current);
        wheelRef.current -= dir * WHEEL_STEP;
        commitRef.current(valueRef.current + dir);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fromPointer = (clientY: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    commit(min + Math.max(0, Math.min(1, ratio)) * span);
  };

  const pct = ((value - min) / span) * 100;
  const centerPct = ((fallback - min) / span) * 100;
  const fill = bipolar
    ? { bottom: Math.min(pct, centerPct), height: Math.abs(pct - centerPct) }
    : { bottom: 0, height: pct };
  const shown = display(def, value);
  const text = `${shown.value}${shown.unit ? ` ${shown.unit}` : ""}`;
  const changed = value !== fallback;

  return (
    <div className={`eq-fader${bipolar ? " is-gain" : ""}${changed ? " is-changed" : ""}`}>
      <div className="eq-fader-readout">
        <span className="eq-fader-value">{shown.value}</span>
        <span className="eq-fader-unit">{shown.unit ?? "\u00a0"}</span>
      </div>
      <div
        id={id}
        className="eq-fader-track"
        role="slider"
        tabIndex={0}
        aria-label={def.name}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        title={`${def.name}: ${text}. Drag, scroll or use the arrow keys. Double-click to reset.`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
          fromPointer(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientY);
        }}
        onDoubleClick={() => commit(fallback)}
        onKeyDown={(e) => {
          const page = Math.max(1, Math.round(span / 10));
          const moves: Record<string, number> = {
            ArrowUp: value + 1,
            ArrowRight: value + 1,
            ArrowDown: value - 1,
            ArrowLeft: value - 1,
            PageUp: value + page,
            PageDown: value - page,
            Home: min,
            End: max,
          };
          if (e.key in moves) {
            e.preventDefault();
            commit(moves[e.key]);
          }
        }}
      >
        <div className="eq-fader-rail" ref={railRef}>
          {bipolar ? <span className="eq-fader-zero" style={{ bottom: `${centerPct}%` }} /> : null}
          <span className="eq-fader-fill" style={{ bottom: `${fill.bottom}%`, height: `${fill.height}%` }} />
          <span className="eq-fader-thumb" style={{ bottom: `${pct}%` }} />
        </div>
      </div>
      <div className="eq-fader-label">
        <span>{short}</span>
        {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
      </div>
    </div>
  );
}

/** Console-style EQ: one vertical fader per parameter, grouped by band. */
export function EqFaderBoard({
  idPrefix,
  params,
  switchTag,
  tags,
  onChange,
}: {
  idPrefix: string;
  params: ParamDef[];
  switchTag: string;
  tags: TagMap;
  onChange: (tag: string, value: number) => void;
}) {
  const switchDef = params.find((p) => p.tag === switchTag);
  const on = switchDef ? num(tags, switchTag, switchDef.default ?? 0) !== 0 : true;
  const switchId = `${idPrefix}-${switchTag}`;

  return (
    <div className={`eq-board${on ? "" : " is-bypassed"}`}>
      {switchDef ? (
        <div className="eq-board-head">
          <div className="param-label">
            <label htmlFor={switchId}>{switchDef.name}</label>
            {switchDef.info ? <InfoTip label={switchDef.name} text={switchDef.info} /> : null}
          </div>
          <button
            id={switchId}
            type="button"
            role="switch"
            className={`power-switch${on ? " on" : ""}`}
            aria-checked={on}
            onClick={() => onChange(switchTag, on ? 0 : 1)}
          >
            <span className="power-switch-track">
              <span className="power-switch-thumb" />
            </span>
            <span className="power-switch-state">{on ? "ON" : "OFF"}</span>
          </button>
          {on ? null : <span className="eq-board-note">Bypassed — changes are kept but not heard.</span>}
        </div>
      ) : null}
      <div className="eq-board-bands">
        {EQ_BANDS.map((band) => (
          <section key={band.title} className="eq-band">
            <div className="eq-band-faders">
              {band.faders.map(({ tag, short }) => {
                const def = params.find((p) => p.tag === tag);
                if (!def) return null;
                return (
                  <EqFader
                    key={tag}
                    id={`${idPrefix}-${tag}`}
                    def={def}
                    short={short}
                    value={num(tags, tag, def.default ?? 0)}
                    onChange={(v) => onChange(tag, v)}
                  />
                );
              })}
            </div>
            <h4 className="eq-band-title">{band.title}</h4>
          </section>
        ))}
      </div>
    </div>
  );
}
