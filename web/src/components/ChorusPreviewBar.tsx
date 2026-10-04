import { useEffect, useMemo, useRef, useState } from "react";
import { ChorusPreviewEngine, type ChorusPreviewConfig } from "../audio/chorusPreview";
import { addTap, tapTempoBpm } from "../audio/tapTempo";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";

const MIN_BPM = 40;
const MAX_BPM = 240;

export function ChorusPreviewBar({
  slot,
  initialBpm,
  memoryBpm,
  settings,
}: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<ChorusPreviewConfig, "bpm">;
}) {
  const [bpm, setBpm] = useState(() => Math.round(initialBpm));
  const [playing, setPlaying] = useState(false);
  const engineRef = useRef<ChorusPreviewEngine | null>(null);
  const tapsRef = useRef<number[]>([]);
  const { rateIndex, depth, loCutHz, hiCutHz, dryLevel, wetLevel } = settings;
  const config = useMemo(
    () => ({ bpm, rateIndex, depth, loCutHz, hiCutHz, dryLevel, wetLevel }),
    [bpm, rateIndex, depth, loCutHz, hiCutHz, dryLevel, wetLevel],
  );

  useEffect(() => {
    engineRef.current?.update(config);
  }, [config]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  function togglePlay() {
    if (!engineRef.current) engineRef.current = new ChorusPreviewEngine(config);
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
          <Icon name="strings" size={14} />
          Guitar chords
          <InfoTip
            label="Chorus preview"
            text="Strummed guitar chords (G – Em – C – D) played through this chorus with the settings below. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact chorus."
          />
        </span>
      </div>
    </section>
  );
}
