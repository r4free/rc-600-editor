import { freezeSustainLevel, freezeTimeSec } from "../audio/freezePreview";

const W = 320;
const H = 90;
const TOP = 10;
const BOTTOM = H - 18;
const HOLD = 70;

const seg = (v: number) => 14 + (Math.max(0, Math.min(100, v)) / 100) * 56;
const secLabel = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`);

/** Freeze envelope drawn from Attack, Decay, Sustain and Release; the shaded span is while the switch is on. */
export function FreezeEnvelope({
  attack,
  decay,
  sustain,
  release,
}: {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}) {
  const level = freezeSustainLevel(sustain);
  const yS = BOTTOM - (BOTTOM - TOP) * level;
  const x0 = 8;
  const xA = x0 + seg(attack);
  const xD = xA + seg(decay);
  const xS = xD + HOLD;
  const xR = Math.min(W - 8, xS + seg(release));
  const path = `M${x0},${BOTTOM} L${xA},${TOP} L${xD},${yS} L${xS},${yS} L${xR},${BOTTOM}`;
  const labels = [
    { x: (x0 + xA) / 2, text: "A" },
    { x: (xA + xD) / 2, text: "D" },
    { x: (xD + xS) / 2, text: "S" },
    { x: (xS + xR) / 2, text: "R" },
  ];
  return (
    <figure className="freeze-env">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Freeze envelope">
        <rect className="freeze-env-on" x={x0} y={TOP - 4} width={xS - x0} height={BOTTOM - TOP + 4} />
        <line className="freeze-env-base" x1={4} x2={W - 4} y1={BOTTOM} y2={BOTTOM} />
        <path className="freeze-env-fill" d={`${path} Z`} />
        <path className="freeze-env-line" d={path} />
        <line className="freeze-env-mark" x1={xS} x2={xS} y1={TOP - 4} y2={BOTTOM} />
        {labels.map((l) => (
          <text key={l.text} className="freeze-env-label" x={l.x} y={H - 4} textAnchor="middle">
            {l.text}
          </text>
        ))}
      </svg>
      <figcaption>
        Switch on → fade in {secLabel(freezeTimeSec(attack))}, settle to {Math.round(level * 100)}% · Switch off →
        fade out {secLabel(freezeTimeSec(release))}
      </figcaption>
    </figure>
  );
}
