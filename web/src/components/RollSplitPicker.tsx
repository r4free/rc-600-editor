import type { ParamDef } from "@rc600/catalog/params";
import { InfoTip } from "./InfoTip";

/** ROLL option index → number of slices the loop cycle is split into (OFF = 1). */
export const rollSlices = (value: number) => 2 ** Math.max(0, Math.min(4, value));

/** ROLL as a row of buttons, each drawing the loop cycle split into its slices. */
export function RollSplitPicker({
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
        {(def.options ?? []).map((o) => {
          const active = o.value === value;
          const slices = rollSlices(o.value);
          const gap = slices > 8 ? 0.6 : 1;
          const w = (36 - gap * (slices - 1)) / slices;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`osc-wave roll-split${active ? " is-active" : ""}`}
              title={o.value === 0 ? "OFF: loops the whole Time cycle" : `${o.label}: splits the Time cycle into ${slices} slices`}
              onClick={() => onChange(o.value)}
            >
              <svg viewBox="0 0 40 20" aria-hidden="true">
                {Array.from({ length: slices }, (_, i) => (
                  <rect key={i} x={2 + i * (w + gap)} y={5} width={w} height={10} rx={Math.min(1.2, w / 3)} />
                ))}
              </svg>
              <span>{o.value === 0 ? "Off" : o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
