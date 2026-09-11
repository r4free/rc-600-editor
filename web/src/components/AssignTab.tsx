import { ASSIGN_PARAMS, assignSourceInfo, type ParamDef } from "@rc600/catalog/params";
import {
  assignRangeOptions,
  assignTargetInfo,
  assignTargetOptions,
  assignTargetRange,
  clampAssignValue,
  formatAssignValue,
  type AssignValueRange,
} from "@rc600/catalog/assign-targets";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { InfoTip } from "./InfoTip";
import type { PatchHandler } from "./LoopTab";

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function enumOptions(def: ParamDef, value: number) {
  const options = def.options ? [...def.options] : [];
  if (!options.some((o) => o.value === value)) {
    options.push({ value, label: `Value ${value}` });
  }
  return options;
}

function targetOptions(value: number) {
  const options = assignTargetOptions();
  if (!options.some((o) => o.value === value)) {
    options.push({ value, label: `Value ${value}` });
  }
  return options;
}

function RangeControl({
  range,
  value,
  ariaLabel,
  onChange,
}: {
  range: AssignValueRange;
  value: number;
  ariaLabel: string;
  onChange: (v: number) => void;
}) {
  if (range.kind === "enum") {
    return (
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {assignRangeOptions(range, value).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <label className="assign-int">
      <input
        type="number"
        min={range.min}
        max={range.max}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {range.format ? <span className="param-val">{formatAssignValue(range, value)}</span> : null}
    </label>
  );
}

export function AssignTab({ model, onPatch }: { model: MemoryModel; onPatch: PatchHandler }) {
  const patch = (index: number, tags: TagMap) =>
    onPatch({ type: "assign", assign: index + 1, tags });

  return (
    <table className="assign-table">
      <thead>
        <tr>
          <th>#</th>
          {ASSIGN_PARAMS.map((p) => (
            <th key={p.tag}>
              <span className="assign-th">
                {p.name}
                {p.info ? <InfoTip label={p.name} text={p.info} /> : null}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.assigns.map((asg, i) => {
          const target = num(asg, "G");
          const range = assignTargetRange(target);
          const targetInfo = assignTargetInfo(target);
          return (
            <tr key={i}>
              <td>{i + 1}</td>
              {ASSIGN_PARAMS.map((p) => {
                const value = num(asg, p.tag);
                if (p.tag === "A") {
                  return (
                    <td key={p.tag}>
                      <button
                        type="button"
                        className={`btn ${value ? "primary" : "ghost"}`}
                        onClick={() => patch(i, { A: value ? "0" : "1" })}
                      >
                        {value ? "ON" : "OFF"}
                      </button>
                    </td>
                  );
                }

                if (p.tag === "G") {
                  return (
                    <td key={p.tag}>
                      <div className="assign-enum">
                        <select
                          className="assign-target"
                          value={target}
                          title={targetInfo}
                          aria-label={`Target ${i + 1}`}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            const nextRange = assignTargetRange(next);
                            patch(i, {
                              G: String(next),
                              H: String(clampAssignValue(nextRange, num(asg, "H"))),
                              I: String(clampAssignValue(nextRange, num(asg, "I"))),
                            });
                          }}
                        >
                          {targetOptions(target).map((o) => (
                            <option
                              key={o.value}
                              value={o.value}
                              title={assignTargetInfo(o.value)}
                            >
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {targetInfo ? <InfoTip label="Target" text={targetInfo} /> : null}
                      </div>
                    </td>
                  );
                }

                if (p.tag === "H" || p.tag === "I") {
                  return (
                    <td key={p.tag}>
                      <RangeControl
                        range={range}
                        value={value}
                        ariaLabel={`${p.name} ${i + 1}`}
                        onChange={(v) => patch(i, { [p.tag]: String(clampAssignValue(range, v)) })}
                      />
                    </td>
                  );
                }

                if (p.kind === "enum" && p.options) {
                  const sourceInfo = p.tag === "B" ? assignSourceInfo(value) : undefined;
                  return (
                    <td key={p.tag}>
                      <div className="assign-enum">
                        <select
                          value={value}
                          title={sourceInfo}
                          aria-label={`${p.name} ${i + 1}`}
                          onChange={(e) => patch(i, { [p.tag]: String(Number(e.target.value) || 0) })}
                        >
                          {enumOptions(p, value).map((o) => (
                            <option
                              key={o.value}
                              value={o.value}
                              title={p.tag === "B" ? assignSourceInfo(o.value) : undefined}
                            >
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {sourceInfo ? <InfoTip label={p.name} text={sourceInfo} /> : null}
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={p.tag}>
                    <input
                      type="number"
                      min={p.min}
                      max={p.max}
                      value={value}
                      aria-label={`${p.name} ${i + 1}`}
                      onChange={(e) =>
                        patch(i, { [p.tag]: String(Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
