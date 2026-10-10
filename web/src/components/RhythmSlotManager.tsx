import { useState } from "react";
import { MAX_USER_PATTERNS, PATTERN_NAME_MAX } from "../rhythmConverter/rhythmRc0";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";

export interface SlotInfo {
  name: string;
  kit: number;
  tempo: number;
  meter: string;
  bars: number;
  /** Preview id when the slot has notes to play. */
  previewId: string | null;
}

const SLOTS_TEXT = `Every user rhythm on the RC-600 lives in one file, ROLAND/DATA/RHYTHM.RC0 (up to ${MAX_USER_PATTERNS} slots, shown on the pedal under Rhythm → Genre: User). With the RC-600 drive open (USB storage mode), every change here is written to the pedal at once. Without the pedal, open a RHYTHM.RC0 (a backup, or a copy from ROLAND/DATA) or start an empty list, make your changes, then Download RHYTHM.RC0 and copy it to ROLAND/DATA on the pedal; the offline list stays in this browser until you close it. Load puts a slot in the builder so you can edit it; Save to Slot then replaces it. The library button saves a slot to your rhythm library, and each of its parts to the part library tagged with the rhythm name. Moving or deleting slots renumbers the ones after it, so memories that pick a user rhythm by number may point to a different one.`;

const SYNC_TEXT =
  "There are two places for user rhythms. The offline list lives in this browser: open a RHYTHM.RC0 (a backup) or start an empty list, and every Save to Offline Slot goes there, even with no pedal around. The RC-600 list is the pedal itself: it shows when the RC-600 is in USB Storage mode and its ROLAND folder is open (Connect RC-600), and every change there is written to the pedal at once. To move offline work to the pedal, connect it, then use Add to RC-600 (keeps the pedal's rhythms and adds yours; same name replaces) or Replace RC-600 (the pedal ends up with exactly the offline list). Copy to Offline takes the pedal's rhythms home, so you can keep working without it. Without connecting, Download RHYTHM.RC0 and copy the file to ROLAND/DATA on the pedal by hand.";

