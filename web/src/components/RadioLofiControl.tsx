import type { CSSProperties } from "react";
import type { ParamDef } from "@rc600/catalog/params";
import { radioBand } from "../audio/radioPreview";
import { filterBarColor } from "./FilterCutControl";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";

const BARS = 16;
const MIN_HZ = 60;
const MAX_HZ = 12000;
const OCTAVE_DROP = 38;
const MIN_HEIGHT = 10;

/** Center frequency of each spectrum bar, log-spaced from 60 Hz to 12 kHz. */
export function radioBarHz(index: number, count = BARS): number {
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** (index / (count - 1));
}

/** Bar heights (%) for the radio passband at LO-FI 1–10: inside the band full, outside sloping by octave. */
export function radioBars(lofi: number, count = BARS): { height: number; passed: boolean }[] {
  const { lowHz, highHz } = radioBand(lofi);
  return Array.from({ length: count }, (_, i) => {
    const hz = radioBarHz(i, count);
    const octaves = hz < lowHz ? Math.log2(lowHz / hz) : hz > highHz ? Math.log2(hz / highHz) : 0;
    if (octaves === 0) return { height: 100, passed: true };
    return { height: Math.max(MIN_HEIGHT, Math.round(100 - octaves * OCTAVE_DROP)), passed: false };
  });
}

export function hzLabel(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1).replace(/\.0$/, "")} kHz` : `${Math.round(hz)} Hz`;
}

/** LO-FI 1–10 as a mini equalizer: the band the radio lets through narrows as the value rises. */
export function RadioLofiControl({
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
  const min = def.min ?? 1;
  const max = def.max ?? 10;
  const band = radioBand(value);
  const bars = radioBars(value);
  const range = `${hzLabel(band.lowHz)} – ${hzLabel(band.highHz)}`;
  return (
    <div className="param-row volume-param filter-cut-param radio-lofi-param">
      <div className="volume-param-head">
        <div className="param-label">
          <label htmlFor={id}>{def.name}</label>
          {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
        </div>
        <strong className="volume-param-value">
          <Icon name="radio" className="volume-param-value-icon" />
          {value}
        </strong>
      </div>
      <div className="volume-param-slider">
        <div className="volume-param-segments" aria-hidden="true">
          {bars.map((bar, i) => (
            <i
              key={i}
              className={bar.passed ? "is-active" : ""}
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
          value={value}
          aria-valuetext={`${value}, passes ${range}`}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="volume-param-scale" aria-hidden="true">
        <span>{min} Clear</span>
        <span>{range}</span>
        <span>Blurry {max}</span>
      </div>
    </div>
  );
}
