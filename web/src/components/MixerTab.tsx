import { useState } from "react";
import {
  MIXER_INPUT_GROUPS,
  MIXER_OUTPUT_GROUPS,
  mixerGroupTitle,
  mixerLinkPartner,
  visibleMixerGroups,
  type MixerGroup,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { Icon, type IconName } from "./Icon";
import type { PatchHandler } from "./LoopTab";
import { ParamControl } from "./ParamControl";

type MixerSub = "input" | "output";

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

export function MixerTab({
  model,
  onPatch,
  scope = "mem",
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  scope?: "mem" | "sys";
}) {
  const [sub, setSub] = useState<MixerSub>("input");
  const groups = sub === "input" ? MIXER_INPUT_GROUPS : MIXER_OUTPUT_GROUPS;
  const visible = visibleMixerGroups(groups, model.input, model.output);

  function setMixer(tag: string, value: number) {
    const partial: TagMap = { [tag]: String(value) };
    const partner = mixerLinkPartner(tag, model.input, model.output);
    if (partner) partial[partner] = String(value);
    onPatch({ type: "section", section: "MIXER", tags: partial, scope });
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
            onClick={() => setSub(t.id)}
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
