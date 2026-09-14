import {
  TRACK_FX_SEQ_PARAMS,
  trackFxSeqSection,
  trackFxSection,
  trackFxTypeLabel,
  trackFxTypeParams,
} from "@rc600/catalog/track-fx";
import type { MemoryModel } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { Modal } from "./Modal";
import { ParamControl } from "./ParamControl";
import type { PatchHandler } from "./LoopTab";

function num(tags: Record<string, string | undefined>, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function TrackFxEditModal({
  model,
  bank,
  slot,
  type,
  onPatch,
  onClose,
}: {
  model: MemoryModel;
  bank: number;
  slot: number;
  type: number;
  onPatch: PatchHandler;
  onClose: () => void;
}) {
  const section = trackFxSection(bank, slot, type);
  const seqSection = trackFxSeqSection(bank, slot, type);
  const params = trackFxTypeParams(type);
  const title = trackFxTypeLabel(type);

  function setBlockTag(sec: string, tag: string, value: number) {
    const op: PatchOp = { type: "tfx", section: sec, tags: { [tag]: String(value) } };
    onPatch(op);
  }

  if (!section || params.length === 0) {
    return (
      <Modal title={title} onClose={onClose} wide>
        <p className="hint">This effect type has no editable parameters.</p>
      </Modal>
    );
  }

  const tags = model.tfxBlocks[section] ?? {};
  const seqTags = seqSection ? (model.tfxBlocks[seqSection] ?? {}) : {};

  return (
    <Modal title={`Edit ${title}`} onClose={onClose} wide>
      <div className="param-columns">
        {params.map((def) => (
          <ParamControl
            key={def.tag}
            id={`tfx-edit-${section}-${def.tag === "#" ? "hash" : def.tag}`}
            def={def}
            value={num(tags, def.tag, def.default ?? 0)}
            onChange={(v) => setBlockTag(section, def.tag, v)}
          />
        ))}
      </div>
      {seqSection ? (
        <>
          <h3 className="section-title">Step Sequence</h3>
          <div className="param-columns">
            {TRACK_FX_SEQ_PARAMS.map((def) => (
              <ParamControl
                key={def.tag}
                id={`tfx-edit-${seqSection}-${def.tag}`}
                def={def}
                value={num(seqTags, def.tag, def.default ?? 0)}
                onChange={(v) => setBlockTag(seqSection, def.tag, v)}
              />
            ))}
          </div>
        </>
      ) : null}
    </Modal>
  );
}
