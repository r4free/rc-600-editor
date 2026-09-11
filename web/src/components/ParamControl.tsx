import type { ParamDef } from "@rc600/catalog/params";
import { displayParam } from "@rc600/catalog/params";
import { InfoTip } from "./InfoTip";

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
