import { useState } from "react";
import { usePersistedTab } from "../uiTabs";
import {
  MIXER_INPUT_GROUPS,
  MIXER_OUTPUT_GROUPS,
  mixerGroupTitle,
  mixerLinkPartner,
  visibleMixerGroups,
  type MixerGroup,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { pickTags } from "../presets/configClipboard";
import { ConfigCopyPanel } from "./ConfigCopyPanel";
import { Icon, type IconName } from "./Icon";
import type { PatchHandler } from "./LoopTab";
import { ParamControl } from "./ParamControl";

const MIXER_SUBS = ["input", "output"] as const;
type MixerSub = (typeof MIXER_SUBS)[number];

const SUBS: { id: MixerSub; label: string; icon: IconName }[] = [
  { id: "input", label: "Input", icon: "mic" },
  { id: "output", label: "Output", icon: "master" },
];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function groupTags(group: MixerGroup): string[] {
  return group.params.map((p) => p.tag);
}

export function MixerTab({
  model,
  onPatch,
  scope = "mem",
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  scope?: "mem" | "sys";
}) {
  const [sub, setSub] = usePersistedTab<MixerSub>(`mixer.${scope}`, "input", MIXER_SUBS);
  const groups = sub === "input" ? MIXER_INPUT_GROUPS : MIXER_OUTPUT_GROUPS;
  const visible = visibleMixerGroups(groups, model.input, model.output);
  const [sourceIdx, setSourceIdx] = useState(0);
  const safeIdx = Math.min(sourceIdx, Math.max(0, visible.length - 1));
  const current = visible[safeIdx] ?? visible[0];

  function setMixer(tag: string, value: number) {
    const partial: TagMap = { [tag]: String(value) };
    const partner = mixerLinkPartner(tag, model.input, model.output);
    if (partner) partial[partner] = String(value);
    onPatch({ type: "section", section: "MIXER", tags: partial, scope });
  }

  function applyGroupTags(target: MixerGroup, sourceTags: TagMap) {
    const tags: TagMap = {};
    for (const def of target.params) {
      if (sourceTags[def.tag] !== undefined) tags[def.tag] = sourceTags[def.tag]!;
    }
    if (Object.keys(tags).length === 0) return;
    onPatch({ type: "section", section: "MIXER", tags, scope });
  }

  return (
    <div className="mixer-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="Mixer">
        {SUBS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={sub === t.id}
            className={`tab ${sub === t.id ? "active" : ""}`}
            onClick={() => {
              setSub(t.id);
              setSourceIdx(0);
            }}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <p className="hint">
        {sub === "input"
          ? "Input levels and mutes. Stereo link on Input → Setup hides the paired jack and keeps both in sync."
          : "Output levels. Stereo link on Output → Setup hides the paired jack and keeps both in sync."}
      </p>

      {current ? (
        <ConfigCopyPanel
          kind="mixer"
          sourceLabel={mixerGroupTitle(current, model.input, model.output)}
          tags={pickTags(model.mixer, groupTags(current))}
          onPaste={(tags) => {
            if (current.params.some((p) => tags[p.tag] !== undefined)) {
              applyGroupTags(current, tags);
              return;
            }
            const mapped: TagMap = {};
            const values = Object.values(tags);
            current.params.forEach((def, i) => {
              if (values[i] !== undefined) mapped[def.tag] = values[i]!;
            });
            if (Object.keys(mapped).length) {
              onPatch({ type: "section", section: "MIXER", tags: mapped, scope });
            }
          }}
        />
      ) : null}

      {visible.length > 0 ? (
        <div className="copy-source-picker" role="group" aria-label="Mixer clipboard target">
          <span className="copy-source-label">Clipboard target</span>
          {visible.map((group, i) => (
            <button
              key={group.title}
              type="button"
              className={`btn ghost assign-source-btn ${safeIdx === i ? "primary" : ""}`}
              onClick={() => setSourceIdx(i)}
              title={`Set ${mixerGroupTitle(group, model.input, model.output)} as clipboard target`}
            >
              {mixerGroupTitle(group, model.input, model.output)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="channel-grid">
        {visible.map((group: MixerGroup) => (
          <section key={group.title} className="channel-card">
            <h3 className="section-title">{mixerGroupTitle(group, model.input, model.output)}</h3>
            <div className="param-columns">
              {group.params.map((def) => (
                <ParamControl
                  key={def.tag}
                  id={`mix-${def.tag}`}
                  def={def}
                  value={num(model.mixer, def.tag, def.default ?? 0)}
                  onChange={(v) => setMixer(def.tag, v)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
