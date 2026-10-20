import {
  bitOn,
  inputStereoLinked,
  outputRouteDestLabel,
  outputRouteLinkPartner,
  outputStereoLinked,
  setBit,
  visibleOutputRouteDests,
  OUTPUT_ROUTE_INPUT_GROUPS,
  type MixerGroup,
  type OutputRouteDest,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { Icon } from "./Icon";
import type { PatchHandler } from "./LoopTab";

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

type RouteWhich = "tagTrack" | "tagInput";

/** Compact output-destination toggles for one source (track or input/rhythm bits). */
export function RouteDestToggles({
  label,
  which,
  bits,
  model,
  onPatch,
}: {
  label: string;
  which: RouteWhich;
  bits: number[];
  model: MemoryModel;
  onPatch: PatchHandler;
}) {
  const dests = visibleOutputRouteDests(model.output, model.routing);
  const readBit = bits[0] ?? 0;

  function toggle(dest: OutputRouteDest) {
    const tag = dest[which];
    const on = !bitOn(num(model.routing, tag), readBit);
    let mask = num(model.routing, tag);
    for (const bit of bits) mask = setBit(mask, bit, on);
    const partial: TagMap = { [tag]: String(mask) };
    const partner = outputRouteLinkPartner(dest);
    if (partner && dest.linkTag && outputStereoLinked(model.output, dest.linkTag)) {
      const pTag = partner[which];
      let pmask = num(model.routing, pTag);
      for (const bit of bits) pmask = setBit(pmask, bit, on);
      partial[pTag] = String(pmask);
    }
    onPatch({ type: "section", section: "ROUTING", tags: partial });
  }

  return (
    <div className="track-mixer-routes" role="group" aria-label={`${label} output routing`}>
      <span className="track-mixer-routes-flow" aria-hidden="true">
        <Icon name="arrowDown" size={12} />
      </span>
      {dests.map((dest) => {
        const destLabel = outputRouteDestLabel(dest, model.output);
        const on = bitOn(num(model.routing, dest[which]), readBit);
        return (
          <button
            key={dest.id}
            type="button"
            className={`track-mixer-route${on ? " is-on" : ""}`}
            aria-pressed={on}
            title={`Route to ${destLabel}: ${on ? "On" : "Off"}. Click to ${on ? "turn off" : "turn on"}.`}
            onClick={() => toggle(dest)}
          >
            <Icon name="arrowDown" size={10} />
            <Icon name={dest.phones ? "headphones" : "speaker"} size={11} />
            <span>{destLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Track → output jack bits (ROUTING A–G). */
export function TrackRouteToggles({
  trackNo,
  model,
  onPatch,
}: {
  trackNo: number;
  model: MemoryModel;
  onPatch: PatchHandler;
}) {
  return (
    <RouteDestToggles
      label={`Track ${trackNo}`}
      which="tagTrack"
      bits={[trackNo - 1]}
      model={model}
      onPatch={onPatch}
    />
  );
}

/**
 * Input / Rhythm mixer strip → output jack bits (ROUTING H–N).
 * Returns null for strips that have no routing (Loop bus, output masters).
 */
export function inputRouteBitsForMixerGroup(
  group: MixerGroup,
  input: { [tag: string]: string | undefined },
): { label: string; bits: number[] } | null {
  if (group.title === "Rhythm") return { label: "Rhythm", bits: [6] };
  const src = OUTPUT_ROUTE_INPUT_GROUPS.find((g) => g.name === group.title);
  if (!src) return null;
  if (src.linkTag && src.role === "primary" && inputStereoLinked(input, src.linkTag)) {
    return { label: src.linkedName ?? src.name, bits: src.bits };
  }
  return { label: src.name, bits: [src.readBit] };
}

export function InputRouteToggles({
  group,
  model,
  onPatch,
}: {
  group: MixerGroup;
  model: MemoryModel;
  onPatch: PatchHandler;
}) {
  const route = inputRouteBitsForMixerGroup(group, model.input);
  if (!route) return null;
  return (
    <RouteDestToggles
      label={route.label}
      which="tagInput"
      bits={route.bits}
      model={model}
      onPatch={onPatch}
    />
  );
}
