import type { CSSProperties } from "react";
import type { ParamDef } from "@rc600/catalog/params";
import { filterBarColor } from "./FilterCutControl";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";

const BAND_LABELS = ["Low", "Mid", "High"];
const ISOLATOR_BARS = 16;
/** First bar of Mid and of High (Low 0–4, Mid 5–10, High 11–15). */
const BAND_STARTS = [0, 5, 11];
const MIN_CUT_HEIGHT = 12;

export function isolatorBandOf(bar: number): number {
  return bar >= BAND_STARTS[2]! ? 2 : bar >= BAND_STARTS[1]! ? 1 : 0;
}

/**
 * Bar heights (%) across the spectrum: the bars of the selected band drop by Band Level
 * (100 = down to the floor), the bars next to it dip halfway, the rest stay full.
 */
export function isolatorBars(band: number, bandLevel: number, bandCount = ISOLATOR_BARS): { height: number; cut: boolean }[] {
  const cut = Math.max(0, Math.min(100, bandLevel)) / 100;
  const low = 100 - cut * (100 - MIN_CUT_HEIGHT);
  return Array.from({ length: bandCount }, (_, i) => {
    const inBand = isolatorBandOf(i) === band;
    const edge = !inBand && (isolatorBandOf(i - 1) === band || isolatorBandOf(i + 1) === band) && i > 0 && i < bandCount - 1;
    if (inBand) return { height: Math.round(low), cut: cut > 0 };
    if (edge) return { height: Math.round((100 + low) / 2), cut: false };
    return { height: 100, cut: false };
  });
}

/** Band (LOW / MIDDLE / HIGH) as a mini equalizer: the selected range dips by Band Level. */
export function IsolatorBandControl({
  id,
  def,
  value,
  bandLevel,
  onChange,
}: {
  id: string;
  def: ParamDef;
  value: number;
  bandLevel: number;
  onChange: (v: number) => void;
}) {
  const band = Math.max(0, Math.min(2, value));
  const bars = isolatorBars(band, bandLevel);
  const label = BAND_LABELS[band]!;
  const min = def.options?.[0]?.value ?? 0;
  const max = def.options?.at(-1)?.value ?? 2;
  return (
    <div className={`param-row volume-param filter-cut-param isolator-band-param${bandLevel <= 0 ? " is-flat" : ""}`}>
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
              className={bar.cut ? undefined : isolatorBandOf(i) === band ? "is-position" : "is-active"}
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
          min={min}
          max={max}
          step={1}
          value={band}
          aria-valuetext={`${label} band is cut`}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="volume-param-scale isolator-band-scale" aria-hidden="true">
        {BAND_LABELS.map((name, i) => (
          <span key={name} className={i === band ? "is-selected" : undefined}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
