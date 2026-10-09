import { useMemo, useState } from "react";
import { hasAllTags, libraryTags } from "../rhythmConverter/partLibrary";
import {
  PEDAL_IMPORT_TAG,
  rhythmSummary,
  type LibraryRhythm,
  type PedalRhythm,
} from "../rhythmConverter/rhythmLibrary";
import { MAX_USER_PATTERNS, PATTERN_NAME_MAX, sanitizePatternName } from "../rhythmConverter/rhythmRc0";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";
import { TagPicker } from "./RhythmLibraryPanel";

export interface RhythmDraft {
  /** Rhythm being renamed / retagged; null saves the rhythm currently in the builder. */
  existing: LibraryRhythm | null;
  /** Rhythm read from an RC-600 slot to save as a new library rhythm, with the slot number for the title. */
  slot?: { index: number; rhythm: LibraryRhythm };
  name: string;
  tags: string[];
  /** Also save each part to the part library, tagged with the rhythm name. */
  withParts: boolean;
}

const SEND_TEXT = `Tick rhythms to send several at once. They all go into the single file ROLAND/DATA/RHYTHM.RC0, which holds every user rhythm (up to ${MAX_USER_PATTERNS}). A rhythm whose name is already on the pedal replaces that slot; the others take the next free slots. Save to RC-600 writes the file on the open drive and keeps the rhythms already there. Without the pedal, Add to Offline Slots puts them in the offline slot list (RC-600 Slots), where you download the finished file. Download RHYTHM.RC0 here builds the file from the open drive or offline list plus the ticked rhythms; with neither, it holds only the ticked rhythms and copying it to the pedal replaces all user rhythms there.`;

