import { useEffect, useState } from "react";
import { PHRASE_STEPS, phraseNotes, riffStepEvents, scaleMidi } from "../audio/autoRiffPreview";

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Mini piano roll of an Auto Riff phrase: one column per step, one row per scale step. */
export function PhraseRoll({ phrase, keyIndex }: { phrase: number; keyIndex: number }) {
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const onStep = (e: Event) => setCurrent((e as CustomEvent<number | null>).detail);
    riffStepEvents.addEventListener("step", onStep);
    return () => riffStepEvents.removeEventListener("step", onStep);
  }, []);

  const notes = phraseNotes(phrase);
  const degrees = notes.map((n) => n.degree);
  const low = Math.min(0, ...degrees);
  const high = Math.max(7, ...degrees);
  const rows = high - low + 1;
  const name = (degree: number) => NOTE_NAMES[scaleMidi(keyIndex, 0, degree) % 12]!;
  const summary = notes.map((n) => name(n.degree)).join(" ");

  return (
    <div className="phrase-roll" role="img" aria-label={`Phrase ${phrase + 1} notes from the key root: ${summary}`}>
      <svg viewBox={`0 0 ${PHRASE_STEPS * 10} ${rows * 6}`} preserveAspectRatio="none">
        {Array.from({ length: PHRASE_STEPS }, (_, i) => (
          <rect
            key={`col-${i}`}
            className={`phrase-roll-col${i % 4 === 0 ? " is-beat" : ""}${i === current ? " is-current" : ""}`}
            x={i * 10}
            y={0}
            width={10}
            height={rows * 6}
          />
        ))}
        {[0, 7].map((d) =>
          d >= low && d <= high ? (
            <line
              key={`root-${d}`}
              className="phrase-roll-root"
              x1={0}
              x2={PHRASE_STEPS * 10}
              y1={(high - d) * 6 + 3}
              y2={(high - d) * 6 + 3}
            />
          ) : null,
        )}
        {notes.map((n) => (
          <rect
            key={n.start}
            className={`phrase-roll-note${current !== null && current >= n.start && current < n.start + n.length ? " is-on" : ""}`}
            x={n.start * 10 + 1}
            y={(high - n.degree) * 6 + 0.5}
            width={n.length * 10 - 2}
            height={5}
            rx={1.5}
          >
            <title>{name(n.degree)}</title>
          </rect>
        ))}
      </svg>
      <div className="phrase-roll-scale" aria-hidden="true">
        <span>{notes.length} notes</span>
        <span>{summary}</span>
      </div>
    </div>
  );
}
