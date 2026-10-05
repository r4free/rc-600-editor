import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CTL_FUNCTIONS,
  EXP_FUNCTIONS,
  ctlFunctionCategory,
  ctlFunctionLabel,
  expFunctionCategory,
  type CtlFunction,
} from "@rc600/catalog/params";
import { Icon, type IconName } from "./Icon";

const CATEGORY_ORDER = [
  "Off",
  "Track 1",
  "Track 2",
  "Track 3",
  "Track 4",
  "Track 5",
  "Track 6",
  "Current Track",
  "All Tracks",
  "Tempo",
  "Pedal Mode",
  "Input FX",
  "Track FX",
  "Rhythm",
  "Memory",
  "Mic",
  "Indicator",
  "Other",
];

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/** Icon for the function currently assigned to a switch. */
export function ctlFunctionIcon(value: number): IconName {
  if (value <= 0) return "notesOff";
  const label = ctlFunctionLabel(value);
  if (/\bSTOP\b|\bCLEAR\b/.test(label)) return "stop";
  if (/REC\/PLAY|PLAY\/STOP|MOMENT PLAY|ALL START/.test(label)) return "record";
  if (/UNDO|MARK|REC BACK/.test(label)) return "restore";
  if (/REVERSE/.test(label)) return "refresh";
  if (/SPEED/.test(label)) return label.includes("HALF") ? "speedSlow" : "speedFast";
  const category = ctlFunctionCategory(value);
  if (category === "Tempo" || category === "Rhythm") return "tempo";
  if (category === "Pedal Mode") return "controls";
  if (category === "Input FX" || category === "Track FX") return "mfx";
  if (category === "Memory") return "scene";
  if (category === "Mic") return "mic";
  if (category === "Indicator") return "live";
  if (category.startsWith("Track") || category === "Current Track") return "play";
  return "controls";
}

/** Accent for an assigned function. Off stays on the card's default color. */
export function ctlFunctionColor(value: number): string | undefined {
  if (value <= 0) return undefined;
  const category = ctlFunctionCategory(value);
  if (category.startsWith("Track ")) return "#34d399";
  if (category === "Current Track") return "#a3e635";
  if (category === "All Tracks") return "#2dd4bf";
  if (category === "Tempo") return "#f59e0b";
  if (category === "Pedal Mode") return "#c084fc";
  if (category === "Input FX") return "#22d3ee";
  if (category === "Track FX") return "#fb923c";
  if (category === "Rhythm") return "#f472b6";
  if (category === "Memory") return "#818cf8";
  if (category === "Mic") return "#38bdf8";
  if (category === "Indicator") return "#facc15";
  return "#94a3b8";
}

const EXP_CATEGORY_ORDER = [
  "Off",
  "Level 1",
  "Level 2",
  "Current Track",
  "Tempo",
  "Input FX",
  "Track FX",
  "Rhythm",
  "Other",
];

export type FunctionCatalog = {
  functions: CtlFunction[];
  category: (value: number) => string;
  order: string[];
  icon: (value: number) => IconName;
  color: (value: number) => string | undefined;
};

function expFunctionIcon(value: number): IconName {
  if (value <= 0) return "notesOff";
  const category = expFunctionCategory(value);
  if (category === "Tempo" || category === "Rhythm") return "tempo";
  if (category === "Input FX" || category === "Track FX") return "mfx";
  if (category === "Level 1" || category === "Level 2" || category === "Current Track") return "master";
  return "controls";
}

function expFunctionColor(value: number): string | undefined {
  if (value <= 0) return undefined;
  const category = expFunctionCategory(value);
  if (category === "Level 1") return "#34d399";
  if (category === "Level 2") return "#a3e635";
  if (category === "Current Track") return "#2dd4bf";
  if (category === "Tempo") return "#f59e0b";
  if (category === "Input FX") return "#22d3ee";
  if (category === "Track FX") return "#fb923c";
  if (category === "Rhythm") return "#f472b6";
  return "#94a3b8";
}

const CTL_CATALOG: FunctionCatalog = {
  functions: CTL_FUNCTIONS,
  category: ctlFunctionCategory,
  order: CATEGORY_ORDER,
  icon: ctlFunctionIcon,
  color: ctlFunctionColor,
};

export const EXP_CATALOG: FunctionCatalog = {
  functions: EXP_FUNCTIONS,
  category: expFunctionCategory,
  order: EXP_CATEGORY_ORDER,
  icon: expFunctionIcon,
  color: expFunctionColor,
};

