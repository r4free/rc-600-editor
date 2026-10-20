import { useEffect, useState, type ReactNode } from "react";
import {
  MIXER_INPUT_GROUPS,
  MIXER_OUTPUT_GROUPS,
  REC_PARAMS,
  TRACK_PARAMS,
  displayParam,
  mixerGroupTitle,
  visibleMixerGroups,
  type MixerGroup,
  type ParamDef,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { EqFader } from "./EqFaders";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import type { PatchHandler } from "./LoopTab";
import { applyMixerPatch } from "./MixerChannelGrid";
import { Modal } from "./Modal";
import { StereoLinkToggle } from "./StereoLinkToggle";
import { InputRouteToggles, TrackRouteToggles } from "./TrackRouteToggles";

const TRACK_NOS = [1, 2, 3, 4, 5, 6] as const;

/** Rhythm sound + loop bus levels (Parameter Guide Mixer Output). */
const RHYTHM_GROUPS: MixerGroup[] = MIXER_OUTPUT_GROUPS.filter(
  (g) => g.title === "Loop" || g.title === "Rhythm",
);
const OUTPUT_BUS_GROUPS: MixerGroup[] = MIXER_OUTPUT_GROUPS.filter(
  (g) => g.title !== "Loop" && g.title !== "Rhythm",
);

function channelIcon(title: string): IconName {
  const t = title.toUpperCase();
  if (t.startsWith("MIC")) return "mic";
  if (t.startsWith("INST")) return "guitar";
  if (t.startsWith("MAIN")) return "speaker";
  if (t.startsWith("SUB")) return "speaker";
  if (t === "PHONES") return "headphones";
  if (t === "MASTER") return "master";
  if (t === "LOOP") return "loop";
  if (t === "RHYTHM") return "tempo";
  if (t.includes("REC")) return "record";
  return "equalizer";
}

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function faderDisplay(def: ParamDef, value: number): { value: string; unit?: string } {
  return { value: displayParam(def, value) };
}

const levelDef = TRACK_PARAMS.find((p) => p.tag === "D");
const panDef = TRACK_PARAMS.find((p) => p.tag === "C");

function MixerLevelStrips({
  model,
  groups,
  idPrefix,
  onSetMixer,
  onPatch,
  showInputRouting = false,
  showStereoLink = false,
}: {
  model: MemoryModel;
  groups: MixerGroup[];
  idPrefix: string;
  onSetMixer: (values: Record<string, number>) => void;
  onPatch?: PatchHandler;
  /** Under MIC / INST / Rhythm: destination chips (ROUTING H–N). */
  showInputRouting?: boolean;
  /** Under primary MIC / INST / MAIN / SUB: Linked vs Separate. */
  showStereoLink?: boolean;
}) {
  const visible = visibleMixerGroups(groups, model.input, model.output);
  return (
    <>
      {visible.map((group) => {
        const mute = group.params.find((p) => p.kind === "bool");
        const muted = mute ? num(model.mixer, mute.tag) === 1 : false;
        const title = mixerGroupTitle(group, model.input, model.output);
        const level = group.params.find((p) => p !== mute);
        if (!level) return null;
        const icon = channelIcon(title);
        const linkKind = group.linkFrom;
        const canLink =
          showStereoLink &&
          onPatch &&
          group.linkTag &&
          group.role === "primary" &&
          (linkKind === "input" || linkKind === "output");
        return (
          <section key={level.tag} className="track-mixer-strip">
            <div className="track-mixer-glyph" title={title}>
              <Icon name={icon} size={16} />
            </div>
            <div className="track-mixer-faders">
              <EqFader
                id={`${idPrefix}-${level.tag}`}
                def={{ ...level, name: title }}
                short={title}
                value={muted ? (level.min ?? 0) : num(model.mixer, level.tag, level.default ?? 0)}
                onChange={(v) =>
                  onSetMixer(
                    mute
                      ? { [level.tag]: v, [mute.tag]: v <= (level.min ?? 0) ? 1 : 0 }
                      : { [level.tag]: v },
                  )
                }
                display={faderDisplay}
              />
            </div>
            {canLink ? (
              <StereoLinkToggle
                kind={linkKind}
                linkTag={group.linkTag!}
                label={group.linkedTitle ?? group.title}
                model={model}
                onPatch={onPatch}
              />
            ) : null}
            {showInputRouting && onPatch ? (
              <InputRouteToggles group={group} model={model} onPatch={onPatch} />
            ) : null}
          </section>
        );
      })}
    </>
  );
}

function MixerSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <div className="memory-mixer-section" aria-label={label}>
      <span className="memory-mixer-section-label">
        <Icon name={icon} size={14} />
        {label}
      </span>
      <div className="memory-mixer-strips">{children}</div>
    </div>
  );
}

