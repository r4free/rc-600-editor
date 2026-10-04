import { useEffect, useMemo, useRef, useState } from "react";
import { ChorusPreviewEngine, type ChorusPreviewConfig } from "../audio/chorusPreview";
import { Icon } from "./Icon";

const MIN_BPM = 40;
const MAX_BPM = 240;

export function ChorusPreviewBar({
  slot,
  initialBpm,
  settings,
}: {
  slot: string;
  initialBpm: number;
  settings: Omit<ChorusPreviewConfig, "bpm">;
}) {
  const [bpm, setBpm] = useState(() => Math.round(initialBpm));
  const [playing, setPlaying] = useState(false);
  const engineRef = useRef<ChorusPreviewEngine | null>(null);
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
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v)) setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, v)));
            }}
          />
        </label>
        <p className="fx-preview-caption">
          Strummed guitar chords (G – Em – C – D) played through this chorus with the settings below. Changes are heard
          while it plays.
        </p>
      </div>
    </section>
  );
}
