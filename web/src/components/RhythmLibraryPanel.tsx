import { useMemo, useState } from "react";
import {
  FEEL_TAGS,
  PART_KIND_LABELS,
  STYLE_TAGS,
  TAGS_PER_PART_MAX,
  TAG_MAX,
  hasAllTags,
  libraryTags,
  normalizeTag,
  partKindForRole,
  rolesForKind,
  type LibraryPart,
  type PartKind,
} from "../rhythmConverter/partLibrary";
import { PART_LABELS, type PartRole } from "../rhythmConverter/sectionSuggest";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";

export const PART_KINDS = Object.keys(PART_KIND_LABELS) as PartKind[];

export interface LibraryDraft {
  from:
    | { kind: "selection"; start: number; end: number }
    | { kind: "role"; role: PartRole }
    | { kind: "existing"; part: LibraryPart };
  name: string;
  kind: PartKind;
  tags: string[];
}

const KIND_ICON = { intro: "intro", variation: "variationA", fill: "fill", ending: "ending" } as const;

const TAGS_TEXT =
  "Category decides which rhythm slots the part can fill: an Intro, a Variation (A–D), a Fill (A–D) or an Ending. Tags describe the part, such as the music style (Rock, Forró, Samba…) and the feel (Half Time, Shuffle…). Click a tag to add or remove it, or type your own and press Enter. Tags help you find parts later with the filters.";

