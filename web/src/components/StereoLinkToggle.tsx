import {
  INPUT_EQ_CHANNELS,
  INPUT_MIC_DYNAMICS_LINK,
  OUTPUT_EQ_CHANNELS,
  OUTPUT_ROUTE_DESTS,
  inputStereoLinked,
  mixerCopyForInputLink,
  mixerCopyForOutputLink,
  outputRouteLinkPartner,
  outputStereoLinked,
  type OutputLinkTag,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { Icon } from "./Icon";
import type { PatchHandler } from "./LoopTab";

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const INPUT_PAIR: Record<"E" | "F" | "G", string> = {
  E: "MIC 1 and MIC 2",
  F: "INST 1 L and R",
  G: "INST 2 L and R",
};

const OUTPUT_PAIR: Record<OutputLinkTag, string> = {
  B: "MAIN L and R",
  C: "SUB 1 L and R",
  D: "SUB 2 L and R",
};

function applyInputLink(
  model: MemoryModel,
  linkTag: "E" | "F" | "G",
  on: boolean,
  onPatch: PatchHandler,
) {
  const partial: TagMap = { [linkTag]: on ? "1" : "0" };
  if (!on) {
    onPatch({ type: "section", section: "INPUT", tags: partial });
    return;
  }
  const primary = INPUT_EQ_CHANNELS.find((c) => c.linkTag === linkTag && c.role === "primary");
  const secondary = INPUT_EQ_CHANNELS.find((c) => c.linkTag === linkTag && c.role === "secondary");
  if (linkTag === "E") {
    for (const [from, to] of INPUT_MIC_DYNAMICS_LINK) {
      partial[to] = String(num(model.input, from));
    }
  }
  const ops: PatchOp[] = [{ type: "section", section: "INPUT", tags: partial }];
  if (primary && secondary) {
    ops.push({ type: "section", section: secondary.section, tags: model.eq[primary.section] ?? {} });
  }
  ops.push({ type: "section", section: "MIXER", tags: mixerCopyForInputLink(model.mixer, linkTag) });
  onPatch(ops);
}

function applyOutputLink(
  model: MemoryModel,
  linkTag: OutputLinkTag,
  on: boolean,
  onPatch: PatchHandler,
) {
  const partial: TagMap = { [linkTag]: on ? "1" : "0" };
  if (!on) {
    onPatch({ type: "section", section: "OUTPUT", tags: partial });
    return;
  }
  const primary = OUTPUT_ROUTE_DESTS.find((d) => d.linkTag === linkTag && d.role === "primary");
  const secondary = primary ? outputRouteLinkPartner(primary) : null;
  const eqPrimary = OUTPUT_EQ_CHANNELS.find((c) => c.linkTag === linkTag && c.role === "primary");
  const eqSecondary = OUTPUT_EQ_CHANNELS.find((c) => c.linkTag === linkTag && c.role === "secondary");
  const ops: PatchOp[] = [{ type: "section", section: "OUTPUT", tags: partial }];
  if (eqPrimary && eqSecondary) {
    ops.push({
      type: "section",
      section: eqSecondary.section,
      tags: model.outputEq[eqPrimary.section] ?? {},
    });
  }
  if (primary && secondary) {
    ops.push({
      type: "section",
      section: "ROUTING",
      tags: {
        [secondary.tagTrack]: model.routing[primary.tagTrack] ?? "0",
        [secondary.tagInput]: model.routing[primary.tagInput] ?? "0",
      },
    });
  }
  ops.push({ type: "section", section: "MIXER", tags: mixerCopyForOutputLink(model.mixer, linkTag) });
  onPatch(ops);
}

/** Compact Linked / Separate control (same stereo-link tags as Input/Output Setup). */
export function StereoLinkToggle({
  kind,
  linkTag,
  label,
  model,
  onPatch,
}: {
  kind: "input" | "output";
  linkTag: "E" | "F" | "G" | OutputLinkTag;
  label: string;
  model: MemoryModel;
  onPatch: PatchHandler;
}) {
  const linked =
    kind === "input"
      ? inputStereoLinked(model.input, linkTag as "E" | "F" | "G")
      : outputStereoLinked(model.output, linkTag as OutputLinkTag);
  const pair =
    kind === "input"
      ? INPUT_PAIR[linkTag as "E" | "F" | "G"]
      : OUTPUT_PAIR[linkTag as OutputLinkTag];

  return (
    <button
      type="button"
      className={`track-mixer-route track-mixer-link${linked ? " is-on" : ""}`}
      aria-pressed={linked}
      title={
        linked
          ? `${label}: Linked. ${pair} share settings. Click for Separate.`
          : `${label}: Separate. ${pair} use independent settings. Click to Link.`
      }
      onClick={() => {
        if (kind === "input") {
          applyInputLink(model, linkTag as "E" | "F" | "G", !linked, onPatch);
        } else {
          applyOutputLink(model, linkTag as OutputLinkTag, !linked, onPatch);
        }
      }}
    >
      <Icon name={linked ? "connect" : "disconnect"} size={11} />
      <span>{linked ? "Linked" : "Separate"}</span>
    </button>
  );
}
