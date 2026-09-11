import type { ParamDef } from "@rc600/catalog/params";
import { displayParam } from "@rc600/catalog/params";

export function ParamControl({
  def,
  value,
  onChange,
  id,
}: {
  def: ParamDef;
  value: number;
  onChange: (v: number) => void;
  id: string;
}) {
  if (def.kind === "bool") {
    return (
      <div className="param-card">
        <label htmlFor={id}>{def.name}</label>
        <button
          id={id}
          type="button"
          className={`btn ${value ? "primary" : "ghost"}`}
          onClick={() => onChange(value ? 0 : 1)}
        >
          {displayParam(def, value)}
        </button>
      </div>
    );
  }

  if (def.kind === "enum" && def.options) {
    return (
      <div className="param-card">
        <label htmlFor={id}>{def.name}</label>
        <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="param-val">{displayParam(def, value)}</div>
      </div>
    );
  }

  const min = def.min ?? 0;
  const max = def.max ?? 127;
  return (
    <div className="param-card">
      <label htmlFor={id}>{def.name}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="param-val">{displayParam(def, value)}</div>
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
