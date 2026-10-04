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
  /** Optional live state shown next to the transport (polled while playing). */
  status?(): { text: string; active: boolean } | null;
  /** Optional Effect switch: true / false, or "auto" for the demo cycle. */
  setEffect?(mode: "auto" | boolean): void;
}

type EffectMode = "auto" | "on" | "off";

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
  effectSwitch,
}: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: S;
  createEngine: (cfg: S & { bpm: number }) => FxPreviewEngine<S & { bpm: number }>;
  label: string;
  icon: IconName;
  info: { label: string; text: string };
  /** Shows an Effect ON/OFF switch (and Auto demo) for engines that support it. */
  effectSwitch?: boolean;
}) {
  const [effectMode, setEffectMode] = useState<EffectMode>("off");
  const effectValue = (m: EffectMode) => (m === "auto" ? "auto" : m === "on");
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

  useEffect(() => {
    engineRef.current?.setEffect?.(effectValue(effectMode));
  }, [effectMode]);

  const [status, setStatus] = useState<{ text: string; active: boolean } | null>(null);
  useEffect(() => {
    const engine = engineRef.current;
    if (!playing || !engine?.status) {
      setStatus(null);
      return;
    }
    const id = setInterval(() => setStatus(engine.status?.() ?? null), 100);
    return () => clearInterval(id);
  }, [playing]);

  function togglePlay() {
    if (!engineRef.current) engineRef.current = createEngine(config);
    const engine = engineRef.current;
    if (engine.playing) {
      engine.stop();
      setPlaying(false);
    } else {
      engine.update(config);
      engine.setEffect?.(effectValue(effectMode));
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
        {effectSwitch ? (
          <>
            <button
              type="button"
              className={`btn fx-preview-fx${effectMode === "on" ? " is-on" : ""}`}
              aria-pressed={effectMode === "on"}
              title="Turns the effect on or off, like the FX switch on the pedal. It kicks in on the next beat."
              onClick={() => setEffectMode((m) => (m === "on" ? "off" : "on"))}
            >
              <Icon name="power" size={14} />
              Effect {effectMode === "on" ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              className={`btn fx-preview-fx${effectMode === "auto" ? " is-on" : ""}`}
              aria-pressed={effectMode === "auto"}
              title="Demo: plays the track once clean, then again with the effect on bars 3–4."
              onClick={() => setEffectMode((m) => (m === "auto" ? "off" : "auto"))}
            >
              <Icon name="loop" size={14} />
              Auto
            </button>
          </>
        ) : null}
        {status ? (
          <span className={`fx-preview-status${status.active ? " is-active" : ""}`} role="status">
            <span className="fx-preview-status-dot" aria-hidden />
            {status.text}
          </span>
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
