import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { PartEvents } from "../rhythmConverter/exportPack";
import {
  EDIT_GRIDS,
  MAX_PART_BARS,
  THUMB_ROWS,
  VELOCITY_LEVELS,
  addableLanes,
  barThumbnail,
  barTicksOf,
  clearLane,
  clearStep,
  duplicateBar,
  gridTicks,
  insertEmptyBar,
  laneCells,
  laneLabel,
  moveBar,
  nextVelocity,
  partLanes,
  removeBar,
  replaceBar,
  setStep,
  setStepVelocity,
  splitBars,
  stepCount,
  type EditGrid,
} from "../rhythmConverter/partEdit";
import type { SmfNote } from "../rhythmConverter/smf";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";

export type EditorView = "instruments" | "blocks";

const INSTRUMENTS_TEXT =
  "One row per drum sound, cymbals on top and kick at the bottom, like a drum staff. Click an empty step to add a hit with the Velocity picked above; click a hit to remove it; drag to add or remove several. Right-click (or Alt+click) a hit to cycle Ghost, Normal and Accent. Strong lines mark bars, lighter lines mark beats. Add Instrument shows more kit sounds.";

const BLOCKS_TEXT =
  "Each block is one bar of the part, with a small picture of what plays (cymbals, hi-hats, toms, snare, kick from top to bottom). Move, duplicate, copy and paste bars to build the groove, or add an empty bar and fill it in Instruments. Click a block's picture to open that bar in Instruments.";

const EDITOR_TEXT =
  "Edits apply to this part only and are what Play, Save to RC-600, Download RHYTHM.RC0, Export ZIP and Save to Library use. Once edited, the part no longer follows the song bars or the Options (Quantize, Velocity); Revert goes back to them. Fills are saved to the RC-600 as one bar, so only the last bar of a longer fill is kept.";

export function BarThumb({
  hits,
  lengthTicks,
  slots = 16,
  className = "",
}: {
  hits: readonly { tick: number; note: number }[];
  lengthTicks: number;
  slots?: number;
  className?: string;
}) {
  const rows = useMemo(() => barThumbnail(hits, lengthTicks, slots), [hits, lengthTicks, slots]);
  return (
    <span className={`rhythm-thumb ${className}`} style={{ "--slots": slots } as CSSProperties} aria-hidden>
      {THUMB_ROWS.map((row) =>
        rows[row].map((on, i) => <i key={`${row}${i}`} className={on ? `is-on is-${row}` : undefined} />),
      )}
    </span>
  );
}

export function UndoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <span className="rhythm-undo">
      <button type="button" className="btn ghost" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Icon name="undo" size={14} />
        Undo
      </button>
      <button type="button" className="btn ghost" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        <Icon name="redo" size={14} />
        Redo
      </button>
    </span>
  );
}

