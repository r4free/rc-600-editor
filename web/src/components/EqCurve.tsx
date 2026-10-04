import { eqResponseDb, type EqPreviewConfig } from "../audio/eqPreview";

const W = 360;
const H = 110;
const PAD_X = 6;
const PAD_Y = 8;
const MIN_HZ = 20;
const MAX_HZ = 20000;
const RANGE_DB = 24;
const POINTS = 120;
const GRID_HZ = [100, 1000, 10000];
const GRID_LABEL: Record<number, string> = { 100: "100", 1000: "1k", 10000: "10k" };

const xOf = (hz: number) => PAD_X + ((Math.log10(hz) - Math.log10(MIN_HZ)) / 3) * (W - 2 * PAD_X);
const yOf = (db: number) => H / 2 - (Math.max(-RANGE_DB, Math.min(RANGE_DB, db)) / RANGE_DB) * (H / 2 - PAD_Y);

/** Frequency response of the input FX EQ (20 Hz – 20 kHz, ±24 dB). */
export function EqCurve({ settings }: { settings: Omit<EqPreviewConfig, "bpm"> }) {
  const points = Array.from({ length: POINTS + 1 }, (_, i) => {
    const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / POINTS);
    return `${xOf(hz).toFixed(1)},${yOf(eqResponseDb(settings, hz)).toFixed(1)}`;
  });
  const line = `M${points.join(" L")}`;
  const fill = `${line} L${xOf(MAX_HZ)},${H / 2} L${xOf(MIN_HZ)},${H / 2} Z`;
  return (
    <figure className="eq-curve">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="EQ frequency response">
        {GRID_HZ.map((hz) => (
          <g key={hz}>
            <line className="eq-curve-grid" x1={xOf(hz)} x2={xOf(hz)} y1={PAD_Y} y2={H - PAD_Y} />
            <text className="eq-curve-label" x={xOf(hz) + 3} y={H - PAD_Y - 2}>
              {GRID_LABEL[hz]}
            </text>
          </g>
        ))}
        <line className="eq-curve-zero" x1={PAD_X} x2={W - PAD_X} y1={H / 2} y2={H / 2} />
        <text className="eq-curve-label" x={PAD_X + 2} y={PAD_Y + 8}>
          +{RANGE_DB} dB
        </text>
        <path className="eq-curve-fill" d={fill} />
        <path className="eq-curve-line" d={line} />
        {[
          { hz: settings.loMidHz, db: settings.loMid },
          { hz: settings.hiMidHz, db: settings.hiMid },
        ].map((b, i) => (
          <circle key={i} className="eq-curve-dot" cx={xOf(b.hz)} cy={yOf(eqResponseDb(settings, b.hz))} r={3.5} />
        ))}
      </svg>
    </figure>
  );
}
