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
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
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

  function setMixer(values: Record<string, number>) {
    const partial: TagMap = {};
    for (const [tag, value] of Object.entries(values)) {
      partial[tag] = String(value);
      const partner = mixerLinkPartner(tag, model.input, model.output);
      if (partner) partial[partner] = String(value);
    }
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
        <span className="tabs-help">
          <InfoTip
            label={sub === "input" ? "Input Mixer" : "Output Mixer"}
            text={
              sub === "input"
                ? "Input levels. Drag a Level all the way left to mute that input. Stereo link on Input → Setup hides the paired jack and keeps both in sync."
                : "Output levels. Stereo link on Output → Setup hides the paired jack and keeps both in sync."
            }
          />
        </span>
      </div>

      <div className="channel-grid">
        {visible.map((group: MixerGroup) => {
          // Mute has no switch of its own: Level at far left (0) is Mute.
          const mute = group.params.find((p) => p.kind === "bool");
          const muted = mute ? num(model.mixer, mute.tag) === 1 : false;
          const title = mixerGroupTitle(group, model.input, model.output);
          const controls = group.params
            .filter((def) => def !== mute)
            .map((def) => (
              <ParamControl
                key={def.tag}
                id={`mix-${def.tag}`}
                def={{ ...def, name: title }}
                value={muted ? (def.min ?? 0) : num(model.mixer, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  setMixer(
                    mute
                      ? { [def.tag]: v, [mute.tag]: v <= (def.min ?? 0) ? 1 : 0 }
                      : { [def.tag]: v },
                  )
                }
              />
            ));
          return controls;
        })}
      </div>
    </div>
  );
}
