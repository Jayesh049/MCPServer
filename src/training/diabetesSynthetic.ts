import type { TrainSample } from "./logisticRegression.js";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number, mean: number, stdDev: number): number {
  // Box-Muller.
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

export const DIABETES_FEATURE_NAMES = [
  "age",
  "bmi",
  "fastingGlucose",
  "a1c",
  "familyHistory"
];

/**
 * Generates a synthetic diabetes risk dataset using a known scoring rule plus noise.
 * No real PHI; not a clinical model. Used purely to demonstrate "self-trained"
 * end-to-end flow for the hackathon.
 */
export function generateDiabetesSynthetic(opts?: {
  size?: number;
  seed?: number;
}): TrainSample[] {
  const size = opts?.size ?? 4000;
  const seed = opts?.seed ?? 42;
  const rng = mulberry32(seed);
  const samples: TrainSample[] = [];

  for (let i = 0; i < size; i++) {
    const age = Math.max(18, Math.min(95, gauss(rng, 50, 14)));
    const bmi = Math.max(15, Math.min(55, gauss(rng, 27, 5)));
    const fastingGlucose = Math.max(60, Math.min(260, gauss(rng, 105, 25)));
    const a1c = Math.max(4.5, Math.min(13, gauss(rng, 6.0, 1.1)));
    const familyHistory = rng() < 0.35 ? 1 : 0;

    // True latent score (the LR is trained to recover/approximate this).
    const z =
      -8 +
      0.025 * age +
      0.07 * bmi +
      0.022 * fastingGlucose +
      1.1 * (a1c - 5.7) +
      0.6 * familyHistory;

    const p = sigmoid(z);
    const label: 0 | 1 = rng() < p ? 1 : 0;

    samples.push({
      features: [age, bmi, fastingGlucose, a1c, familyHistory],
      label
    });
  }
  return samples;
}
