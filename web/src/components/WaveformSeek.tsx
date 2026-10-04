import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export const WAVEFORM_BARS = 64;

/** Normalized (0–1) peak per bar, max across channels. */
export function computePeaks(buffer: AudioBuffer, bars = WAVEFORM_BARS): number[] {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c),
  );
  const len = buffer.length;
  const bucket = Math.max(1, Math.floor(len / bars));
  const stride = Math.max(1, Math.floor(bucket / 2000));
  const peaks: number[] = [];
  for (let b = 0; b < bars; b++) {
    const start = b * bucket;
    const end = Math.min(len, start + bucket);
    let max = 0;
    for (const data of channels) {
      for (let i = start; i < end; i += stride) {
        const v = Math.abs(data[i] ?? 0);
        if (v > max) max = v;
      }
    }
    peaks.push(max);
  }
  const top = Math.max(...peaks, 1e-6);
  return peaks.map((p) => Math.sqrt(p / top));
}

/** Stand-in shape until the WAV is decoded; deterministic per seed. */
function placeholderPeaks(seed: number, bars = WAVEFORM_BARS): number[] {
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: bars }, (_, i) => {
    const envelope = 0.55 + 0.35 * Math.sin((i / bars) * Math.PI * 3 + seed);
    return Math.min(1, envelope * (0.45 + rand() * 0.55));
  });
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function WaveformSeek({
  label,
  seed,
  peaks,
  position,
  duration,
  hasAudio,
  disabled,
  onSeek,
}: {
  label: string;
  seed: number;
  peaks: number[] | null;
  position: number;
  duration: number;
  hasAudio: boolean;
  disabled: boolean;
  onSeek: (seconds: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragPos, setDragPos] = useState<number | null>(null);

  const bars = peaks ?? (hasAudio ? placeholderPeaks(seed) : null);
  const shown = dragPos ?? position;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;
  const interactive = hasAudio && !disabled && duration > 0;

  function secondsAt(clientX: number): number {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return x * duration;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragPos(secondsAt(e.clientX));
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragPos == null) return;
    setDragPos(secondsAt(e.clientX));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragPos == null) return;
    const sec = secondsAt(e.clientX);
    setDragPos(null);
    onSeek(sec);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    const step = e.shiftKey ? 5 : 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = position + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = position - step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = duration;
    if (next == null) return;
    e.preventDefault();
    onSeek(Math.min(duration, Math.max(0, next)));
  }

  return (
    <div className="waveform-seek">
      <div
        ref={ref}
        className={[
          "waveform",
          peaks ? "is-real" : hasAudio ? "is-placeholder" : "is-empty",
          interactive ? "is-interactive" : "",
          dragPos != null ? "is-dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration * 10) / 10}
        aria-valuenow={Math.round(shown * 10) / 10}
        aria-valuetext={`${formatClock(shown)} of ${formatClock(duration)}`}
        aria-disabled={!interactive}
        tabIndex={interactive ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragPos(null)}
        onKeyDown={onKeyDown}
      >
        {bars ? (
          bars.map((h, i) => (
            <span
              key={i}
              className={(i + 0.5) / bars.length <= ratio ? "bar played" : "bar"}
              style={{ height: `${Math.max(8, h * 100)}%` }}
            />
          ))
        ) : (
          <span className="waveform-flat" />
        )}
        {interactive ? (
          <span className="waveform-head" style={{ left: `${ratio * 100}%` }} />
        ) : null}
      </div>
      <div className="audio-seek-readout">
        <span>{formatClock(shown)}</span>
        <span>{hasAudio ? formatClock(duration) : "—"}</span>
      </div>
    </div>
  );
}
