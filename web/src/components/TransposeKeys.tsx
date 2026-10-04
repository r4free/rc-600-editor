const INTERVALS = [
  "Unison",
  "Minor 2nd",
  "Major 2nd",
  "Minor 3rd",
  "Major 3rd",
  "Perfect 4th",
  "Tritone",
  "Perfect 5th",
  "Minor 6th",
  "Major 6th",
  "Minor 7th",
  "Major 7th",
  "Octave",
];
const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);

/** "Perfect 5th up", "Minor 3rd down", "No change". */
export function intervalName(semitones: number): string {
  if (semitones === 0) return "No change";
  const name = INTERVALS[Math.min(12, Math.abs(semitones))]!;
  return `${name} ${semitones > 0 ? "up" : "down"}`;
}

/** Note reached from C by `semitones` (−12…+12). */
export function transposedNote(semitones: number): string {
  return NOTE_NAMES[((semitones % 12) + 12) % 12]!;
}

/**
 * Keyboard from MIDI `low` to `high` (both C/B edges): the `origin` note is outlined and the
 * `targets` are lit. Display only.
 */
export function IntervalKeys({
  low,
  high,
  origin,
  targets,
  label,
  caption,
}: {
  low: number;
  high: number;
  origin: number;
  targets: number[];
  label: string;
  caption: string;
}) {
  const keys = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const pc = (m: number) => ((m % 12) + 12) % 12;
  const whites = keys.filter((k) => !BLACK.has(pc(k)));
  const whiteW = 100 / whites.length;
  const xOf = (k: number) => {
    const before = whites.filter((w) => w < k).length;
    return BLACK.has(pc(k)) ? before * whiteW - whiteW * 0.3 : before * whiteW;
  };
  const key = (k: number) => {
    const black = BLACK.has(pc(k));
    return (
      <rect
        key={k}
        className={`transpose-key ${black ? "is-black" : "is-white"}${targets.includes(k) ? " is-target" : ""}${k === origin ? " is-origin" : ""}`}
        x={black ? xOf(k) : xOf(k) + 0.15}
        y={0}
        width={black ? whiteW * 0.6 : whiteW - 0.3}
        height={black ? 18 : 30}
        rx={black ? 0.5 : 0.7}
      >
        <title>{NOTE_NAMES[pc(k)]}</title>
      </rect>
    );
  };
  return (
    <div className="transpose-keys is-display">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label}>
        {whites.map(key)}
        {keys.filter((k) => BLACK.has(pc(k))).map(key)}
      </svg>
      <div className="transpose-keys-scale" aria-hidden="true">
        <span>{caption}</span>
      </div>
    </div>
  );
}

/** Note name of a MIDI pitch (C, Db, …). */
export function noteNameOf(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12]!;
}

/**
 * One-octave keyboard (C–B): the selected note is lit; click a key to pick it. With `lit`, those
 * keys are lit instead (e.g. a scale) and the selected note is outlined.
 */
export function NoteKeys({
  note,
  noteName,
  caption,
  lit,
  onChange,
}: {
  note: number | null;
  noteName: (n: number) => string;
  caption: string;
  lit?: number[];
  onChange: (note: number) => void;
}) {
  const keys = Array.from({ length: 12 }, (_, i) => i);
  const whites = keys.filter((k) => !BLACK.has(k));
  const whiteW = 100 / whites.length;
  const xOf = (k: number) => {
    const before = whites.filter((w) => w < k).length;
    return BLACK.has(k) ? before * whiteW - whiteW * 0.3 : before * whiteW;
  };
  const key = (k: number, black: boolean) => (
    <rect
      key={k}
      className={`transpose-key ${black ? "is-black" : "is-white"}${(lit ? lit.includes(k) : k === note) ? " is-target" : ""}${lit && k === note ? " is-origin" : ""}`}
      x={black ? xOf(k) : xOf(k) + 0.25}
      y={0}
      width={black ? whiteW * 0.6 : whiteW - 0.5}
      height={black ? 18 : 30}
      rx={black ? 0.6 : 0.8}
      onClick={() => onChange(k)}
    >
      <title>{noteName(k)}</title>
    </rect>
  );
  return (
    <div className="transpose-keys">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="group" aria-label="Note keyboard">
        {whites.map((k) => key(k, false))}
        {keys.filter((k) => BLACK.has(k)).map((k) => key(k, true))}
      </svg>
      <div className="transpose-keys-scale" aria-hidden="true">
        <span>C</span>
        <span>{caption}</span>
        <span>B</span>
      </div>
    </div>
  );
}

/**
 * Two-octave keyboard centered on C: the played C is outlined and the transposed note is lit.
 * Click a key to transpose to it.
 */
export function TransposeKeys({
  semitones,
  onChange,
}: {
  semitones: number;
  onChange: (semitones: number) => void;
}) {
  const keys = Array.from({ length: 25 }, (_, i) => i - 12);
  const whites = keys.filter((k) => !BLACK.has(((k % 12) + 12) % 12));
  const whiteW = 100 / whites.length;
  const xOf = (k: number) => {
    const before = whites.filter((w) => w < k).length;
    return BLACK.has(((k % 12) + 12) % 12) ? before * whiteW - whiteW * 0.3 : before * whiteW;
  };
  const keyClass = (k: number) =>
    `transpose-key${k === semitones ? " is-target" : ""}${k === 0 ? " is-origin" : ""}`;
  const title = (k: number) =>
    k === 0 ? "C, the note you play (no change)" : `${transposedNote(k)}: ${intervalName(k)} (${k > 0 ? "+" : ""}${k})`;

  return (
    <div className="transpose-keys">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="group" aria-label="Transpose keyboard">
        {whites.map((k) => (
          <rect
            key={k}
            className={`${keyClass(k)} is-white`}
            x={xOf(k) + 0.15}
            y={0}
            width={whiteW - 0.3}
            height={30}
            rx={0.8}
            onClick={() => onChange(k)}
          >
            <title>{title(k)}</title>
          </rect>
        ))}
        {keys
          .filter((k) => BLACK.has(((k % 12) + 12) % 12))
          .map((k) => (
            <rect
              key={k}
              className={`${keyClass(k)} is-black`}
              x={xOf(k)}
              y={0}
              width={whiteW * 0.6}
              height={18}
              rx={0.6}
              onClick={() => onChange(k)}
            >
              <title>{title(k)}</title>
            </rect>
          ))}
      </svg>
      <div className="transpose-keys-scale" aria-hidden="true">
        <span>−12</span>
        <span>
          C → {transposedNote(semitones)} · {intervalName(semitones)}
        </span>
        <span>+12</span>
      </div>
    </div>
  );
}
