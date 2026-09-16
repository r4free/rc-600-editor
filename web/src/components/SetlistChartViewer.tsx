import { useEffect, useRef, useState } from "react";
import type { SetlistScrollGuide, SetlistSong } from "../presets/playlist";
import { transposeKeyRoot } from "../setlists/chordChart";
import { ChordChartView } from "./ChordChartView";
import { Icon } from "./Icon";

export function SetlistChartViewer({
  setlistName,
  song,
  index,
  count,
  onBack,
  onPrevious,
  onNext,
  onTranspose,
  children,
}: {
  setlistName: string;
  song: SetlistSong & { music: SetlistScrollGuide };
  index: number;
  count: number;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onTranspose: (semitones: number) => void;
  children?: React.ReactNode;
}) {
  const music = song.music;
  const [fontScale, setFontScale] = useState(1);
  const [scrolling, setScrolling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    setScrolling(false);
    setFontScale(1);
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
  }, [song.id]);

  useEffect(() => {
    if (!scrolling || !music.autoScrollSeconds || !scrollRef.current) return;
    const element = scrollRef.current;
    const startTop = element.scrollTop;
    const distance = Math.max(0, element.scrollHeight - element.clientHeight - startTop);
    const startedAt = performance.now();
    const duration = music.autoScrollSeconds * 1_000;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      element.scrollTop = startTop + distance * progress;
      if (progress < 1) animationRef.current = requestAnimationFrame(tick);
      else setScrolling(false);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [music.autoScrollSeconds, scrolling]);

  const liveKey = music.key ? transposeKeyRoot(music.key, music.transpose) : "—";

  return (
    <section className="setlist-chart-stage" aria-label={`${song.name} chord chart`}>
      <header className="setlist-chart-stage-head">
        <button type="button" className="btn ghost" onClick={onBack}>
          <Icon name="back" />
          Songs
        </button>
        <div>
          <span className="playlist-eyebrow">{setlistName} · {index + 1}/{count}</span>
          <h2>{song.name}</h2>
        </div>
        <div className="setlist-chart-meta">
          <strong>{liveKey} {music.mode}</strong>
          <span>{music.transpose ? `${music.transpose > 0 ? "+" : ""}${music.transpose} semitones` : "Original key"}</span>
        </div>
      </header>

      <div className="setlist-chart-toolbar">
        <button type="button" className="btn ghost" onClick={() => onTranspose(music.transpose - 1)} disabled={music.transpose <= -12}>Key −</button>
        <button type="button" className="btn ghost" onClick={() => onTranspose(music.transpose + 1)} disabled={music.transpose >= 12}>Key +</button>
        <button type="button" className="btn ghost" onClick={() => setFontScale((value) => Math.max(0.75, value - 0.1))}>A−</button>
        <button type="button" className="btn ghost" onClick={() => setFontScale((value) => Math.min(1.8, value + 0.1))}>A+</button>
        {music.autoScrollSeconds ? (
          <button type="button" className={`btn ${scrolling ? "warn" : "ghost"}`} onClick={() => setScrolling((value) => !value)}>
            <Icon name={scrolling ? "pause" : "play"} />
            {scrolling ? "Pause scroll" : "Auto-scroll"}
          </button>
        ) : null}
      </div>

      {music.performanceNotes ? (
        <details className="setlist-performance-notes">
          <summary>Performance notes</summary>
          <p>{music.performanceNotes}</p>
        </details>
      ) : null}

      <div className="setlist-chart-scroll" ref={scrollRef}>
        <ChordChartView
          music={music}
          className="setlist-chart-live"
          key={`${song.id}-${music.transpose}`}
        />
      </div>

      {children}

      <footer className="setlist-chart-stage-foot">
        <button type="button" className="btn ghost" onClick={onPrevious}>Previous</button>
        <span style={{ fontSize: `${fontScale}rem` }} aria-hidden="true" className="setlist-font-probe" />
        <button type="button" className="btn primary" onClick={onNext}>Next</button>
      </footer>
      <style>{`.setlist-chart-live { font-size: ${fontScale}rem; }`}</style>
    </section>
  );
}
