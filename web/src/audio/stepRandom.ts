export type RandomStyle = "any" | "euclidean" | "gate" | "stutter" | "accent" | "chaos";

export const RANDOM_STYLES: { id: RandomStyle; label: string; title: string }[] = [
  { id: "any", label: "Any", title: "Pick one of the styles at random" },
  { id: "euclidean", label: "Euclidean", title: "Hits spread as evenly as possible over the steps" },
  { id: "gate", label: "Gate", title: "On/off chopping that keeps the beat steps" },
  { id: "stutter", label: "Stutter", title: "Short repeated bursts followed by a long slice" },
  { id: "accent", label: "Accent", title: "Every step plays; the beats are louder" },
  { id: "chaos", label: "Chaos", title: "Fully random level and length" },
];

export interface RandomPattern {
  style: Exclude<RandomStyle, "any">;
  level: number[];
  length: number[];
}

type Rng = () => number;

const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const chance = (rng: Rng, p: number) => rng() < p;

/** Euclidean rhythm (Bjorklund / Toussaint): `pulses` hits spread evenly over `steps`, rotated. */
export function euclid(pulses: number, steps: number, rotation = 0): boolean[] {
  if (steps <= 0) return [];
  const k = Math.max(0, Math.min(steps, pulses));
  return Array.from({ length: steps }, (_, i) => {
    const j = (((i + rotation) % steps) + steps) % steps;
    return (j * k) % steps < k;
  });
}

function isBeat(i: number, steps: number) {
  return steps >= 8 ? i % 4 === 0 : i === 0;
}

function euclidean(n: number, rng: Rng) {
  const hits = euclid(int(rng, Math.max(1, Math.ceil(n / 4)), Math.max(1, n - 2)), n, int(rng, 0, n - 1));
  const short = chance(rng, 0.5);
  let first = true;
  const level = hits.map((on) => {
    if (!on) return 0;
    const v = first ? 100 : int(rng, 60, 95);
    first = false;
    return v;
  });
  const length = hits.map(() => (short ? int(rng, 15, 40) : int(rng, 65, 100)));
  return { level, length };
}

function gate(n: number, rng: Rng) {
  const density = 0.45 + rng() * 0.35;
  const level = Array.from({ length: n }, (_, i) => (isBeat(i, n) || chance(rng, density) ? 100 : 0));
  const base = int(rng, 30, 70);
  const length = level.map(() => Math.max(5, Math.min(100, base + int(rng, -10, 10))));
  return { level, length };
}

function stutter(n: number, rng: Rng) {
  const level: number[] = [];
  const length: number[] = [];
  while (level.length < n) {
    const burst = int(rng, 2, 4);
    for (let b = 0; b < burst && level.length < n; b++) {
      level.push(Math.max(30, 100 - b * int(rng, 10, 25)));
      length.push(int(rng, 10, 30));
    }
    if (level.length < n) {
      level.push(chance(rng, 0.3) ? 0 : 100);
      length.push(int(rng, 80, 100));
    }
  }
  return { level, length };
}

function accent(n: number, rng: Rng) {
  const level = Array.from({ length: n }, (_, i) =>
    isBeat(i, n) ? 100 : i % 2 === 0 ? int(rng, 55, 80) : int(rng, 25, 55),
  );
  const length = level.map((_, i) => (isBeat(i, n) ? int(rng, 70, 100) : int(rng, 30, 80)));
  return { level, length };
}

function chaos(n: number, rng: Rng) {
  const level = Array.from({ length: n }, () => (chance(rng, 0.25) ? 0 : int(rng, 30, 100)));
  const length = Array.from({ length: n }, () => int(rng, 10, 100));
  return { level, length };
}

const GENERATORS = { euclidean, gate, stutter, accent, chaos };
const STYLE_IDS = Object.keys(GENERATORS) as RandomPattern["style"][];

/** Random Level and Length for the first `steps` steps (values 0–100). */
export function randomPattern(steps: number, style: RandomStyle = "any", rng: Rng = Math.random): RandomPattern {
  const picked = style === "any" ? STYLE_IDS[int(rng, 0, STYLE_IDS.length - 1)]! : style;
  const n = Math.max(1, Math.round(steps));
  const { level, length } = GENERATORS[picked](n, rng);
  if (!level.some((v) => v > 0)) level[0] = 100;
  return { style: picked, level: level.slice(0, n), length: length.slice(0, n) };
}
