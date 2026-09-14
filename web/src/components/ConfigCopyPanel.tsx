import { useEffect, useId, useRef, useState } from "react";
import type { TagMap } from "@rc600/rc0/memory";
import {
  CONFIG_CLIPBOARD_SLOTS,
  clearClipboardSlot,
  loadClipboard,
  saveClipboardSlot,
  type ConfigClipboard,
  type ConfigCopyKind,
} from "../presets/configClipboard";
import { Icon } from "./Icon";

export function ConfigCopyPanel({
  kind,
  sourceLabel,
  tags,
  onPaste,
}: {
  kind: ConfigCopyKind;
  sourceLabel: string;
  tags: TagMap;
  onPaste: (tags: TagMap) => void;
}) {
  const baseId = useId();
  const [clipboard, setClipboard] = useState<ConfigClipboard>(() => loadClipboard());
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function refresh() {
    setClipboard(loadClipboard());
  }

  function copyToSlot(index: number) {
    saveClipboardSlot(index, { kind, label: sourceLabel, tags: { ...tags } });
    refresh();
    setNote(`Copied ${sourceLabel} → Config ${index + 1}`);
  }

  function pasteFromSlot(index: number) {
    const slot = clipboard[index];
    if (!slot || slot.kind !== kind) return;
    onPaste({ ...slot.tags });
    setNote(`Applied ${slot.label} from Config ${index + 1}`);
  }

  function clearSlot(index: number) {
    clearClipboardSlot(index);
    refresh();
    setNote(`Cleared Config ${index + 1}`);
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenIndex(null), 120);
  }

  function openPopover(index: number) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenIndex(index);
  }

  return (
    <div className="config-copy-panel" aria-label={`${sourceLabel} clipboard`}>
      <div
        className="config-slot-bar"
        role="list"
        aria-label={`Config clipboard (${CONFIG_CLIPBOARD_SLOTS} slots)`}
      >
        {Array.from({ length: CONFIG_CLIPBOARD_SLOTS }, (_, i) => {
          const slot = clipboard[i];
          const empty = !slot;
          const canPaste = Boolean(slot && slot.kind === kind);
          const mismatch = Boolean(slot && slot.kind !== kind);
          const isOpen = openIndex === i;
          const configName = `Config ${i + 1}`;
          const popoverId = `${baseId}-pop-${i}`;
          return (
            <div
              key={i}
              className={`config-slot${empty ? " is-empty" : " is-filled"}${
                canPaste ? " is-pasteable" : ""
              }${mismatch ? " is-mismatch" : ""}${isOpen ? " is-hot" : ""}`}
              role="listitem"
              onMouseEnter={() => openPopover(i)}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                className="config-slot-btn"
                aria-describedby={isOpen ? popoverId : undefined}
                aria-label={
                  empty
                    ? `${configName}, empty. Click to copy ${sourceLabel}.`
                    : canPaste
                      ? `${configName}: ${slot!.label}. Double-click to apply.`
                      : `${configName}: ${slot!.label}. Wrong kind for this page.`
                }
                onFocus={() => openPopover(i)}
                onBlur={scheduleClose}
                onClick={() => {
                  if (empty) copyToSlot(i);
                }}
                onDoubleClick={() => {
                  if (canPaste) pasteFromSlot(i);
                }}
              >
                {configName}
              </button>
              {slot ? (
                <button
                  type="button"
                  className="config-slot-clear"
                  aria-label={`Clear ${configName}`}
                  title="Clear this config"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSlot(i);
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              ) : null}
              {isOpen ? (
                <div id={popoverId} className="config-slot-popover" role="tooltip">
                  <strong>{empty ? configName : slot!.label}</strong>
                  <span>
                    {empty
                      ? "Empty slot"
                      : mismatch
                        ? `${slot!.kind} · wrong kind for this page`
                        : slot!.kind}
                  </span>
                  <span className="config-slot-pop-hint">
                    {empty
                      ? `Click to copy current ${sourceLabel}`
                      : canPaste
                        ? "Double-click to apply to this page"
                        : `Needs ${kind} settings`}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {note ? <p className="config-slot-note">{note}</p> : null}
    </div>
  );
}
