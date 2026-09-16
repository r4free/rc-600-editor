const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

export interface DetectedNote {
  name: (typeof NOTE_NAMES)[number];
  octave: number;
  cents: number;
  hz: number;
  midi: number;
}

export interface PitchOptions {
  minFrequency?: number;
  maxFrequency?: number;
  threshold?: number;
  minRms?: number;
}

export function signalRms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/**
 * Detect the fundamental frequency with YIN's cumulative mean normalized
 * difference function. Returns null for silence or an uncertain period.
 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  options: PitchOptions = {},
): number | null {
  const minFrequency = options.minFrequency ?? 55;
  const maxFrequency = options.maxFrequency ?? 1_200;
  const threshold = options.threshold ?? 0.12;
  const minRms = options.minRms ?? 0.01;

  if (
    samples.length < 4 ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    signalRms(samples) < minRms
  ) {
    return null;
  }

  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxTau = Math.min(
    Math.floor(sampleRate / minFrequency),
    Math.floor(samples.length / 2),
  );
  if (maxTau <= minTau) return null;

  const difference = new Float64Array(maxTau + 1);
  const windowSize = samples.length - maxTau;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    for (let i = 0; i < windowSize; i += 1) {
      const delta = samples[i] - samples[i + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }

  const normalized = new Float64Array(maxTau + 1);
  normalized[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += difference[tau];
    normalized[tau] = runningSum === 0 ? 1 : (difference[tau] * tau) / runningSum;
  }

  let tau = minTau;
  while (tau <= maxTau) {
    if (normalized[tau] < threshold) {
      while (tau + 1 <= maxTau && normalized[tau + 1] < normalized[tau]) tau += 1;
      break;
    }
    tau += 1;
  }
  if (tau > maxTau) return null;

  const left = tau > 1 ? normalized[tau - 1] : normalized[tau];
  const center = normalized[tau];
  const right = tau < maxTau ? normalized[tau + 1] : normalized[tau];
  const denominator = 2 * (2 * center - right - left);
  const refinedTau =
    denominator === 0 ? tau : tau + (right - left) / denominator;
  const frequency = sampleRate / refinedTau;

  return Number.isFinite(frequency) &&
    frequency >= minFrequency &&
    frequency <= maxFrequency
    ? frequency
    : null;
}

export function frequencyToNote(frequency: number, a4 = 440): DetectedNote | null {
  if (
    !Number.isFinite(frequency) ||
    frequency <= 0 ||
    !Number.isFinite(a4) ||
    a4 <= 0
  ) {
    return null;
  }

  const exactMidi = 69 + 12 * Math.log2(frequency / a4);
  const midi = Math.round(exactMidi);
  const noteIndex = ((midi % 12) + 12) % 12;

  return {
    name: NOTE_NAMES[noteIndex],
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((exactMidi - midi) * 100),
    hz: frequency,
    midi,
  };
}