function groupFunctions(
  list: CtlFunction[],
  categoryOf: (value: number) => string,
  order: string[],
): { category: string; items: CtlFunction[] }[] {
  const buckets = new Map<string, CtlFunction[]>();
  for (const fn of list) {
    const category = categoryOf(fn.value);
    const items = buckets.get(category) ?? [];
    items.push(fn);
    buckets.set(category, items);
  }
  const known = order.filter((category) => buckets.has(category));
  const extra = [...buckets.keys()].filter((category) => !known.includes(category));
  return [...known, ...extra].map((category) => ({ category, items: buckets.get(category)! }));
}

/** Searchable CTL FUNC picker. The button is the body of a pedal card. */
export function CtlFunctionSelect({
  id,
  value,
  ariaLabel,
  onChange,
  catalog = CTL_CATALOG,
}: {
  id: string;
  value: number;
  ariaLabel: string;
  onChange: (value: number) => void;
  /** Expression pedals use a shorter list than onboard switches. */
  catalog?: FunctionCatalog;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const entry = catalog.functions.find((fn) => fn.value === value);
  const label = entry?.label ?? `Value ${value}`;
  const info = entry?.info;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const known = catalog.functions.some((fn) => fn.value === value);
    const extra: CtlFunction[] = known
      ? []
      : [{ value, label: `Value ${value}`, info: "Stored value with no name in the function list." }];
    const source = [...catalog.functions, ...extra];
    const filtered = q
      ? source.filter(
          (fn) =>
            fn.label.toLowerCase().includes(q) ||
            fn.info.toLowerCase().includes(q) ||
            catalog.category(fn.value).toLowerCase().includes(q),
        )
      : source;
    return groupFunctions(filtered, catalog.category, catalog.order);
  }, [catalog, query, value]);
  const matches = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  function updatePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewportPadding = 8;
    const preferredHeight = 420;
    const below = window.innerHeight - rect.bottom - gap - viewportPadding;
    const above = rect.top - gap - viewportPadding;
    const placeAbove = below < 240 && above > below;
    const maxHeight = Math.max(160, Math.min(preferredHeight, placeAbove ? above : below));
    const width = Math.max(rect.width, 280);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    setPosition({
      top: placeAbove ? Math.max(viewportPadding, rect.top - maxHeight - gap) : rect.bottom + gap,
      left,
      width,
      maxHeight,
    });
  }

  function openMenu() {
    setQuery("");
    const index = catalog.functions.findIndex((fn) => fn.value === value);
    setActiveIndex(index < 0 ? 0 : index);
    setOpen(true);
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function choose(nextValue: number) {
    onChange(nextValue);
    closeMenu(true);
  }

  function moveActive(delta: number) {
    if (!matches.length) return;
    setActiveIndex((current) => (current + delta + matches.length) % matches.length);
  }

  function handleListKeys(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter" && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex].value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    }
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    const closeOnOutsideClick = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!triggerRef.current?.contains(node) && !menuRef.current?.contains(node)) closeMenu();
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [open]);

  useEffect(() => {
    if (query.trim()) setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-target-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, matches]);

  const menu =
    open && position
      ? createPortal(
          <div
            ref={menuRef}
            className="assign-target-menu"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            onKeyDown={handleListKeys}
          >
            <label className="assign-target-search">
              <Icon name="search" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder="Search functions"
                aria-label="Search functions"
                aria-controls={listId}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div ref={listRef} id={listId} className="assign-target-list" role="listbox">
              {groups.map((group) => (
                <div key={group.category} className="assign-target-group" role="group" aria-label={group.category}>
                  <strong>{group.category}</strong>
                  {group.items.map((fn) => {
                    const index = matches.indexOf(fn);
                    return (
                      <button
                        key={fn.value}
                        type="button"
                        role="option"
                        aria-selected={fn.value === value}
                        className={`assign-target-option${index === activeIndex ? " is-active" : ""}`}
                        data-target-index={index}
                        title={fn.info}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(fn.value)}
                      >
                        {fn.label}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!matches.length ? <p className="assign-target-empty">No functions match the filter.</p> : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="play-state-btn"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={info ? `${label}. ${info}` : label}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openMenu();
          } else if (open && event.key === "Escape") {
            event.preventDefault();
            closeMenu(true);
          }
        }}
      >
        <Icon name={catalog.icon(value)} className="play-state-icon" />
        <span className="ctl-pedal-fn">{label}</span>
      </button>
      {menu}
    </>
  );
}
