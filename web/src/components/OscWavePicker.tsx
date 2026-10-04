import type { ParamDef } from "@rc600/catalog/params";
import { InfoTip } from "./InfoTip";

/** SVG paths (viewBox 0 0 40 20) and a readable name per OSC wave: SAW, VINTAGE SAW, DETUNE SAW, SQUARE, RECT. */
export const OSC_WAVES: { name: string; title: string; paths: string[] }[] = [
  { name: "Saw", title: "Bright, buzzy sawtooth.", paths: ["M2 16 L14 4 V16 L26 4 V16 L38 4 V16"] },
  {
    name: "Vintage Saw",
    title: "Softer, rounder sawtooth, like an old analog synth.",
    paths: ["M2 16 Q9 9 14 4 V16 Q21 9 26 4 V16 Q33 9 38 4 V16"],
  },
  {
    name: "Detune Saw",
    title: "Two slightly detuned sawtooths for a thick, chorused sound.",
    paths: ["M2 16 L14 4 V16 L26 4 V16 L38 4 V16", "M2 13 L10 5 V16 L22 5 V16 L34 5 V16 L38 12"],
  },
  { name: "Square", title: "Hollow square wave.", paths: ["M2 16 V4 H11 V16 H20 V4 H29 V16 H38 V4"] },
  { name: "Rect", title: "Narrow pulse wave, thinner and nasal.", paths: ["M2 16 V4 H5 V16 H14 V4 H17 V16 H26 V4 H29 V16 H38"] },
];

/** OSC waveform as a row of buttons, each drawing its wave shape. */
export function OscWavePicker({
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
  return (
    <div className="param-row osc-wave-param">
      <div className="param-label">
        <label id={`${id}-label`}>{def.name}</label>
        {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
      </div>
      <div className="osc-waves" role="radiogroup" aria-labelledby={`${id}-label`}>
        {(def.options ?? []).map((o, i) => {
          const wave = OSC_WAVES[i];
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`osc-wave${active ? " is-active" : ""}`}
              title={wave ? `${o.label}: ${wave.title}` : o.label}
              onClick={() => onChange(o.value)}
            >
              <svg viewBox="0 0 40 20" aria-hidden="true">
                {(wave?.paths ?? []).map((d, k) => (
                  <path key={k} d={d} className={k > 0 ? "is-second" : undefined} />
                ))}
              </svg>
              <span>{wave?.name ?? o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
