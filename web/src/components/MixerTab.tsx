import { usePersistedTab } from "../uiTabs";
import { MIXER_INPUT_GROUPS, MIXER_OUTPUT_GROUPS } from "@rc600/catalog/params";
import type { MemoryModel } from "@rc600/rc0/memory";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import type { PatchHandler } from "./LoopTab";
import { MixerChannelGrid, applyMixerPatch } from "./MixerChannelGrid";

const MIXER_SUBS = ["input", "output"] as const;
type MixerSub = (typeof MIXER_SUBS)[number];

const SUBS: { id: MixerSub; label: string; icon: IconName }[] = [
  { id: "input", label: "Input Mixer", icon: "mic" },
  { id: "output", label: "Output Mixer", icon: "master" },
];

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

  function setMixer(values: Record<string, number>) {
    onPatch({ type: "section", section: "MIXER", tags: applyMixerPatch(model, values), scope });
  }

  return (
    <div className="mixer-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="I/O Mixer">
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

      <MixerChannelGrid model={model} groups={groups} onSetMixer={setMixer} />
    </div>
  );
}
