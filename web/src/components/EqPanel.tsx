import type { ParamDef } from "@rc600/catalog/params";
import type { TagMap } from "@rc600/rc0/memory";
import { usePersistedTab } from "../uiTabs";
import { EqFaderBoard, eqDisplay, eqRange } from "./EqFaders";
import { Icon, type IconName } from "./Icon";
import { ScrubCard, TrackStateCard, type TrackStateView } from "./LoopTab";

const EQ_SWITCH_TAG = "A";
/** Low to high, then output level. */
const EQ_CARD_ORDER = ["A", "K", "B", "D", "E", "F", "G", "H", "I", "C", "L", "J"];

const EQ_SWITCH_VIEW: TrackStateView = {
  label: "Switch",
  variant: "eq-switch",
  states: [
    { icon: "equalizer", text: "Off", title: "EQ is bypassed.", color: "var(--muted)", dim: true },
    { icon: "equalizer", text: "On", title: "EQ is applied.", alert: true },
  ],
};

const EQ_VIEWS = ["eq", "cards"] as const;
type EqView = (typeof EQ_VIEWS)[number];
const EQ_VIEW_OPTIONS: { id: EqView; label: string; icon: IconName; title: string }[] = [
  { id: "eq", label: "EQ", icon: "equalizer", title: "Vertical faders, like a graphic EQ." },
  { id: "cards", label: "Cards", icon: "blocks", title: "One card per parameter." },
];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const n = parseInt(tags[tag] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

/** EQ editor with a fader board / card grid toggle. `viewKey` persists the chosen view. */
export function EqPanel({
  idPrefix,
  title,
  viewKey,
  params,
  tags,
  onChange,
}: {
  idPrefix: string;
  title: string;
  viewKey: string;
  params: ParamDef[];
  tags: TagMap;
  onChange: (tag: string, value: number) => void;
}) {
  const [view, setView] = usePersistedTab<EqView>(viewKey, "eq", EQ_VIEWS);

  return (
    <>
      <div className="eq-toolbar">
        <h3 className="section-title">{title}</h3>
        <div className="view-toggle" role="radiogroup" aria-label="EQ view">
          {EQ_VIEW_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={view === o.id}
              className={`view-toggle-btn${view === o.id ? " active" : ""}`}
              title={o.title}
              onClick={() => setView(o.id)}
            >
              <Icon name={o.icon} size={14} />
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {view === "eq" ? (
        <EqFaderBoard
          idPrefix={idPrefix}
          params={params}
          switchTag={EQ_SWITCH_TAG}
          tags={tags}
          onChange={onChange}
        />
      ) : (
        <div className="track-state-cards">
          {EQ_CARD_ORDER.map((tag) => {
            const def = params.find((p) => p.tag === tag);
            if (!def) return null;
            const id = `${idPrefix}-${def.tag}`;
            const value = num(tags, def.tag, def.default ?? 0);
            const set = (v: number) => onChange(def.tag, v);
            if (def.tag === EQ_SWITCH_TAG) {
              return (
                <TrackStateCard key={def.tag} id={id} def={def} view={EQ_SWITCH_VIEW} value={value} onChange={set} />
              );
            }
            return (
              <ScrubCard
                key={def.tag}
                id={id}
                def={def}
                value={value}
                {...eqRange(def)}
                format={(v) => eqDisplay(def, v)}
                alert={value !== (def.default ?? 0)}
                onChange={set}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
