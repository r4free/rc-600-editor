import { useEffect, useRef, useState } from "react";
import { addTap, tapTempoBpm } from "../audio/tapTempo";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";

const MIN_BPM = 40;
const MAX_BPM = 240;

export interface FxPreviewEngine<C> {
  readonly playing: boolean;
  update(cfg: C): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

/** Play/Stop, BPM, Tap and Memory tempo for a browser effect preview. */
export function FxPreviewBar<S>({
  slot,
  initialBpm,
  memoryBpm,
  settings,
  createEngine,
  label,
  icon,
  info,
}: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: S;
  createEngine: (cfg: S & { bpm: number }) => FxPreviewEngine<S & { bpm: number }>;
  label: string;
  icon: IconName;
  info: { label: string; text: string };
}) {
  const [bpm, setBpm] = useState(() => Math.round(initialBpm));
  const [playing, setPlaying] = useState(false);
  const engineRef = useRef<FxPreviewEngine<S & { bpm: number }> | null>(null);
  const tapsRef = useRef<number[]>([]);
  const settingsKey = JSON.stringify(settings);
  const config = { ...settings, bpm };

  useEffect(() => {
    engineRef.current?.update(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey, bpm]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  function togglePlay() {
    if (!engineRef.current) engineRef.current = createEngine(config);
    const engine = engineRef.current;
    if (engine.playing) {
      engine.stop();
      setPlaying(false);
    } else {
      engine.update(config);
      engine.start();
      setPlaying(true);
    }
  }

  function tap() {
    tapsRef.current = addTap(tapsRef.current, performance.now());
    const next = tapTempoBpm(tapsRef.current, MIN_BPM, MAX_BPM);
    if (next !== null) setBpm(next);
  }

  return (
    <section className="step-seq fx-preview" data-fx-slot={slot} aria-label="Effect preview">
      <div className="step-seq-transport">
        <button
          type="button"
          className={`btn step-seq-play${playing ? " is-on" : ""}`}
          onClick={togglePlay}
          aria-pressed={playing}
        >
          <Icon name={playing ? "stop" : "play"} size={14} />
          {playing ? "Stop" : "Play"}
        </button>
        <label className="step-seq-field">
          <span>BPM</span>
          <input
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v))));
            }}
          />
        </label>
        <button
          type="button"
          className="btn step-seq-bpm-tap"
          title="Tap at least twice in time to set the preview BPM"
          onClick={tap}
        >
          <Icon name="tempo" size={14} />
          Tap
        </button>
        {memoryBpm ? (
          <button
            type="button"
            className="btn"
            title="Use the tempo saved in this memory"
            disabled={bpm === Math.round(memoryBpm)}
            onClick={() => setBpm(Math.round(memoryBpm))}
          >
            <Icon name="restore" size={14} />
            Memory {memoryBpm}
          </button>
        ) : null}
        <span className="fx-preview-label">
          <Icon name={icon} size={14} />
          {label}
          <InfoTip label={info.label} text={info.text} />
        </span>
      </div>
    </section>
  );
}
