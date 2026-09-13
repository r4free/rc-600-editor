import { useEffect, useState } from "react";
import { usePersistedTab } from "../uiTabs";
import {
  PLAY_ALL_START_BITS,
  PLAY_ALL_STOP_BITS,
  PLAY_PARAMS,
  REC_BOUNCE_TRACK_BITS,
  REC_PARAMS,
  RHYTHM_PARAMS,
  TRACK_INPUT_BITS,
  TRACK_PARAMS,
  bitOn,
  rhythmPatternOptions,
  setBit,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { trackCopyTags } from "../presets/trackCopy";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { ParamControl } from "./ParamControl";

const LOOP_SUBS = ["track", "rec", "play", "rhythm"] as const;
type LoopSub = (typeof LOOP_SUBS)[number];
const TRACK_NOS = [1, 2, 3, 4, 5, 6] as const;

const SUBS: { id: LoopSub; label: string; icon: IconName }[] = [
  { id: "track", label: "Tracks", icon: "loop" },
  { id: "rec", label: "Record", icon: "record" },
  { id: "play", label: "Play", icon: "play" },
  { id: "rhythm", label: "Rhythm", icon: "tempo" },
];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type PatchHandler = (ops: PatchOp | PatchOp[]) => void;

export function LoopTab({
  model,
  onPatch,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
}) {
  const [sub, setSub] = usePersistedTab<LoopSub>("loop", "track", LOOP_SUBS);
  const [trackNo, setTrackNo] = usePersistedTab("loopTrack", 1, TRACK_NOS);
  const [sameTracks, setSameTracks] = useState<Set<number>>(() => new Set());

  const track = model.tracks[trackNo - 1] ?? {};
  const recorded = num(track, "V") > 0 || num(track, "X") > 0;
  const inputMask = num(track, "Q", 127);

  useEffect(() => {
    setSameTracks((prev) => {
      if (!prev.has(trackNo)) return prev;
      const next = new Set(prev);
      next.delete(trackNo);
      return next;
    });
  }, [trackNo]);

  function copyToSelectedTracks() {
    if (sameTracks.size === 0) return;
    const tags = trackCopyTags(track);
    const ops: PatchOp[] = [...sameTracks].map((t) => ({
      type: "track",
      track: t,
      tags,
    }));
    onPatch(ops);
  }

  return (
    <div className="loop-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="Loop">
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

      {sub === "track" ? (
        <>
          <div className="tabs tabs-sub" role="tablist" aria-label="Track">
            {TRACK_NOS.map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={trackNo === n}
                className={`tab ${trackNo === n ? "active" : ""}`}
                onClick={() => setTrackNo(n)}
              >
                <Icon name="play" size={12} />
                Track {n}
              </button>
            ))}
          </div>

          <h3 className="section-title">Track {trackNo}</h3>
          <div className="param-columns">
            <div className="param-row readonly">
              <div className="param-label">
                <span>Phrase</span>
                <InfoTip
                  label="Phrase"
                  text="Whether this track already has recorded audio in the RC0 phrase data. WAV files live under WAVE/ and are not edited here."
                />
              </div>
              <div className="param-control">
                <span className="param-val">{recorded ? "Recorded" : "Empty"}</span>
              </div>
            </div>

            {TRACK_PARAMS.map((def) => (
              <ParamControl
                key={def.tag}
                id={`tr-${trackNo}-${def.tag}`}
                def={def}
                value={num(track, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({ type: "track", track: trackNo, tags: { [def.tag]: String(v) } })
                }
              />
            ))}
          </div>

          <h3 className="section-title">Input</h3>
          <div className="param-columns">
            {TRACK_INPUT_BITS.map((inp) => (
              <ParamControl
                key={inp.bit}
                id={`tr-${trackNo}-in-${inp.bit}`}
                def={{
                  tag: "Q",
                  name: inp.name,
                  kind: "bool",
                  info: inp.info,
                }}
                value={bitOn(inputMask, inp.bit) ? 1 : 0}
                onChange={(v) =>
                  onPatch({
                    type: "track",
                    track: trackNo,
                    tags: { Q: String(setBit(inputMask, inp.bit, Boolean(v))) },
                  })
                }
              />
            ))}
          </div>

          <div className="copy-panel track-copy-panel">
            <h3 className="section-title">Copy Track {trackNo} settings</h3>
            <p className="hint">
              Copies editable track settings to other tracks in this memory (not Phrase / WAV). Save
              memory when you are ready to write.
            </p>

            <div className="track-copy-targets">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <label key={n}>
                  <input
                    type="checkbox"
                    checked={sameTracks.has(n)}
                    disabled={n === trackNo}
                    onChange={(e) => {
                      const next = new Set(sameTracks);
                      if (e.target.checked) next.add(n);
                      else next.delete(n);
                      setSameTracks(next);
                    }}
                  />
                  Track {n}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn primary"
              disabled={sameTracks.size === 0}
              onClick={copyToSelectedTracks}
            >
              Copy to selected tracks
            </button>
          </div>
        </>
      ) : null}

      {sub === "rec" ? (
        <>
          <div className="param-columns">
            {REC_PARAMS.map((def) => (
              <ParamControl
                key={def.tag}
                id={`rec-${def.tag}`}
                def={def}
                value={num(model.rec, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({ type: "section", section: "REC", tags: { [def.tag]: String(v) } })
                }
              />
            ))}
          </div>
          <h3 className="section-title">Bounce Track</h3>
          <div className="param-columns">
            {REC_BOUNCE_TRACK_BITS.map((inp) => {
              const mask = num(model.rec, "F", 0);
              return (
                <ParamControl
                  key={inp.bit}
                  id={`rec-bounce-${inp.bit}`}
                  def={{
                    tag: "F",
                    name: inp.name,
                    kind: "bool",
                    info: inp.info,
                  }}
                  value={bitOn(mask, inp.bit) ? 1 : 0}
                  onChange={(v) =>
                    onPatch({
                      type: "section",
                      section: "REC",
                      tags: { F: String(setBit(mask, inp.bit, Boolean(v))) },
                    })
                  }
                />
              );
            })}
          </div>
        </>
      ) : null}

      {sub === "play" ? (
        <>
          <div className="param-columns">
            {PLAY_PARAMS.map((def) => (
              <ParamControl
                key={def.tag}
                id={`play-${def.tag}`}
                def={def}
                value={num(model.play, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({ type: "section", section: "PLAY", tags: { [def.tag]: String(v) } })
                }
              />
            ))}
          </div>
          <h3 className="section-title">All Start</h3>
          <div className="param-columns">
            {PLAY_ALL_START_BITS.map((inp) => {
              const mask = num(model.play, "D", 0);
              return (
                <ParamControl
                  key={inp.bit}
                  id={`play-start-${inp.bit}`}
                  def={{
                    tag: "D",
                    name: inp.name,
                    kind: "bool",
                    info: inp.info,
                  }}
                  value={bitOn(mask, inp.bit) ? 1 : 0}
                  onChange={(v) =>
                    onPatch({
                      type: "section",
                      section: "PLAY",
                      tags: { D: String(setBit(mask, inp.bit, Boolean(v))) },
                    })
                  }
                />
              );
            })}
          </div>
          <h3 className="section-title">All Stop</h3>
          <div className="param-columns">
            {PLAY_ALL_STOP_BITS.map((inp) => {
              const mask = num(model.play, "E", 0);
              return (
                <ParamControl
                  key={inp.bit}
                  id={`play-stop-${inp.bit}`}
                  def={{
                    tag: "E",
                    name: inp.name,
                    kind: "bool",
                    info: inp.info,
                  }}
                  value={bitOn(mask, inp.bit) ? 1 : 0}
                  onChange={(v) =>
                    onPatch({
                      type: "section",
                      section: "PLAY",
                      tags: { E: String(setBit(mask, inp.bit, Boolean(v))) },
                    })
                  }
                />
              );
            })}
          </div>
        </>
      ) : null}

      {sub === "rhythm" ? <RhythmEditor tags={model.rhythm} onPatch={onPatch} /> : null}
    </div>
  );
}

function RhythmEditor({ tags, onPatch }: { tags: TagMap; onPatch: PatchHandler }) {
  const genre = num(tags, "A", 0);
  const groups: { title: string; tags: string[] }[] = [
    { title: "Pattern", tags: ["A", "B", "C", "D", "E"] },
    { title: "Trigger", tags: ["F", "G"] },
    { title: "Intro / Fill", tags: ["H", "I", "J", "K", "L"] },
  ];

  const patch = (partial: Record<string, string>) =>
    onPatch({ type: "section", section: "RHYTHM", tags: partial });

  return (
    <>
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="section-title">{group.title}</h3>
          <div className="param-columns">
            {group.tags.map((tag) => {
              const def = RHYTHM_PARAMS.find((p) => p.tag === tag);
              if (!def) return null;
              const resolved =
                tag === "B" ? { ...def, options: rhythmPatternOptions(genre) } : def;
              return (
                <ParamControl
                  key={tag}
                  id={`rhy-${tag}`}
                  def={resolved}
                  value={num(tags, tag, def.default ?? 0)}
                  onChange={(v) => {
                    if (tag === "A") {
                      const names = rhythmPatternOptions(v);
                      const cur = num(tags, "B", 0);
                      const next: Record<string, string> = { A: String(v) };
                      if (cur >= names.length) next.B = "0";
                      patch(next);
                      return;
                    }
                    patch({ [tag]: String(v) });
                  }}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
