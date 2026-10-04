import type { CSSProperties } from "react";
import { SCATTER_PATTERNS } from "../audio/beatFxPreview";

/** Beat Scatter pattern: which original slice plays in each of the 8 slots, and which play backwards. */
export function ScatterPattern({ pattern, lengthLabel }: { pattern: number; lengthLabel: string }) {
  const p = SCATTER_PATTERNS[Math.max(0, Math.min(SCATTER_PATTERNS.length - 1, pattern))]!;
  const off = lengthLabel === "THRU";
  return (
    <figure className={`scatter-pattern${off ? " is-off" : ""}`} aria-label={`Pattern P${pattern + 1}`}>
      <div className="scatter-row" aria-hidden>
        <span className="scatter-row-label">Track</span>
        {p.order.map((_, i) => (
          <span key={i} className="scatter-cell is-source" style={{ "--slice": i } as CSSProperties}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="scatter-row">
        <span className="scatter-row-label">P{pattern + 1}</span>
        {p.order.map((slice, i) => {
          const reverse = p.reverse.includes(i);
          return (
            <span
              key={i}
              className={`scatter-cell${reverse ? " is-reverse" : ""}${slice !== i ? " is-moved" : ""}`}
              style={{ "--slice": slice } as CSSProperties}
              title={`Slot ${i + 1}: plays slice ${slice + 1}${reverse ? " in reverse" : ""}`}
            >
              {slice + 1}
              <span className="scatter-dir" aria-hidden>
                {reverse ? "◀" : "▶"}
              </span>
            </span>
          );
        })}
      </div>
      <figcaption>
        {off
          ? "Length is THRU: the track plays unchanged"
          : `Each slice is ${lengthLabel.replace("MEAS", " meas.")} long · ◀ = played in reverse`}
      </figcaption>
    </figure>
  );
}
