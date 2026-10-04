import type { CSSProperties } from "react";
import type { ParamDef } from "@rc600/catalog/params";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";

const FLAT = "FLAT";
const CUT_STEP_DROP = 16;
const MIN_CUT_HEIGHT = 10;

/** Bar heights (%) for a low or high cut: passed bands full, cut bands sloping down from the cutoff. */
export function filterBars(bandCount: number, cutBand: number | null, low: boolean): { height: number; passed: boolean }[] {
  return Array.from({ length: bandCount }, (_, i) => {
    if (cutBand === null) return { height: 100, passed: true };
    const distance = low ? cutBand - i : i - cutBand;
    if (distance <= 0) return { height: 100, passed: true };
    return { height: Math.max(MIN_CUT_HEIGHT, 100 - distance * CUT_STEP_DROP), passed: false };
  });
}

/** Yellow at the lowest band to orange at the highest. */
export function filterBarColor(index: number, bandCount: number): string {
  const t = bandCount > 1 ? index / (bandCount - 1) : 0;
  return `hsl(${Math.round(50 - t * 26)} 95% ${Math.round(56 - t * 4)}%)`;
}

const SHELF_BANDS = 16;
const SHELF_MAX_DB = 20;

/**
 * Bar heights (%) for a low or high shelf of `db` (−20…+20): 50% is flat, the shelved end
 * rises (boost) or dips (cut) and blends back to flat across the middle bands.
 */
export function shelfBars(db: number, low: boolean, bandCount = SHELF_BANDS): { height: number; shaped: boolean }[] {
  const g = Math.max(-SHELF_MAX_DB, Math.min(SHELF_MAX_DB, db)) / SHELF_MAX_DB;
  const center = (bandCount - 1) * (low ? 0.3 : 0.7);
  return Array.from({ length: bandCount }, (_, i) => {
    const weight = 1 / (1 + Math.exp((low ? i - center : center - i) / 1.2));
    const offset = g * weight * 45;
    return { height: Math.round(50 + offset), shaped: Math.abs(offset) >= 4 };
  });
}

/** Low Gain / Hi Gain (raw 0–40 = −20…+20 dB) as a mini equalizer curve. */
export function ShelfGainControl({
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
  const low = /^Lo/.test(def.name);
  const db = value - SHELF_MAX_DB;
  const flat = db === 0;
  const bars = shelfBars(db, low);
  const label = `${db > 0 ? "+" : ""}${db} dB`;
  const region = low ? "lows" : "highs";
  return (
    <div className={`param-row volume-param filter-cut-param shelf-gain-param${flat ? " is-flat" : ""}`}>
      <div className="volume-param-head">
        <div className="param-label">
          <label htmlFor={id}>{def.name}</label>
          {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
        </div>
        <strong className="volume-param-value">
          <Icon name="equalizer" className="volume-param-value-icon" />
          {label}
        </strong>
      </div>
      <div className="volume-param-slider">
        <div className="volume-param-segments" aria-hidden="true">
          {bars.map((bar, i) => (
            <i
              key={i}
              className={bar.shaped ? "is-position" : ""}
              style={
                {
                  height: `${bar.height}%`,
                  "--volume-segment-color": filterBarColor(i, bars.length),
                } as CSSProperties
              }
            />
          ))}
        </div>
        <input
          id={id}
          type="range"
          min={0}
          max={SHELF_MAX_DB * 2}
          value={value}
          aria-valuetext={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="volume-param-scale" aria-hidden="true">
        <span>−20 dB</span>
        <span>{flat ? "Flat" : db > 0 ? `Boosts ${region}` : `Cuts ${region}`}</span>
        <span>+20 dB</span>
      </div>
    </div>
  );
}

/**
 * Lo Cut / High Cut as a mini equalizer: one bar per frequency, FLAT at the end where the
 * filter does nothing (left for Lo Cut, right for High Cut).
 */
export function FilterCutControl({
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
  const options = def.options ?? [];
  const low = def.name === "Lo Cut" || def.name === "Low Cut";
  const bands = options.filter((o) => o.label !== FLAT);
  const label = options.find((o) => o.value === value)?.label ?? FLAT;
  const flat = label === FLAT;
  const cutBand = flat ? null : bands.findIndex((o) => o.value === value);
  const bars = filterBars(bands.length, cutBand, low);
  const min = options[0]?.value ?? 0;
  const max = options.at(-1)?.value ?? 0;
  return (
    <div className={`param-row volume-param filter-cut-param${flat ? " is-flat" : ""}`}>
      <div className="volume-param-head">
        <div className="param-label">
          <label htmlFor={id}>{def.name}</label>
          {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
        </div>
        <strong className="volume-param-value">
          <Icon name={low ? "fadeIn" : "fadeOut"} className="volume-param-value-icon" />
          {label}
        </strong>
      </div>
      <div className="volume-param-slider">
        <div className="volume-param-segments" aria-hidden="true">
          {bars.map((bar, i) => (
            <i
              key={bands[i]!.value}
              className={`${bar.passed ? "is-active" : ""}${i === cutBand ? " is-position" : ""}`}
              style={
                {
                  height: `${bar.height}%`,
                  "--volume-segment-color": filterBarColor(i, bands.length),
                } as CSSProperties
              }
            />
          ))}
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          aria-valuetext={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="volume-param-scale" aria-hidden="true">
        <span>{low ? FLAT : bands[0]?.label}</span>
        <span>{flat ? "No filter" : low ? "Cuts lows" : "Cuts highs"}</span>
        <span>{low ? bands.at(-1)?.label : FLAT}</span>
      </div>
    </div>
  );
}