export function TagPicker({
  tags,
  onChange,
  known,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Tags already used in the library (offered under Your Tags). */
  known: string[];
}) {
  const [text, setText] = useState("");
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const toggle = (t: string) =>
    onChange(has(t) ? tags.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...tags, t].slice(0, TAGS_PER_PART_MAX));
  const preset = new Set([...STYLE_TAGS, ...FEEL_TAGS].map((t) => t.toLowerCase()));
  const yours = known.filter((t) => !preset.has(t.toLowerCase()));
  const groups: [string, readonly string[]][] = [
    ["Style", STYLE_TAGS],
    ["Feel", FEEL_TAGS],
    ...(yours.length ? ([["Your Tags", yours]] as [string, string[]][]) : []),
  ];

  function addTyped() {
    const t = normalizeTag(text);
    if (t && !has(t)) onChange([...tags, t].slice(0, TAGS_PER_PART_MAX));
    setText("");
  }

  return (
    <div className="rhythm-tags-picker">
      <div className="rhythm-tags-current">
        {tags.length ? (
          tags.map((t) => (
            <button key={t} type="button" className="rhythm-tag is-on" onClick={() => toggle(t)} aria-label={`Remove tag ${t}`}>
              {t}
              <Icon name="close" size={11} />
            </button>
          ))
        ) : (
          <span className="rhythm-tags-empty">No tags yet</span>
        )}
        <input
          type="text"
          className="rhythm-tags-input"
          maxLength={TAG_MAX}
          placeholder="Add a tag…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTyped();
            }
          }}
          onBlur={() => {
            if (text.trim()) addTyped();
          }}
        />
      </div>
      {groups.map(([label, list]) => (
        <div key={label} className="rhythm-tags-group">
          <span className="rhythm-tags-group-label">{label}</span>
          {list.map((t) => (
            <button key={t} type="button" className={`rhythm-tag${has(t) ? " is-on" : ""}`} aria-pressed={has(t)} onClick={() => toggle(t)}>
              {t}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function LibraryDraftForm({
  draft,
  onDraft,
  onSave,
  busy,
  known,
  title,
  error,
}: {
  draft: LibraryDraft;
  onDraft: (draft: LibraryDraft | null) => void;
  onSave: () => void;
  busy: boolean;
  known: string[];
  title: string;
  /** Why the last save failed; shown inside the form. */
  error?: string | null;
}) {
  const kindLocked = draft.from.kind === "role";
  return (
    <form
      className="rhythm-library-draft"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="rhythm-conv-section-head">
        <h3>{title}</h3>
        <InfoTip label="Category and tags" text={TAGS_TEXT} />
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
        </label>
        <div className="drum-pad-field">
          <span>Category</span>
          <div className="rhythm-kind-pick" role="radiogroup" aria-label="Category">
            {PART_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={draft.kind === k}
                className={`rhythm-kind is-${k}${draft.kind === k ? " is-on" : ""}`}
                disabled={kindLocked && draft.kind !== k}
                onClick={() => onDraft({ ...draft, kind: k })}
              >
                <Icon name={KIND_ICON[k]} size={14} />
                {PART_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <TagPicker tags={draft.tags} onChange={(tags) => onDraft({ ...draft, tags })} known={known} />
      {error ? (
        <p className="drum-pad-hint warn" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rhythm-library-draft-actions">
        <button type="submit" className="btn primary" disabled={busy || !draft.name.trim()}>
          <Icon name="save" size={14} />
          {busy ? "Saving…" : "Save to Library"}
        </button>
        <button type="button" className="btn ghost" onClick={() => onDraft(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function RhythmLibraryPanel({
  targetRole = null,
  parts,
  infoText,
  devTarget,
  busy,
  previewId,
  progress,
  onPreview,
  onUse,
  onEdit,
  onDelete,
  onExport,
  onImport,
  hasUserParts,
}: {
  /** Rhythm part being filled: only parts of its category are listed, and Use places the part there. */
  targetRole?: PartRole | null;
  parts: LibraryPart[];
  infoText: string;
  devTarget: boolean;
  busy: boolean;
  previewId: string | null;
  progress: number;
  onPreview: (id: string | null) => void;
  onUse: (part: LibraryPart, role: PartRole) => void;
  onEdit: (part: LibraryPart) => void;
  onDelete: (part: LibraryPart) => void;
  onExport: () => void;
  onImport: () => void;
  hasUserParts: boolean;
}) {
  const lockedKind = targetRole ? partKindForRole(targetRole) : null;
  const [pickedKind, setKind] = useState<PartKind | "all">("all");
  const kind = lockedKind ?? pickedKind;
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const allTags = useMemo(
    () => libraryTags(lockedKind ? parts.filter((p) => p.kind === lockedKind) : parts),
    [parts, lockedKind],
  );
  const shown = parts.filter(
    (p) =>
      (kind === "all" || p.kind === kind) &&
      hasAllTags(p, tagFilter) &&
      (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const toggleFilter = (t: string) =>
    setTagFilter((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...prev, t]));

  return (
    <section className="rhythm-library" aria-label="Part Library">
      <div className="rhythm-conv-section-head">
        {lockedKind && targetRole ? (
          <span className="rhythm-library-target">
            Showing <span className={`rhythm-kind-badge is-${lockedKind}`}>{PART_KIND_LABELS[lockedKind]}</span> parts for{" "}
            <strong>{PART_LABELS[targetRole]}</strong>
          </span>
        ) : null}
        <InfoTip label="Part Library" text={infoText} />
        <span className="rhythm-editor-spacer" />
        <button type="button" className="btn ghost" onClick={onImport}>
          <Icon name="upload" size={14} />
          Import
        </button>
        <button type="button" className="btn ghost" onClick={onExport} disabled={!hasUserParts}>
          <Icon name="download" size={14} />
          Export
        </button>
      </div>

      <div className="rhythm-library-filters">
        {lockedKind ? null : (
        <div className="rhythm-kind-pick" role="radiogroup" aria-label="Category filter">
          <button type="button" role="radio" aria-checked={kind === "all"} className={`rhythm-kind${kind === "all" ? " is-on" : ""}`} onClick={() => setKind("all")}>
            All
          </button>
          {PART_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={`rhythm-kind is-${k}${kind === k ? " is-on" : ""}`}
              onClick={() => setKind(k)}
            >
              <Icon name={KIND_ICON[k]} size={14} />
              {PART_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        )}
        <input
          type="search"
          className="rhythm-library-search"
          placeholder="Search by name"
          aria-label="Search parts"
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
              <button key={t} type="button" className={`rhythm-tag${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => toggleFilter(t)}>
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

      {shown.length ? (
        <div className="rhythm-library-list">
          {shown.map((p) => {
            const playing = previewId === p.id;
            const canChange = p.source === "user" || devTarget;
            return (
              <div key={`${p.source}:${p.id}`} className={`rhythm-library-item is-${p.kind}`}>
                <div className="rhythm-library-info">
                  <div className="rhythm-library-title">
                    <span className={`rhythm-kind-badge is-${p.kind}`}>
                      <Icon name={KIND_ICON[p.kind]} size={12} />
                      {PART_KIND_LABELS[p.kind]}
                    </span>
                    <strong>{p.name}</strong>
                    <span className={`rhythm-conv-track-tag is-${p.source}`}>{p.source === "native" ? "Factory" : "Mine"}</span>
                  </div>
                  <span className="rhythm-library-meta">
                    {p.bars} bar{p.bars === 1 ? "" : "s"} · {p.numerator}/{p.denominator} · {p.tempoBpm} BPM · {p.notes.length} hits
                  </span>
                  {p.tags.length ? (
                    <span className="rhythm-library-tags">
                      {p.tags.map((t) => (
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
                    aria-label={playing ? `Stop ${p.name}` : `Play ${p.name}`}
                    onClick={() => onPreview(playing ? null : p.id)}
                  >
                    <Icon name={playing ? "stop" : "play"} size={14} />
                  </button>
                  {targetRole ? (
                    <button type="button" className="btn primary" onClick={() => onUse(p, targetRole)}>
                      Use for {PART_LABELS[targetRole]}
                    </button>
                  ) : (
                    <select
                      aria-label={`Use ${p.name} as`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) onUse(p, e.target.value as PartRole);
                      }}
                    >
                      <option value="">Use As…</option>
                      {rolesForKind(p.kind).map((r) => (
                        <option key={r} value={r}>
                          {PART_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!canChange || busy}
                    aria-label={`Edit name, category and tags of ${p.name}`}
                    title={canChange ? "Edit name, category and tags" : "Factory parts can only be changed in development"}
                    onClick={() => onEdit(p)}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!canChange || busy}
                    aria-label={`Delete ${p.name}`}
                    title={canChange ? "Delete" : "Factory parts can only be deleted in development"}
                    onClick={() => onDelete(p)}
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
          {parts.some((p) => !lockedKind || p.kind === lockedKind)
            ? "No parts match these filters."
            : `${lockedKind ? `No ${PART_KIND_LABELS[lockedKind]} parts in the library yet.` : "The library is empty."} Open a Guitar Pro or MIDI file, select bars and use Save to Library, or save a part of the rhythm with its save button.`}
        </p>
      )}
    </section>
  );
}