export function RhythmPartEditor({
  label,
  color,
  part,
  edited,
  view,
  onView,
  grid,
  onGrid,
  velocity,
  onVelocity,
  playing,
  progress,
  playhead,
  onPlay,
  onBeginEdit,
  onChange,
  onCreate,
  onPickLibrary,
  onUseSelection,
  selectionLabel = "",
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  onRevert,
}: {
  label: string;
  color: string;
  part: PartEvents | null;
  /** Part was changed here (shows Revert). */
  edited: boolean;
  view: EditorView;
  onView: (view: EditorView) => void;
  grid: EditGrid;
  onGrid: (grid: EditGrid) => void;
  velocity: number;
  onVelocity: (velocity: number) => void;
  playing: boolean;
  progress: number;
  /** Position to mark in the grid (0–1); defaults to `progress` while this part loops. */
  playhead?: number | null;
  onPlay: () => void;
  /** Called once before each user edit, so it can be undone as one step. */
  onBeginEdit: () => void;
  onChange: (next: PartEvents) => void;
  onCreate: (bars: number) => void;
  onPickLibrary?: () => void;
  /** Fills the empty part with the bars selected on the song strip. */
  onUseSelection?: () => void;
  selectionLabel?: string;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onRevert: () => void;
}) {
  const [extraLanes, setExtraLanes] = useState<number[]>([]);
  const [clipboard, setClipboard] = useState<SmfNote[] | null>(null);
  const [newBars, setNewBars] = useState(2);
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusBar, setFocusBar] = useState<number | null>(null);

  useEffect(() => {
    if (view !== "instruments" || focusBar == null) return;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-bar-head="${focusBar}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "start" });
    setFocusBar(null);
  }, [view, focusBar]);

  function edit(fn: (p: PartEvents) => PartEvents) {
    if (!part) return;
    const next = fn(part);
    if (next === part) return;
    onBeginEdit();
    onChange(next);
  }

  return (
    <section className="rhythm-editor" aria-label="Part Editor" style={{ "--role-color": color } as CSSProperties}>
      <div className="rhythm-conv-section-head">
        <h3>
          Edit <span className="rhythm-editor-role">{label}</span>
        </h3>
        <InfoTip label="Editing a part" text={EDITOR_TEXT} />
        <div className="rhythm-editor-views" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === "instruments"}
            className={view === "instruments" ? "is-active" : undefined}
            onClick={() => onView("instruments")}
          >
            <Icon name="grid" size={14} />
            Instruments
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "blocks"}
            className={view === "blocks" ? "is-active" : undefined}
            onClick={() => onView("blocks")}
          >
            <Icon name="blocks" size={14} />
            Blocks
          </button>
        </div>
        <InfoTip label={view === "instruments" ? "Instruments" : "Blocks"} text={view === "instruments" ? INSTRUMENTS_TEXT : BLOCKS_TEXT} />
      </div>

      {part ? (
        <div className="rhythm-editor-toolbar">
          <button type="button" className={`btn${playing ? " is-on" : " primary"}`} onClick={onPlay} disabled={!part.notes.length}>
            <Icon name={playing ? "stop" : "play"} size={14} />
            {playing ? "Stop" : "Play Part"}
          </button>
          {view === "instruments" ? (
            <>
              <label className="drum-pad-field">
                <span>Grid</span>
                <select value={grid} onChange={(e) => onGrid(e.target.value as EditGrid)}>
                  {EDIT_GRIDS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="drum-pad-field">
                <span>Velocity</span>
                <select value={velocity} onChange={(e) => onVelocity(Number(e.target.value))}>
                  {VELOCITY_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <span className="rhythm-editor-meta">
            {part.bars} bar{part.bars === 1 ? "" : "s"} · {part.numerator}/{part.denominator} · {part.tempoBpm} BPM ·{" "}
            {part.notes.length} hits
          </span>
          <span className="rhythm-editor-spacer" />
          <UndoButtons canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
          <button type="button" className="btn ghost" onClick={onRevert} disabled={!edited}>
            <Icon name="restore" size={14} />
            Revert
          </button>
        </div>
      ) : (
        <div className="rhythm-editor-empty">
          <span>
            {label} is empty.{" "}
            {onUseSelection ? "Use the bars selected above," : "Select bars of the song above,"} pick a part from the
            library, or start from scratch:
          </span>
          {onUseSelection ? (
            <button type="button" className="btn primary" onClick={onUseSelection}>
              <Icon name="blocks" size={14} />
              Use Selected {selectionLabel}
            </button>
          ) : null}
          {onPickLibrary ? (
            <button type="button" className="btn" onClick={onPickLibrary}>
              <Icon name="library" size={14} />
              Pick from Library
            </button>
          ) : null}
          <label className="drum-pad-field">
            <span>Bars</span>
            <select value={newBars} onChange={(e) => setNewBars(Number(e.target.value))}>
              {[1, 2, 4, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn primary" onClick={() => onCreate(newBars)}>
            <Icon name="plus" size={14} />
            New Empty Part
          </button>
        </div>
      )}

      {part && view === "instruments" ? (
        <InstrumentGrid
          gridRef={gridRef}
          part={part}
          step={gridTicks(grid)}
          velocity={velocity}
          extraLanes={extraLanes}
          onAddLane={(note) => setExtraLanes((prev) => [...prev, note])}
          playhead={playhead !== undefined ? playhead : playing ? progress : null}
          onBeginEdit={onBeginEdit}
          onChange={onChange}
        />
      ) : null}

      {part && view === "blocks" ? (
        <div className="rhythm-blocks">
          {splitBars(part).map((notes, i, all) => (
            <div key={i} className="rhythm-block">
              <div className="rhythm-block-head">
                <strong>Bar {i + 1}</strong>
                <span>{notes.length} hits</span>
              </div>
              <button
                type="button"
                className="rhythm-block-pic"
                title={`Open bar ${i + 1} in Instruments`}
                onClick={() => {
                  setFocusBar(i);
                  onView("instruments");
                }}
              >
                <BarThumb hits={notes} lengthTicks={barTicksOf(part)} />
              </button>
              <div className="rhythm-block-tools">
                <button type="button" className="btn ghost" title="Move left" aria-label={`Move bar ${i + 1} left`} disabled={i === 0} onClick={() => edit((p) => moveBar(p, i, i - 1))}>
                  <Icon name="moveLeft" size={14} />
                </button>
                <button type="button" className="btn ghost" title="Move right" aria-label={`Move bar ${i + 1} right`} disabled={i === all.length - 1} onClick={() => edit((p) => moveBar(p, i, i + 1))}>
                  <Icon name="moveRight" size={14} />
                </button>
                <button type="button" className="btn ghost" title="Duplicate" aria-label={`Duplicate bar ${i + 1}`} disabled={all.length >= MAX_PART_BARS} onClick={() => edit((p) => duplicateBar(p, i))}>
                  <Icon name="overdub" size={14} />
                </button>
                <button type="button" className="btn ghost" title="Copy" aria-label={`Copy bar ${i + 1}`} onClick={() => setClipboard(notes)}>
                  <Icon name="copy" size={14} />
                </button>
                <button type="button" className="btn ghost" title="Paste over this bar" aria-label={`Paste over bar ${i + 1}`} disabled={!clipboard} onClick={() => edit((p) => replaceBar(p, i, clipboard))}>
                  <Icon name="paste" size={14} />
                </button>
                <button type="button" className="btn ghost" title="Clear" aria-label={`Clear bar ${i + 1}`} disabled={!notes.length} onClick={() => edit((p) => replaceBar(p, i, null))}>
                  <Icon name="notesOff" size={14} />
                </button>
                <button type="button" className="btn ghost" title="Delete" aria-label={`Delete bar ${i + 1}`} disabled={all.length <= 1} onClick={() => edit((p) => removeBar(p, i))}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="rhythm-block rhythm-block-add"
            disabled={part.bars >= MAX_PART_BARS}
            onClick={() => edit((p) => insertEmptyBar(p, p.bars))}
          >
            <Icon name="plus" size={18} />
            Add Bar
          </button>
        </div>
      ) : null}
    </section>
  );
}

function InstrumentGrid({
  gridRef,
  part,
  step,
  velocity,
  extraLanes,
  onAddLane,
  playhead,
  onBeginEdit,
  onChange,
}: {
  gridRef: RefObject<HTMLDivElement | null>;
  part: PartEvents;
  step: number;
  velocity: number;
  extraLanes: number[];
  onAddLane: (note: number) => void;
  playhead: number | null;
  onBeginEdit: () => void;
  onChange: (next: PartEvents) => void;
}) {
  const lanes = useMemo(() => partLanes(part, extraLanes), [part, extraLanes]);
  const steps = stepCount(part, step);
  const barTicks = barTicksOf(part);
  const beatTicks = (1920 / part.denominator) | 0;
  const partRef = useRef(part);
  partRef.current = part;
  const strokeRef = useRef<{ mode: "add" | "remove"; done: Set<string> } | null>(null);

  useEffect(() => {
    const end = () => {
      strokeRef.current = null;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  function apply(next: PartEvents) {
    if (next === partRef.current) return;
    partRef.current = next;
    onChange(next);
  }

  function cellFrom(el: EventTarget | null): { note: number; index: number } | null {
    const cell = (el as HTMLElement | null)?.closest?.<HTMLElement>("[data-step]");
    if (!cell) return null;
    return { note: Number(cell.dataset.note), index: Number(cell.dataset.step) };
  }

  function paint(note: number, index: number) {
    const stroke = strokeRef.current;
    if (!stroke) return;
    const key = `${note}:${index}`;
    if (stroke.done.has(key)) return;
    stroke.done.add(key);
    const p = partRef.current;
    apply(stroke.mode === "add" ? setStep(p, note, index, step, velocity) : clearStep(p, note, index, step));
  }

  const columns = Array.from({ length: steps }, (_, i) => i * step);

  return (
    <div className="rhythm-grid-wrap">
      <div
        ref={gridRef}
        className="rhythm-grid"
        style={{ "--steps": steps } as CSSProperties}
        onContextMenu={(e) => {
          if (cellFrom(e.target)) e.preventDefault();
        }}
        onPointerDown={(e) => {
          const cell = cellFrom(e.target);
          if (!cell) return;
          e.preventDefault();
          const current = laneCells(partRef.current, cell.note, step)[cell.index] ?? 0;
          if (current && (e.button === 2 || e.altKey)) {
            onBeginEdit();
            apply(setStepVelocity(partRef.current, cell.note, cell.index, step, nextVelocity(current)));
            return;
          }
          if (e.button !== 0) return;
          onBeginEdit();
          strokeRef.current = { mode: current ? "remove" : "add", done: new Set() };
          paint(cell.note, cell.index);
        }}
        onPointerMove={(e) => {
          if (!strokeRef.current) return;
          const cell = cellFrom(document.elementFromPoint(e.clientX, e.clientY));
          if (cell) paint(cell.note, cell.index);
        }}
      >
        <div className="rhythm-grid-corner" />
        {columns.map((tick, i) => {
          const barStart = tick % barTicks === 0;
          const beatStart = tick % beatTicks === 0;
          const bar = Math.floor(tick / barTicks);
          return (
            <div
              key={i}
              className={`rhythm-grid-head${barStart ? " is-bar" : beatStart ? " is-beat" : ""}`}
              data-bar-head={barStart ? bar : undefined}
            >
              {barStart ? <strong>{bar + 1}</strong> : beatStart ? Math.floor((tick % barTicks) / beatTicks) + 1 : ""}
            </div>
          );
        })}
        {lanes.map((note) => {
          const cells = laneCells(part, note, step);
          const used = cells.some(Boolean);
          return (
            <LaneRow
              key={note}
              note={note}
              cells={cells}
              used={used}
              columns={columns}
              barTicks={barTicks}
              beatTicks={beatTicks}
              onClear={() => {
                onBeginEdit();
                apply(clearLane(partRef.current, note));
              }}
            />
          );
        })}
        {playhead != null ? (
          <span className="rhythm-grid-playhead" style={{ "--pos": playhead } as CSSProperties} aria-hidden />
        ) : null}
      </div>
      <div className="rhythm-grid-foot">
        <select
          aria-label="Add Instrument"
          value=""
          onChange={(e) => {
            const note = Number(e.target.value);
            if (note) onAddLane(note);
          }}
        >
          <option value="">Add Instrument…</option>
          {addableLanes(lanes).map((l) => (
            <option key={l.note} value={l.note}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="rhythm-grid-legend">
          {VELOCITY_LEVELS.map((l) => (
            <span key={l.value}>
              <i className={`rhythm-grid-cell is-on ${levelClass(l.value)}`} />
              {l.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function levelClass(velocity: number): string {
  if (velocity >= 112) return "is-accent";
  if (velocity < 70) return "is-ghost";
  return "is-normal";
}

function LaneRow({
  note,
  cells,
  used,
  columns,
  barTicks,
  beatTicks,
  onClear,
}: {
  note: number;
  cells: number[];
  used: boolean;
  columns: number[];
  barTicks: number;
  beatTicks: number;
  onClear: () => void;
}) {
  return (
    <>
      <div className={`rhythm-grid-lane${used ? " is-used" : ""}`}>
        <span title={`Note ${note}`}>{laneLabel(note)}</span>
        {used ? (
          <button type="button" className="rhythm-grid-lane-clear" aria-label={`Clear ${laneLabel(note)}`} title="Clear row" onClick={onClear}>
            <Icon name="close" size={12} />
          </button>
        ) : null}
      </div>
      {cells.map((v, i) => {
        const tick = columns[i]!;
        const edge = tick % barTicks === 0 ? " is-bar" : tick % beatTicks === 0 ? " is-beat" : "";
        return (
          <div
            key={i}
            className={`rhythm-grid-cell${v ? ` is-on ${levelClass(v)}` : ""}${edge}`}
            data-step={i}
            data-note={note}
            title={v ? `${laneLabel(note)} · velocity ${v}` : undefined}
          />
        );
      })}
    </>
  );
}
