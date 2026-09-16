import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ASSIGN_TARGETS,
  assignTargetByValue,
  groupAssignTargets,
  matchAssignTarget,
} from "@rc600/catalog/assign-targets";
import { Icon } from "./Icon";

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function AssignTargetSelect({
  value,
  ariaLabel,
  onChange,
}: {
  value: number;
  ariaLabel: string;
  onChange: (value: number) => void;
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
  const selected = assignTargetByValue(value);

  const matches = useMemo(
    () => ASSIGN_TARGETS.filter((target) => matchAssignTarget(target, query)),
    [query],
  );
  const groups = useMemo(() => groupAssignTargets(matches), [matches]);

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
    const width = Math.max(rect.width, 320);
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
    setActiveIndex(Math.max(0, ASSIGN_TARGETS.findIndex((target) => target.value === value)));
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
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-target-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

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
                placeholder="Search targets"
                aria-label="Search targets"
                aria-controls={listId}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div ref={listRef} id={listId} className="assign-target-list" role="listbox">
              {groups.map((group) => (
                <div
                  key={group.category}
                  className="assign-target-group"
                  role="group"
                  aria-label={group.category}
                >
                  <strong>{group.category}</strong>
                  {group.targets.map((target) => {
                    const index = matches.indexOf(target);
                    return (
                      <button
                        key={target.value}
                        type="button"
                        role="option"
                        aria-selected={target.value === value}
                        className={`assign-target-option${index === activeIndex ? " is-active" : ""}`}
                        data-target-index={index}
                        title={target.info}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(target.value)}
                      >
                        {target.label}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!matches.length ? (
                <p className="assign-target-empty">No targets match the filter.</p>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="assign-target"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={selected?.info}
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
        <span>{selected?.label ?? `Value ${value}`}</span>
        <Icon name="chevronDown" />
      </button>
      {menu}
    </>
  );
}
