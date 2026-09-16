import { useEffect, useRef, useState } from "react";
import type { SetlistTempoGuide } from "../presets/playlist";
import { timelinePositionAt } from "../setlists/chordTimeline";
import { Icon } from "./Icon";

export function SongTempoTransport({
  guide,
  onCurrentChord,
  onActiveLine,
  onBpmChange,
}: {
  guide: SetlistTempoGuide;
  onCurrentChord: (chord: string | null) => void;
  onActiveLine?: (line: number | null) => void;
  onBpmChange?: (bpm: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef(0);
  const elapsedAtStartRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const tapsRef = useRef<number[]>([]);

  const countInSeconds =
    guide.countInBars * guide.beatsPerBar * 60 / guide.bpm;
  const musicalElapsed = elapsed - countInSeconds;
  const position = timelinePositionAt(
    guide.timeline,
    musicalElapsed,
    guide.bpm,
    guide.beatsPerBar,
  );

  useEffect(() => {
    onCurrentChord(musicalElapsed < 0 ? null : position.chord);
  }, [musicalElapsed, onCurrentChord, position.chord]);

  useEffect(() => {
    onActiveLine?.(musicalElapsed < 0 ? null : position.line);
  }, [musicalElapsed, onActiveLine, position.index, position.line]);

  useEffect(() => {
    if (!running) return;
    const tick = (now: number) => {
      const next = elapsedAtStartRef.current + (now - startedAtRef.current) / 1_000;
      setElapsed(next);
      if (timelinePositionAt(guide.timeline, next - countInSeconds, guide.bpm, guide.beatsPerBar).done) {
        setRunning(false);
        return;
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [countInSeconds, guide.beatsPerBar, guide.bpm, guide.timeline, running]);

  useEffect(() => () => {
    onCurrentChord(null);
    onActiveLine?.(null);
  }, [onActiveLine, onCurrentChord]);

  const toggle = () => {
    if (running) {
      setRunning(false);
      return;
    }
    startedAtRef.current = performance.now();
    elapsedAtStartRef.current = elapsed;
    setRunning(true);
  };

  const restart = () => {
    setRunning(false);
    setElapsed(0);
    onCurrentChord(null);
  };

  const tapTempo = () => {
    const now = performance.now();
    tapsRef.current = [...tapsRef.current.filter((tap) => now - tap <= 3_000), now].slice(-5);
    if (tapsRef.current.length < 2) return;
    const intervals = tapsRef.current.slice(1).map((tap, index) => tap - tapsRef.current[index]!);
    const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    onBpmChange?.(Math.max(20, Math.min(300, Math.round(60_000 / average))));
  };

  const countInBeat = musicalElapsed < 0
    ? Math.floor((elapsed * guide.bpm / 60) % guide.beatsPerBar) + 1
    : null;
  const barsRemaining = position.beatsRemainingInChord / guide.beatsPerBar;
  const durationLabel = barsRemaining >= 1
    ? `${Number(barsRemaining.toFixed(1))} ${barsRemaining === 1 ? "bar" : "bars"} left`
    : `${Math.max(1, Math.ceil(position.beatsRemainingInChord))} beats left`;
  const nextChord = guide.timeline[position.index + 1]?.chord ?? null;

  return (
    <section className="song-tempo-transport" aria-label="Original tempo chord guide">
      <div className="song-current-chord">
        <span>{countInBeat ? "Count in" : position.section || "Current chord"}</span>
        <strong>{countInBeat ?? position.chord ?? "—"}</strong>
        {!countInBeat && position.chord ? <small>{durationLabel}</small> : null}
      </div>
      <div className="song-tempo-position">
        <span>{guide.bpm} BPM · {guide.beatsPerBar}/{guide.beatUnit}</span>
        <strong>
          {musicalElapsed < 0
            ? `${Math.ceil(-musicalElapsed)}s to start`
            : `Bar ${position.bar} · Beat ${Math.floor(position.beatInBar) + 1}${
                nextChord ? ` · Next ${nextChord}` : ""
              }`}
        </strong>
      </div>
      <div
        className="song-tempo-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position.progress * 100)}
      >
        <i style={{ width: `${position.progress * 100}%` }} />
      </div>
      <div className="song-tempo-actions">
        <button type="button" className={`btn ${running ? "warn" : "primary"}`} onClick={toggle}>
          <Icon name={running ? "pause" : "play"} />
          {running ? "Pause" : elapsed ? "Continue" : "Start"}
        </button>
        <button type="button" className="btn ghost" onClick={restart}>Restart</button>
        <button type="button" className="btn ghost" onClick={tapTempo} disabled={!onBpmChange}>
          Tap tempo
        </button>
      </div>
    </section>
  );
}
