import {
  mixerGroupTitle,
  mixerLinkPartner,
  visibleMixerGroups,
  type MixerGroup,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { ParamControl } from "./ParamControl";

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Shared Input/Output mixer channel grid (mute-at-min + stereo link). */
export function MixerChannelGrid({
  model,
  groups,
  onSetMixer,
  idPrefix = "mix",
}: {
  model: MemoryModel;
  groups: MixerGroup[];
  onSetMixer: (values: Record<string, number>) => void;
  idPrefix?: string;
}) {
  const visible = visibleMixerGroups(groups, model.input, model.output);

  return (
    <div className="channel-grid">
      {visible.map((group: MixerGroup) => {
        const mute = group.params.find((p) => p.kind === "bool");
        const muted = mute ? num(model.mixer, mute.tag) === 1 : false;
        const title = mixerGroupTitle(group, model.input, model.output);
        return group.params
          .filter((def) => def !== mute)
          .map((def) => (
            <ParamControl
              key={def.tag}
              id={`${idPrefix}-${def.tag}`}
              def={{ ...def, name: title }}
              value={muted ? (def.min ?? 0) : num(model.mixer, def.tag, def.default ?? 0)}
              onChange={(v) =>
                onSetMixer(
                  mute
                    ? { [def.tag]: v, [mute.tag]: v <= (def.min ?? 0) ? 1 : 0 }
                    : { [def.tag]: v },
                )
              }
            />
          ));
      })}
    </div>
  );
}

/** Apply mixer values with stereo-link partners from Input/Output setup. */
export function applyMixerPatch(
  model: MemoryModel,
  values: Record<string, number>,
): TagMap {
  const partial: TagMap = {};
  for (const [tag, value] of Object.entries(values)) {
    partial[tag] = String(value);
    const partner = mixerLinkPartner(tag, model.input, model.output);
    if (partner) partial[partner] = String(value);
  }
  return partial;
}