export function RhythmDraftForm({
  draft,
  onDraft,
  onSave,
  busy,
  known,
  error,
}: {
  draft: RhythmDraft;
  onDraft: (draft: RhythmDraft | null) => void;
  onSave: () => void;
  busy: boolean;
  known: string[];
  error: string | null;
}) {
  return (
    <form
      className="rhythm-library-draft"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="rhythm-conv-section-head">
        <h3>
          {draft.existing
            ? `Edit "${draft.existing.name}"`
            : draft.slot
              ? `Save Slot ${draft.slot.index + 1} to Library`
              : "Save Current Rhythm"}
        </h3>
        <InfoTip
          label="Saving a rhythm"
          text={`Stores every part of the rhythm (Intro, Variations, Fills, Ending) together with its Kit, so you can load it again or send it to the pedal later. On the RC-600 the name is cut to ${PATTERN_NAME_MAX} plain characters. Tags describe the style and feel. With Add Parts to Part Library ON, each part is also saved on its own in the part library, named "<rhythm> <part>" and tagged with the rhythm name, so you can reuse it in other rhythms; saving again replaces those parts.`}
        />
      </div>
      <div className="rhythm-library-draft-fields">
        <label className="drum-pad-field">
          <span>Name</span>
          <input
            type="text"
            maxLength={40}
            value={draft.name}
            autoFocus
            onChange={(e) => onDraft({ ...draft, name: e.target.value })}
          />
          {draft.name.trim() ? (
            <span className="drum-pad-hint">On the pedal: {sanitizePatternName(draft.name)}</span>
          ) : null}
        </label>
      </div>
      <TagPicker tags={draft.tags} onChange={(tags) => onDraft({ ...draft, tags })} known={known} />
      {error ? (
        <p className="drum-pad-hint warn" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rhythm-library-draft-actions">
        {draft.existing ? null : (
          <label className="drum-pad-field rhythm-player-field">
            <span>Add Parts to Part Library</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.withParts}
              className={`power-switch${draft.withParts ? " on" : ""}`}
              onClick={() => onDraft({ ...draft, withParts: !draft.withParts })}
            >
              <span className="power-switch-track">
                <span className="power-switch-thumb" />
              </span>
              <span className="power-switch-state">{draft.withParts ? "ON" : "OFF"}</span>
            </button>
          </label>
        )}
        <button type="submit" className="btn primary" disabled={busy || !draft.name.trim()}>
          <Icon name="save" size={14} />
          {busy ? "Saving…" : "Save Rhythm"}
        </button>
        <button type="button" className="btn ghost" onClick={() => onDraft(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export interface PedalImport {
  source: string;
  items: PedalRhythm[];
  picked: number[];
  withParts: boolean;
}

const PEDAL_IMPORT_TEXT = `Reads the user rhythms from ROLAND/DATA/RHYTHM.RC0 (the open RC-600 drive, or a RHYTHM.RC0 file you pick) and adds the ticked ones to your rhythm library, tagged "${PEDAL_IMPORT_TAG}". With Add Parts to Part Library ON, each rhythm's Intro, Variations, Fills and Ending also go to your part library, named after the rhythm. Parts the pedal only reuses (for example a Variation B that repeats Variation A) are skipped. Importing again replaces entries with the same name. The pedal is not changed.`;

export function PedalImportForm({
  value,
  onChange,
  onImport,
  onCancel,
  busy,
  kitLabel,
}: {
  value: PedalImport;
  onChange: (value: PedalImport) => void;
  onImport: () => void;
  onCancel: () => void;
  busy: boolean;
  kitLabel: (kit: number) => string;
}) {
  const all = value.picked.length === value.items.length;
  const toggle = (slot: number) =>
    onChange({
      ...value,
      picked: value.picked.includes(slot) ? value.picked.filter((s) => s !== slot) : [...value.picked, slot],
    });
  return (
    <section className="rhythm-library-draft" aria-label="Import from RC-600">
      <div className="rhythm-conv-section-head">
        <h3>Import from RC-600</h3>
        <InfoTip label="Import from RC-600" text={PEDAL_IMPORT_TEXT} />
        <span className="rhythm-library-meta">{value.source}</span>
        <span className="rhythm-editor-spacer" />
        <button
          type="button"
          className="btn ghost"
          onClick={() => onChange({ ...value, picked: all ? [] : value.items.map((i) => i.slot) })}
        >
          {all ? "Select None" : "Select All"}
        </button>
      </div>
      {value.items.length ? (
        <div className="rhythm-pedal-import-list">
          {value.items.map(({ slot, rhythm }) => {
            const sum = rhythmSummary(rhythm);
            return (
              <label key={slot} className="rhythm-pedal-import-item">
                <input type="checkbox" checked={value.picked.includes(slot)} onChange={() => toggle(slot)} />
                <span className="rhythm-pedal-import-slot">{slot + 1}</span>
                <strong>{rhythm.name}</strong>
                <span className="rhythm-library-meta">
                  {sum.parts} part{sum.parts === 1 ? "" : "s"} · {sum.meter} · {sum.tempoBpm} BPM ·{" "}
                  {kitLabel(rhythm.kit)}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="drum-pad-hint">No user rhythms with notes were found in this file.</p>
      )}
      <div className="rhythm-library-draft-actions">
        <label className="drum-pad-field rhythm-player-field">
          <span>Add Parts to Part Library</span>
          <button
            type="button"
            role="switch"
            aria-checked={value.withParts}
            className={`power-switch${value.withParts ? " on" : ""}`}
            onClick={() => onChange({ ...value, withParts: !value.withParts })}
          >
            <span className="power-switch-track">
              <span className="power-switch-thumb" />
            </span>
            <span className="power-switch-state">{value.withParts ? "ON" : "OFF"}</span>
          </button>
        </label>
        <button type="button" className="btn primary" disabled={busy || !value.picked.length} onClick={onImport}>
          <Icon name="download" size={14} />
          {busy ? "Importing…" : `Import ${value.picked.length} Rhythm${value.picked.length === 1 ? "" : "s"}`}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

export function RhythmPresetLibrary({
  rhythms,
  infoText,
  devTarget,
  busy,
  kitLabel,
  previewId,
  progress,
  canSaveCurrent,
  canWritePedal,
  sendLabel = "Save to RC-600",
  writeTitle,
  onPreview,
  onLoad,
  onSaveCurrent,
  onEdit,
  onDelete,
  onExport,
  onImport,
  onImportPedal,
  hasUserRhythms,
  onSendToPedal,
  onDownload,
}: {
  /** Reads the pedal's user rhythms (open drive or a picked RHYTHM.RC0). */
  onImportPedal: () => void;
  rhythms: LibraryRhythm[];
  infoText: string;
  devTarget: boolean;
  busy: boolean;
  kitLabel: (kit: number) => string;
  previewId: string | null;
  progress: number;
  canSaveCurrent: boolean;
  canWritePedal: boolean;
  sendLabel?: string;
  writeTitle?: string;
  onPreview: (id: string | null) => void;
  onLoad: (rhythm: LibraryRhythm) => void;
  onSaveCurrent: () => void;
  onEdit: (rhythm: LibraryRhythm) => void;
  onDelete: (rhythm: LibraryRhythm) => void;
  onExport: () => void;
  onImport: () => void;
  hasUserRhythms: boolean;
  onSendToPedal: (rhythms: LibraryRhythm[]) => void;
  onDownload: (rhythms: LibraryRhythm[]) => void;
}) {
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const keyOf = (r: LibraryRhythm) => `${r.source}:${r.id}`;
  const allTags = useMemo(() => libraryTags(rhythms), [rhythms]);
  const shown = rhythms.filter(
    (r) => hasAllTags(r, tagFilter) && (!search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const pickedRhythms = rhythms.filter((r) => picked.includes(keyOf(r)));
  const toggleFilter = (t: string) =>
    setTagFilter((prev) =>
      prev.some((x) => x.toLowerCase() === t.toLowerCase())
        ? prev.filter((x) => x.toLowerCase() !== t.toLowerCase())
        : [...prev, t],
    );
  const togglePick = (r: LibraryRhythm) =>
    setPicked((prev) => (prev.includes(keyOf(r)) ? prev.filter((k) => k !== keyOf(r)) : [...prev, keyOf(r)]));

  return (
    <section className="rhythm-library" aria-label="Rhythm Library">
      <div className="rhythm-conv-section-head">
        <InfoTip label="Rhythm Library" text={infoText} />
        <span className="rhythm-editor-spacer" />
        <button type="button" className="btn" onClick={onSaveCurrent} disabled={!canSaveCurrent || busy}>
          <Icon name="save" size={14} />
          Save Current Rhythm…
        </button>
        <button type="button" className="btn" onClick={onImportPedal} disabled={busy}>
          <Icon name="download" size={14} />
          Import from RC-600
        </button>
        <button type="button" className="btn ghost" onClick={onImport}>
          <Icon name="upload" size={14} />
          Import
        </button>
        <button type="button" className="btn ghost" onClick={onExport} disabled={!hasUserRhythms}>
          <Icon name="download" size={14} />
          Export
        </button>
      </div>

      <div className="rhythm-library-filters">
        <input
          type="search"
          className="rhythm-library-search"
          placeholder="Search by name"
          aria-label="Search rhythms"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {allTags.length ? (
        <div className="rhythm-tags-group rhythm-library-tagfilter">
          <span className="rhythm-tags-group-label">Tags</span>
          {allTags.map((t) => {
            const on = tagFilter.some((x) => x.toLowerCase() === t.toLowerCase());
            return (
              <button
                key={t}
                type="button"
                className={`rhythm-tag${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => toggleFilter(t)}
              >
                {t}
              </button>
            );
          })}
          {tagFilter.length ? (
            <button type="button" className="btn ghost" onClick={() => setTagFilter([])}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {rhythms.length ? (
        <div className="rhythm-library-send">
          <span>
            {pickedRhythms.length
              ? `${pickedRhythms.length} rhythm${pickedRhythms.length === 1 ? "" : "s"} ticked`
              : "Tick rhythms to send several to the pedal in one file"}
          </span>
          <InfoTip label="Sending rhythms to the RC-600" text={SEND_TEXT} />
          <span className="rhythm-editor-spacer" />
          <button
            type="button"
            className="btn primary"
            disabled={!pickedRhythms.length || !canWritePedal || busy}
            title={writeTitle}
            onClick={() => onSendToPedal(pickedRhythms)}
          >
            <Icon name="upload" size={14} />
            {sendLabel}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!pickedRhythms.length || busy}
            onClick={() => onDownload(pickedRhythms)}
          >
            <Icon name="download" size={14} />
            Download RHYTHM.RC0
          </button>
          {pickedRhythms.length ? (
            <button type="button" className="btn ghost" onClick={() => setPicked([])}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {shown.length ? (
        <div className="rhythm-library-list">
          {shown.map((r) => {
            const playing = previewId === r.id;
            const canChange = r.source === "user" || devTarget;
            const sum = rhythmSummary(r);
            const isPicked = picked.includes(keyOf(r));
            return (
              <div key={keyOf(r)} className={`rhythm-library-item is-rhythm${isPicked ? " is-picked" : ""}`}>
                <input
                  type="checkbox"
                  className="rhythm-library-check"
                  checked={isPicked}
                  aria-label={`Send ${r.name} to the pedal`}
                  onChange={() => togglePick(r)}
                />
                <div className="rhythm-library-info">
                  <div className="rhythm-library-title">
                    <strong>{r.name}</strong>
                    <span className={`rhythm-conv-track-tag is-${r.source}`}>
                      {r.source === "native" ? "Factory" : "Mine"}
                    </span>
                  </div>
                  <span className="rhythm-library-meta">
                    {sum.parts} part{sum.parts === 1 ? "" : "s"} · {sum.meter} · {sum.tempoBpm} BPM · {kitLabel(r.kit)}
                  </span>
                  {r.tags.length ? (
                    <span className="rhythm-library-tags">
                      {r.tags.map((t) => (
                        <span key={t} className="rhythm-tag is-static">
                          {t}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
                <div className="rhythm-library-actions">
                  <button
                    type="button"
                    className={`btn ghost${playing ? " is-on" : ""}`}
                    aria-label={playing ? `Stop ${r.name}` : `Play Variation A of ${r.name}`}
                    title="Play Variation A"
                    onClick={() => onPreview(playing ? null : r.id)}
                  >
                    <Icon name={playing ? "stop" : "play"} size={14} />
                  </button>
                  <button type="button" className="btn primary" onClick={() => onLoad(r)}>
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!canChange || busy}
                    aria-label={`Edit name and tags of ${r.name}`}
                    title={canChange ? "Edit name and tags" : "Factory rhythms can only be changed in development"}
                    onClick={() => onEdit(r)}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!canChange || busy}
                    aria-label={`Delete ${r.name}`}
                    title={canChange ? "Delete" : "Factory rhythms can only be deleted in development"}
                    onClick={() => onDelete(r)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                {playing ? <span className="rhythm-conv-progress" style={{ width: `${progress * 100}%` }} /> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="drum-pad-hint">
          {rhythms.length
            ? "No rhythms match these filters."
            : "No rhythms yet. Build a rhythm (from a file or from library parts) and use Save Current Rhythm."}
        </p>
      )}
    </section>
  );
}
