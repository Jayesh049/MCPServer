export type LRModel = {
  weights: number[];
  bias: number;
  featureNames: string[];
  featureMeans: number[];
  featureStds: number[];
  trainedAt: string;
  trainingSize: number;
  metrics: {
    trainAccuracy: number;
    holdoutAccuracy: number;
    epochs: number;
    learningRate: number;
  };
};

export type TrainSample = {
  features: number[];
  label: 0 | 1;
};

function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

function meanStd(values: number[]): { mean: number; std: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
  const std = Math.sqrt(variance) || 1;
  return { mean, std };
}

export function standardize(samples: TrainSample[]) {
  const n = samples[0]?.features.length ?? 0;
  const means: number[] = [];
  const stds: number[] = [];
  for (let i = 0; i < n; i++) {
    const col = samples.map((s) => s.features[i] ?? 0);
    const { mean, std } = meanStd(col);
    means.push(mean);
    stds.push(std);
  }
  const standardized = samples.map((s) => ({
    label: s.label,
    features: s.features.map((v, i) => ((v ?? 0) - (means[i] ?? 0)) / (stds[i] ?? 1))
  }));
  return { standardized, means, stds };
}

export function applyStandardization(
  features: number[],
  means: number[],
  stds: number[]
): number[] {
  return features.map((v, i) => ((v ?? 0) - (means[i] ?? 0)) / (stds[i] ?? 1));
}

export function trainLogisticRegression(
  samples: TrainSample[],
  featureNames: string[],
  opts: {
    learningRate?: number;
    epochs?: number;
    holdoutFraction?: number;
    seed?: number;
  } = {}
): LRModel {
  const lr = opts.learningRate ?? 0.05;
  const epochs = opts.epochs ?? 1500;
  const holdoutFraction = opts.holdoutFraction ?? 0.2;
  const seed = opts.seed ?? 17;

  // Deterministic shuffle.
  const rng = mulberry32(seed);
  const shuffled = [...samples].sort(() => rng() - 0.5);
  const split = Math.floor(shuffled.length * (1 - holdoutFraction));
  const train = shuffled.slice(0, split);
  const test = shuffled.slice(split);

  const { standardized: trainStd, means, stds } = standardize(train);
  const testStd = test.map((s) => ({
    label: s.label,
    features: applyStandardization(s.features, means, stds)
  }));

  const nFeatures = featureNames.length;
  const weights = new Array<number>(nFeatures).fill(0);
  let bias = 0;

  for (let e = 0; e < epochs; e++) {
    let dwSum = new Array<number>(nFeatures).fill(0);
    let dbSum = 0;
    for (const sample of trainStd) {
      let z = bias;
      for (let i = 0; i < nFeatures; i++) {
        z += weights[i]! * (sample.features[i] ?? 0);
      }
      const p = sigmoid(z);
      const err = p - sample.label;
      dbSum += err;
      for (let i = 0; i < nFeatures; i++) {
        dwSum[i]! += err * (sample.features[i] ?? 0);
      }
    }
    const m = trainStd.length;
    for (let i = 0; i < nFeatures; i++) {
      weights[i] = (weights[i]! - lr * (dwSum[i]! / m));
    }
    bias = bias - lr * (dbSum / m);
  }

  const accuracy = (data: typeof trainStd) => {
    let correct = 0;
    for (const s of data) {
      let z = bias;
      for (let i = 0; i < nFeatures; i++) z += weights[i]! * (s.features[i] ?? 0);
      const p = sigmoid(z);
      const pred = p >= 0.5 ? 1 : 0;
      if (pred === s.label) correct++;
    }
    return correct / Math.max(1, data.length);
  };

  return {
    weights,
    bias,
    featureNames,
    featureMeans: means,
    featureStds: stds,
    trainedAt: new Date().toISOString(),
    trainingSize: train.length,
    metrics: {
      trainAccuracy: accuracy(trainStd),
      holdoutAccuracy: accuracy(testStd),
      epochs,
      learningRate: lr
    }
  };
}

export function predictWithLR(
  model: LRModel,
  rawFeatures: Record<string, number>
): { probability: number; label: 0 | 1 } {
  const xs = model.featureNames.map((name) => rawFeatures[name] ?? 0);
  const std = applyStandardization(xs, model.featureMeans, model.featureStds);
  let z = model.bias;
  for (let i = 0; i < model.weights.length; i++) {
    z += model.weights[i]! * (std[i] ?? 0);
  }
  const p = sigmoid(z);
  return { probability: p, label: p >= 0.5 ? 1 : 0 };
}

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