export function RhythmSlotManager({
  mode,
  origin,
  slots,
  dirty,
  target,
  newSlot,
  previewId,
  progress,
  busy,
  writeBlocked,
  listLocked,
  kitLabel,
  onOpenFile,
  onStartEmpty,
  onCloseList,
  onReload,
  onDownload,
  onPreview,
  onLoad,
  onRename,
  onMove,
  onDelete,
  onTarget,
  onSaveToLibrary,
  offline,
  onSendOffline,
  onCopyToOffline,
  onConnectUsb,
  onBackupDone,
}: {
  /** "drive": the RC-600 drive is open and changes are written to it. "offline": a working copy in the browser. */
  mode: "drive" | "offline";
  /** File the offline list came from; null when it was started empty. */
  origin: string | null;
  slots: SlotInfo[] | null;
  dirty: boolean;
  target: number;
  newSlot: number;
  previewId: string | null;
  progress: number;
  busy: boolean;
  writeBlocked?: string;
  /** Preview key: play and load stay available; saving the list does not. */
  listLocked?: string;
  kitLabel: (kit: number) => string;
  onOpenFile: () => void;
  onStartEmpty: () => void;
  onCloseList: () => void;
  onReload: () => void;
  onDownload: () => void;
  onPreview: (id: string | null) => void;
  onLoad: (index: number) => void;
  onRename: (index: number, name: string) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (index: number) => void;
  onTarget: (index: number) => void;
  onSaveToLibrary: (index: number) => void;
  /** Drive mode: the offline list kept in this browser, if any. */
  offline: { count: number; origin: string | null; dirty: boolean } | null;
  onSendOffline: (mode: "merge" | "replace") => void;
  onCopyToOffline: () => void;
  onConnectUsb?: () => void;
  onBackupDone?: () => void;
}) {
  const [renaming, setRenaming] = useState<{ index: number; name: string } | null>(null);
  const locked = busy || (mode === "drive" && Boolean(writeBlocked)) || Boolean(listLocked);

  function commitRename() {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (name && name !== slots?.[renaming.index]?.name) onRename(renaming.index, name);
    setRenaming(null);
  }

  return (
    <section className="rhythm-slots" aria-label="RC-600 Slots">
      <div className="rhythm-conv-section-head">
        <h3>RC-600 Slots</h3>
        <InfoTip label="RC-600 Slots" text={SLOTS_TEXT} />
        <span className={`rhythm-slots-source is-${mode}`}>
          <Icon name={mode === "drive" ? "usb" : "folderOpen"} size={14} />
          {mode === "drive"
            ? "Showing: RC-600"
            : slots
              ? `Showing: offline list${origin ? ` from ${origin}` : " (started empty)"}`
              : "Showing: offline list"}
        </span>
        {slots ? (
          <span className="rhythm-slots-count">
            {slots.length} / {MAX_USER_PATTERNS} used
          </span>
        ) : null}
        {mode === "offline" && dirty ? (
          <span className="rhythm-slots-dirty">
            <Icon name="dirty" size={14} />
            Not downloaded yet
          </span>
        ) : null}
        <span className="rhythm-editor-spacer" />
        {mode === "drive" ? (
          <button type="button" className="btn ghost" onClick={onReload} disabled={busy}>
            <Icon name="refresh" size={14} />
            Reload
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={onOpenFile} disabled={busy}>
              <Icon name="folderOpen" size={14} />
              Open RHYTHM.RC0…
            </button>
            <button type="button" className="btn ghost" onClick={onStartEmpty} disabled={busy || Boolean(listLocked)} title={listLocked}>
              <Icon name="plus" size={14} />
              Start Empty List
            </button>
          </>
        )}
        <button
          type="button"
          className={`btn${mode === "offline" && dirty ? " primary" : ""}`}
          onClick={onDownload}
          disabled={!slots || busy || Boolean(listLocked)}
          title={
            listLocked
              ? listLocked
              : mode === "drive"
                ? "Download a backup of the pedal's RHYTHM.RC0"
                : "Download the file to copy to ROLAND/DATA on the RC-600"
          }
        >
          <Icon name="download" size={14} />
          {mode === "drive" ? "Download Backup" : "Download RHYTHM.RC0"}
        </button>
        {mode === "offline" && slots ? (
          <button type="button" className="btn ghost" onClick={onCloseList} disabled={busy}>
            <Icon name="close" size={14} />
            Close List
          </button>
        ) : null}
      </div>

      <div className={`rhythm-sync is-${mode}`}>
        <div className={`rhythm-sync-side${mode === "offline" ? " is-current" : ""}`}>
          <Icon name="folderOpen" size={18} />
          <div>
            <strong>Offline list (this browser)</strong>
            <span>
              {mode === "offline"
                ? slots
                  ? `${slots.length} rhythm${slots.length === 1 ? "" : "s"}${dirty ? " · changes not on the pedal yet" : ""}`
                  : "Empty: open a RHYTHM.RC0 or start a list"
                : offline
                  ? `${offline.count} rhythm${offline.count === 1 ? "" : "s"}${offline.origin ? ` · from ${offline.origin}` : ""}${offline.dirty ? " · not sent yet" : ""}`
                  : "None kept in this browser"}
            </span>
          </div>
        </div>
        <div className="rhythm-sync-actions">
          {mode === "drive" ? (
            <>
              <button
                type="button"
                className={`btn${offline?.dirty ? " primary" : ""}`}
                disabled={!offline?.count || locked}
                title="Add the offline rhythms to the pedal; a rhythm whose name is already there replaces that slot"
                onClick={() => onSendOffline("merge")}
              >
                <Icon name="upload" size={14} />
                Add to RC-600
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={!offline?.count || locked}
                title="Make the pedal's user rhythms exactly the offline list (the rhythms now on the pedal are replaced)"
                onClick={() => onSendOffline("replace")}
              >
                <Icon name="replace1" size={14} />
                Replace RC-600
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={!slots || busy || Boolean(listLocked)}
                title={listLocked ?? "Copy the pedal's rhythms into the offline list, to keep working without the RC-600"}
                onClick={onCopyToOffline}
              >
                <Icon name="download" size={14} />
                Copy to Offline
              </button>
            </>
          ) : onConnectUsb ? (
            <button
              type="button"
              className="btn primary"
              title="Put the RC-600 in USB Storage mode and open its ROLAND folder; then send this list to the pedal"
              onClick={onConnectUsb}
            >
              <Icon name="usb" size={14} />
              Connect RC-600
            </button>
          ) : null}
          <InfoTip label="Offline and RC-600" text={SYNC_TEXT} />
        </div>
        <div className={`rhythm-sync-side${mode === "drive" ? " is-current" : ""}`}>
          <Icon name="usb" size={18} />
          <div>
            <strong>RC-600 (pedal)</strong>
            <span>
              {mode === "drive"
                ? slots
                  ? `${slots.length} rhythm${slots.length === 1 ? "" : "s"} · connected, changes are saved at once`
                  : "Connected · reading…"
                : "Not connected"}
            </span>
          </div>
        </div>
      </div>

      {listLocked ? <p className="drum-pad-hint warn">{listLocked}</p> : null}
      {mode === "drive" && writeBlocked ? (
        <p className="drum-pad-hint warn">
          {writeBlocked}
          {onBackupDone ? (
            <button type="button" className="btn primary" onClick={onBackupDone}>
              Backup done — unlock save
            </button>
          ) : null}
        </p>
      ) : null}
      {mode === "offline" && slots && !origin ? (
        <p className="drum-pad-hint warn">
          This list started empty: copying it to the pedal replaces every user rhythm there. Open a RHYTHM.RC0 backup
          instead to keep them.
        </p>
      ) : null}

      {!slots ? (
        <div className="rhythm-slots-empty">
          <Icon name="usb" size={20} />
          <span>
            No offline list yet. Open a RHYTHM.RC0 (a backup of the pedal) or start an empty list to work without the
            pedal, or connect the RC-600 to edit its rhythms directly.
          </span>
        </div>
      ) : (
        <ol className="rhythm-slots-list">
          {slots.map((s, i) => {
            const playing = Boolean(s.previewId) && previewId === s.previewId;
            const isTarget = target === i;
            return (
              <li key={`${i}:${s.name}`} className={`rhythm-slot${isTarget ? " is-target" : ""}`}>
                <span className="rhythm-slot-num">{i + 1}</span>
                <div className="rhythm-slot-info">
                  {renaming?.index === i ? (
                    <input
                      className="rhythm-slot-rename"
                      autoFocus
                      maxLength={PATTERN_NAME_MAX}
                      value={renaming.name}
                      aria-label={`New name for slot ${i + 1}`}
                      onChange={(e) => setRenaming({ index: i, name: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setRenaming(null);
                        }
                      }}
                    />
                  ) : (
                    <strong className="rhythm-slot-name" title={s.name}>
                      {s.name || "(no name)"}
                    </strong>
                  )}
                  <span className="rhythm-slot-meta">
                    {s.meter} · {s.tempo} BPM · {kitLabel(s.kit)} · {s.bars} bar{s.bars === 1 ? "" : "s"}
                  </span>
                  {isTarget ? <span className="rhythm-slot-target">Save to Slot replaces this one</span> : null}
                </div>
                <div className="rhythm-slot-actions">
                  <button
                    type="button"
                    className={`btn ghost${playing ? " is-on" : ""}`}
                    disabled={!s.previewId}
                    aria-label={playing ? `Stop slot ${i + 1}` : `Play Variation A of slot ${i + 1}`}
                    title="Play Variation A"
                    onClick={() => onPreview(playing ? null : s.previewId)}
                  >
                    <Icon name={playing ? "stop" : "play"} size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!s.previewId}
                    title="Put this rhythm in the builder to edit it; Save to Slot then replaces this slot"
                    onClick={() => onLoad(i)}
                  >
                    <Icon name="fileMusic" size={14} />
                    <span className="rhythm-slot-btn-label">Edit</span>
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!s.previewId || Boolean(listLocked)}
                    aria-label={`Save slot ${i + 1} to the rhythm library`}
                    title={listLocked ?? "Save to Rhythm Library (each part also goes to the part library, tagged with the rhythm name)"}
                    onClick={() => onSaveToLibrary(i)}
                  >
                    <Icon name="library" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`btn ghost${isTarget ? " is-on" : ""}`}
                    aria-pressed={isTarget}
                    title={
                      isTarget
                        ? "Save to Slot goes to a new slot instead"
                        : "Save the rhythm in the builder over this slot"
                    }
                    onClick={() => onTarget(isTarget ? newSlot : i)}
                  >
                    <Icon name="replace1" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={locked}
                    aria-label={`Rename slot ${i + 1}`}
                    title="Rename"
                    onClick={() => setRenaming({ index: i, name: s.name })}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={locked || i === 0}
                    aria-label={`Move slot ${i + 1} up`}
                    title="Move up"
                    onClick={() => onMove(i, -1)}
                  >
                    <Icon name="arrowUp" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={locked || i === slots.length - 1}
                    aria-label={`Move slot ${i + 1} down`}
                    title="Move down"
                    onClick={() => onMove(i, 1)}
                  >
                    <Icon name="arrowDown" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={locked}
                    aria-label={`Delete slot ${i + 1}`}
                    title="Delete"
                    onClick={() => onDelete(i)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                {playing ? <span className="rhythm-conv-progress" style={{ width: `${progress * 100}%` }} /> : null}
              </li>
            );
          })}
          {slots.length < MAX_USER_PATTERNS ? (
            <li className={`rhythm-slot is-new${target === newSlot ? " is-target" : ""}`}>
              <span className="rhythm-slot-num">{slots.length + 1}</span>
              <div className="rhythm-slot-info">
                <strong className="rhythm-slot-name">Free slot</strong>
                <span className="rhythm-slot-meta">
                  {target === newSlot
                    ? "Save to Slot adds the rhythm in the builder here"
                    : "Pick to add the next save here"}
                </span>
              </div>
              <div className="rhythm-slot-actions">
                <button
                  type="button"
                  className={`btn ghost${target === newSlot ? " is-on" : ""}`}
                  aria-pressed={target === newSlot}
                  title="Save the rhythm in the builder as a new slot"
                  onClick={() => onTarget(newSlot)}
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </li>
          ) : null}
        </ol>
      )}
    </section>
  );
}
