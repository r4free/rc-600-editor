import { TRACK_PARAMS, displayParam, type ParamDef } from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { EqFader } from "./EqFaders";
import type { PatchHandler } from "./LoopTab";
import { TrackRouteToggles } from "./TrackRouteToggles";

const TRACK_NOS = [1, 2, 3, 4, 5, 6] as const;

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function trackMixerDisplay(def: ParamDef, value: number): { value: string; unit?: string } {
  return { value: displayParam(def, value) };
}

const levelDef = TRACK_PARAMS.find((p) => p.tag === "D");
const panDef = TRACK_PARAMS.find((p) => p.tag === "C");

/** Side-by-side Level + Pan faders for all six tracks. */
export function TrackMixerBoard({
  model,
  onPatch,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
}) {
  if (!levelDef || !panDef) return null;

  return (
    <div className="track-mixer-board" role="group" aria-label="Track mixer">
      {TRACK_NOS.map((n) => {
        const tags = model.tracks[n - 1] ?? {};
        return (
          <section key={n} className="track-mixer-strip">
            <h4 className="track-mixer-title">Track {n}</h4>
            <div className="track-mixer-faders">
              <EqFader
                id={`tr-mix-${n}-D`}
                def={levelDef}
                short="Level"
                value={num(tags, "D", levelDef.default ?? 100)}
                onChange={(v) =>
                  onPatch({ type: "track", track: n, tags: { D: String(v) } })
                }
                display={trackMixerDisplay}
              />
              <EqFader
                id={`tr-mix-${n}-C`}
                def={panDef}
                short="Pan"
                value={num(tags, "C", panDef.default ?? 50)}
                onChange={(v) =>
                  onPatch({ type: "track", track: n, tags: { C: String(v) } })
                }
                display={trackMixerDisplay}
              />
            </div>
            <TrackRouteToggles trackNo={n} model={model} onPatch={onPatch} />
          </section>
        );
      })}
    </div>
  );
}
