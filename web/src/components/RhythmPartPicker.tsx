import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PART_LABELS, type PartRole } from "../rhythmConverter/sectionSuggest";
import { Icon, type IconName } from "./Icon";

const GROUPS: { label: string; roles: PartRole[] }[] = [
  { label: "Intro & Ending", roles: ["intro", "ending"] },
  { label: "Variations", roles: ["varA", "varB", "varC", "varD"] },
  { label: "Fills", roles: ["fillA", "fillB", "fillC", "fillD"] },
];

/** Menu of the ten rhythm parts, with each part's color, current content and the suggested one. */
export function RhythmPartPicker({
  label,
  colors,
  icons,
  status,
  suggested,
  exclude,
  onPick,
}: {
  label: string;
  colors: Record<PartRole, string>;
  icons: Record<PartRole, IconName>;
  /** What each part holds now ("Not set", "Bars 3–4"…). */
  status: (role: PartRole) => string;
  suggested: PartRole | null;
  /** Part already offered by the main button. */
  exclude?: PartRole;
  onPick: (role: PartRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className="rhythm-part-picker" ref={ref}>
      <button type="button" className={`btn${open ? " is-on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
        <Icon name="chevronDown" size={14} />
      </button>
      {open ? (
        <div className="rhythm-part-picker-menu" role="menu">
          {GROUPS.map((g) => (
            <div key={g.label} className="rhythm-part-picker-group">
              <span className="rhythm-part-picker-group-label">{g.label}</span>
              {g.roles
                .filter((r) => r !== exclude)
                .map((role) => {
                  const state = status(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      role="menuitem"
                      className={`rhythm-part-picker-item${role === suggested ? " is-suggested" : ""}`}
                      style={{ "--role-color": colors[role] } as CSSProperties}
                      onClick={() => {
                        setOpen(false);
                        onPick(role);
                      }}
                    >
                      <Icon name={icons[role]} size={14} />
                      <span className="rhythm-part-picker-name">{PART_LABELS[role]}</span>
                      {role === suggested ? <span className="rhythm-part-picker-badge">Suggested</span> : null}
                      <span className={`rhythm-part-picker-state${state === "Not set" ? " is-empty" : ""}`}>{state}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
