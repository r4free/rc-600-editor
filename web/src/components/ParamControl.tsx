import type { CSSProperties } from "react";
import type { ParamDef } from "@rc600/catalog/params";
import { displayParam } from "@rc600/catalog/params";
import { InfoTip } from "./InfoTip";

const VOLUME_SEGMENTS = 32;
const PAN_SEGMENTS = 33;

function isVolumeParam(def: ParamDef): boolean {
  if (def.kind !== "int") return false;
  const description = def.info?.toLowerCase() ?? "";
  return (
    /\bvolume\b/.test(description) ||
    /\b(playback|input|output) level\b/.test(description)
  );
}

function isPanParam(def: ParamDef): boolean {
  return def.kind === "int" && def.name.trim().toLowerCase() === "pan";
}

function volumeSegmentColor(segmentValue: number): string {
  if (segmentValue <= 100) {
    const progress = Math.max(0, segmentValue) / 100;
    return `hsl(${145 - progress * 25} 62% ${38 + progress * 12}%)`;
  }
  if (segmentValue <= 130) {
    const progress = (segmentValue - 100) / 30;
    return `hsl(${42 - progress * 24} 88% ${54 - progress * 4}%)`;
  }
  if (segmentValue <= 170) {
    const progress = (segmentValue - 130) / 40;
    return `hsl(${18 - progress * 15} 82% ${50 - progress * 6}%)`;
  }
  const progress = Math.min(1, (segmentValue - 170) / 30);
  return `hsl(0 72% ${44 - progress * 16}%)`;
}

function ParamLabel({ def, id }: { def: ParamDef; id: string }) {
  return (
    <div className="param-label">
      <label htmlFor={id}>{def.name}</label>
      {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
    </div>
  );
}

function PowerSwitch({
  id,
  on,
  onChange,
  disabled = false,
}: {
  id: string;
  on: boolean;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      className={`power-switch${on ? " on" : ""}`}
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(on ? 0 : 1)}
    >
      <span className="power-switch-track">
        <span className="power-switch-thumb" />
      </span>
      <span className="power-switch-state">{on ? "ON" : "OFF"}</span>
    </button>
  );
}

export function ParamControl({
  def,
  value,
  onChange,
  id,
  disabled = false,
}: {
  def: ParamDef;
  value: number;
  onChange: (v: number) => void;
  id: string;
  disabled?: boolean;
}) {
  if (def.kind === "bool") {
    return (
      <div className={`param-row${disabled ? " readonly" : ""}`}>
        <ParamLabel def={def} id={id} />
        <div className="param-control">
          <PowerSwitch
            id={id}
            on={Boolean(value)}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  if (def.kind === "enum" && def.options) {
    return (
      <div className={`param-row${disabled ? " readonly" : ""}`}>
        <ParamLabel def={def} id={id} />
        <div className="param-control">
          <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          >
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const min = def.min ?? 0;
  const max = def.max ?? 127;
  if (isPanParam(def)) {
    const progress = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    const selectedIndex = Math.round(progress * (PAN_SEGMENTS - 1));
    const centerIndex = Math.floor(PAN_SEGMENTS / 2);
    const activeStart = Math.min(centerIndex, selectedIndex);
    const activeEnd = Math.max(centerIndex, selectedIndex);
    return (
      <div className={`param-row pan-param${disabled ? " readonly" : ""}`}>
        <div className="volume-param-head">
          <ParamLabel def={def} id={id} />
          <strong className="volume-param-value">{displayParam(def, value)}</strong>
        </div>
        <div className="volume-param-slider pan-param-slider">
          <div className="volume-param-segments pan-param-segments" aria-hidden="true">
            {Array.from({ length: PAN_SEGMENTS }, (_, index) => {
              const distanceFromCenter = Math.abs(index - centerIndex) / centerIndex;
              const active = index >= activeStart && index <= activeEnd;
              return (
                <i
                  key={index}
                  className={`${active ? "is-active" : ""}${index === selectedIndex ? " is-position" : ""}`}
                  style={{ height: `${32 + distanceFromCenter * 68}%` }}
                />
              );
            })}
          </div>
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
        <div className="volume-param-scale pan-param-scale" aria-hidden="true">
          <span>L</span>
          <span>Center</span>
          <span>R</span>
        </div>
      </div>
    );
  }

  if (isVolumeParam(def)) {
    const progress = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    const activeSegments = Math.round(progress * VOLUME_SEGMENTS);
    return (
      <div className={`param-row volume-param${disabled ? " readonly" : ""}`}>
        <div className="volume-param-head">
          <ParamLabel def={def} id={id} />
          <strong className="volume-param-value">{displayParam(def, value)}</strong>
        </div>
        <div className="volume-param-slider">
          <div className="volume-param-segments" aria-hidden="true">
            {Array.from({ length: VOLUME_SEGMENTS }, (_, index) => (
              <i
                key={index}
                className={index < activeSegments ? "is-active" : undefined}
                style={
                  {
                    height: `${35 + (index / (VOLUME_SEGMENTS - 1)) * 65}%`,
                    "--volume-segment-color": volumeSegmentColor(
                      min + (index / (VOLUME_SEGMENTS - 1)) * (max - min),
                    ),
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
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
        <div className="volume-param-scale" aria-hidden="true">
          <span>{min}</span>
          <span>Volume</span>
          <span>{max}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`param-row${disabled ? " readonly" : ""}`}>
      <ParamLabel def={def} id={id} />
      <div className="param-control param-slider">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="param-val">{displayParam(def, value)}</span>
      </div>
    </div>
  );
}

export function TagMapEditor({
  tags,
  onChange,
  filterTags,
}: {
  tags: Record<string, string>;
  onChange: (tag: string, value: string) => void;
  filterTags?: string[];
}) {
  const keys = (filterTags ?? Object.keys(tags)).filter((k) => tags[k] !== undefined);
  return (
    <div className="tag-editor">
      {keys.map((tag) => (
        <div key={tag}>
          <label htmlFor={`tag-${tag}`}>{tag}</label>
          <input
            id={`tag-${tag}`}
            type="text"
            value={tags[tag] ?? ""}
            onChange={(e) => onChange(tag, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
