import type { ParamDef } from "@rc600/catalog/params";
import { InfoTip } from "./InfoTip";

/** Body / label colors and a short description per Dist TYPE (VOCAL, BOOST, OD, DS, METAL, FUZZ). */
export const DIST_PEDALS: { body: string; ink: string; title: string; label: string }[] = [
  { body: "#e9e6f2", ink: "#5b3fa0", label: "Vocal", title: "Distortion voiced for vocals." },
  { body: "#2f6bd8", ink: "#0c1430", label: "Boost", title: "Clean boost that pushes the level with light grit." },
  { body: "#f3c623", ink: "#1a1a1a", label: "Overdrive", title: "Warm, amp-like overdrive." },
  { body: "#f07b1c", ink: "#1a1a1a", label: "Distortion", title: "Classic, tighter distortion." },
  { body: "#3b3e44", ink: "#f07b1c", label: "Metal", title: "High-gain metal distortion." },
  { body: "#b9bec6", ink: "#1a1a1a", label: "Fuzz", title: "Thick, buzzy fuzz." },
];

/** Knob angle (degrees) for a 0–100 value: −135° (min) to +135° (max). */
export const knobAngle = (v: number) => -135 + (Math.max(0, Math.min(100, v)) / 100) * 270;

function Pedal({
  index,
  name,
  active,
  knobs,
}: {
  index: number;
  name: string;
  active: boolean;
  knobs: [number, number, number];
}) {
  const p = DIST_PEDALS[index] ?? DIST_PEDALS[2]!;
  return (
    <svg className="dist-pedal-svg" viewBox="0 0 40 64" aria-hidden="true">
      <rect x="1.5" y="1.5" width="37" height="61" rx="4" fill={p.body} stroke="rgb(0 0 0 / 45%)" />
      <rect x="1.5" y="1.5" width="37" height="22" rx="4" fill="rgb(0 0 0 / 12%)" />
      {knobs.map((v, i) => {
        const cx = 9 + i * 11;
        return (
          <g key={i} transform={`rotate(${knobAngle(v)} ${cx} 10)`}>
            <circle cx={cx} cy="10" r="4.3" fill="#141518" stroke="rgb(255 255 255 / 18%)" strokeWidth="0.5" />
            <line x1={cx} y1="10" x2={cx} y2="6.3" stroke="#f5f5f5" strokeWidth="0.9" strokeLinecap="round" />
          </g>
        );
      })}
      <circle cx="20" cy="19.5" r="1.4" className={`dist-pedal-led${active ? " is-on" : ""}`} />
      <text x="20" y="31" textAnchor="middle" className="dist-pedal-name" fill={p.ink}>
        {name}
      </text>
      <rect x="6" y="36" width="28" height="23" rx="2" fill="#2a2c31" />
      {[40, 43, 46, 49, 52, 55].map((y) => (
        <line key={y} x1="8.5" y1={y} x2="31.5" y2={y} stroke="#3b3e44" strokeWidth="1" />
      ))}
    </svg>
  );
}

/** Dist TYPE as a row of compact pedals; the selected one shows its Level, Tone and Dist knobs. */
export function DistPedalPicker({
  id,
  def,
  value,
  knobs,
  onChange,
}: {
  id: string;
  def: ParamDef;
  value: number;
  /** E.Level, Tone and Dist as 0–100, drawn on the selected pedal. */
  knobs: [number, number, number];
  onChange: (v: number) => void;
}) {
  const options = def.options ?? [];
  return (
    <div className="param-row dist-pedal-param">
      <div className="param-label">
        <label id={`${id}-label`}>{def.name}</label>
        {def.info ? <InfoTip label={def.name} text={def.info} /> : null}
      </div>
      <div className="dist-pedals" role="radiogroup" aria-labelledby={`${id}-label`}>
        {options.map((o, i) => {
          const active = o.value === value;
          const p = DIST_PEDALS[i] ?? DIST_PEDALS[2]!;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`dist-pedal${active ? " is-active" : ""}`}
              title={`${o.label}: ${p.title}`}
              onClick={() => onChange(o.value)}
            >
              <Pedal index={i} name={o.label} active={active} knobs={active ? knobs : [50, 50, 50]} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