/** Shared console board (inline tab or fullscreen modal). */
function MemoryMixerConsole({
  model,
  onPatch,
  idPrefix,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  idPrefix: string;
}) {
  function setMixer(values: Record<string, number>) {
    onPatch({ type: "section", section: "MIXER", tags: applyMixerPatch(model, values) });
  }

  const sensDef = REC_PARAMS.find((p) => p.tag === "D");

  return (
    <div className="memory-mixer-console" role="group" aria-label="Memory Mixer">
      <MixerSection label="Tracks" icon="loop">
        {levelDef && panDef
          ? TRACK_NOS.map((n) => {
              const tags = model.tracks[n - 1] ?? {};
              return (
                <section key={n} className="track-mixer-strip is-track-pair">
                  <div className="track-mixer-glyph" title={`Track ${n}`}>
                    <Icon name="play" size={16} />
                  </div>
                  <h4 className="track-mixer-title">Track {n}</h4>
                  <div className="track-mixer-faders">
                    <EqFader
                      id={`${idPrefix}-tr-${n}-D`}
                      def={levelDef}
                      short="Level"
                      value={num(tags, "D", levelDef.default ?? 100)}
                      onChange={(v) =>
                        onPatch({ type: "track", track: n, tags: { D: String(v) } })
                      }
                      display={faderDisplay}
                    />
                    <EqFader
                      id={`${idPrefix}-tr-${n}-C`}
                      def={panDef}
                      short="Pan"
                      value={num(tags, "C", panDef.default ?? 50)}
                      onChange={(v) =>
                        onPatch({ type: "track", track: n, tags: { C: String(v) } })
                      }
                      display={faderDisplay}
                    />
                  </div>
                  <TrackRouteToggles trackNo={n} model={model} onPatch={onPatch} />
                </section>
              );
            })
          : null}
      </MixerSection>

      {sensDef ? (
        <MixerSection label="Record" icon="record">
          <section className="track-mixer-strip">
            <div className="track-mixer-glyph" title="Auto Rec Sens">
              <Icon name="record" size={16} />
            </div>
            <div className="track-mixer-faders">
              <EqFader
                id={`${idPrefix}-rec-D`}
                def={sensDef}
                short="Rec Sens"
                value={num(model.rec, "D", sensDef.default ?? 50)}
                onChange={(v) =>
                  onPatch({ type: "section", section: "REC", tags: { D: String(v) } })
                }
                display={faderDisplay}
              />
            </div>
          </section>
        </MixerSection>
      ) : null}

      <MixerSection label="Rhythm" icon="tempo">
        <MixerLevelStrips
          model={model}
          groups={RHYTHM_GROUPS}
          idPrefix={`${idPrefix}-rhy`}
          onSetMixer={setMixer}
          onPatch={onPatch}
          showInputRouting
        />
      </MixerSection>

      <MixerSection label="Input" icon="mic">
        <MixerLevelStrips
          model={model}
          groups={MIXER_INPUT_GROUPS}
          idPrefix={`${idPrefix}-in`}
          onSetMixer={setMixer}
          onPatch={onPatch}
          showInputRouting
          showStereoLink
        />
      </MixerSection>

      <MixerSection label="Output" icon="speaker">
        <MixerLevelStrips
          model={model}
          groups={OUTPUT_BUS_GROUPS}
          idPrefix={`${idPrefix}-out`}
          onSetMixer={setMixer}
          onPatch={onPatch}
          showStereoLink
        />
      </MixerSection>
    </div>
  );
}

/** One full-page console: all faders in a horizontal scroll row. */
export function MemoryMixerTab({
  model,
  onPatch,
  onCopyToMemories,
  copyDisabled,
  copyDisabledReason,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  onCopyToMemories?: () => void;
  copyDisabled?: boolean;
  copyDisabledReason?: string | null;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const copyButton =
    onCopyToMemories != null ? (
      <button
        type="button"
        className="btn ghost"
        disabled={copyDisabled}
        title={
          copyDisabledReason ??
          "Copy track Level/Pan, Auto Rec Sens, and Input/Output mixer levels to other memories"
        }
        onClick={onCopyToMemories}
      >
        <Icon name="copy" size={14} />
        Copy to memories…
      </button>
    ) : null;

  return (
    <div className="memory-mixer-tab">
      <div className="memory-mixer-head">
        {copyButton}
        <button
          type="button"
          className="btn ghost"
          aria-pressed={fullscreen}
          title={fullscreen ? "Exit full screen (Esc)" : "Open Memory Mixer full screen"}
          onClick={() => setFullscreen(true)}
        >
          <Icon name="fullscreen" size={14} />
          Full screen
        </button>
        <InfoTip
          label="Memory Mixer"
          text="Play Level and Pan for all tracks, Auto Rec Sens, Rhythm (drum) and Loop bus levels, and Input / Output levels for this memory. Same values as Loop → Tracks and I/O Mixer. Use Copy to memories… to apply this mix to other memory slots, or Full screen for a larger console."
        />
      </div>

      <MemoryMixerConsole model={model} onPatch={onPatch} idPrefix="mem-mix" />

      {fullscreen ? (
        <Modal
          title="Memory Mixer"
          onClose={() => setFullscreen(false)}
          className="modal-fullscreen memory-mixer-modal"
          actions={copyButton}
        >
          <MemoryMixerConsole model={model} onPatch={onPatch} idPrefix="mem-mix-fs" />
        </Modal>
      ) : null}
    </div>
  );
}
