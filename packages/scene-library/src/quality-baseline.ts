import {
  sameSceneSourceMapping,
  validateSceneSetRevision,
  type SceneSetRevision,
  type SceneSourceMapping,
} from '../../contracts/src/scene-set.contract.js';

export const SCENE_BOUNDARY_QUALITY_BASELINE_SCHEMA_VERSION = '1.0' as const;

export interface SceneBoundaryQualityBenchmark {
  schemaVersion: typeof SCENE_BOUNDARY_QUALITY_BASELINE_SCHEMA_VERSION;
  benchmarkId: string;
  benchmarkVersion: string;
  source: SceneSourceMapping;
  tolerancePts: number;
  expectedBoundaryPts: number[];
}

export interface SceneBoundaryMatch {
  expectedPts: number;
  actualPts: number;
  deltaPts: number;
}

export interface SceneBoundaryQualityReport {
  schemaVersion: typeof SCENE_BOUNDARY_QUALITY_BASELINE_SCHEMA_VERSION;
  benchmarkId: string;
  benchmarkVersion: string;
  sceneSetRevisionId: string;
  detectorVersion: string;
  tolerancePts: number;
  expectedBoundaryCount: number;
  actualBoundaryCount: number;
  matchedBoundaryCount: number;
  precision: number;
  recall: number;
  f1: number;
  matches: SceneBoundaryMatch[];
}

export class SceneBoundaryQualityBaselineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneBoundaryQualityBaselineError';
  }
}

function assertStrictlyIncreasingSafeIntegers(values: number[], field: string): void {
  let previous: number | undefined;
  for (const [index, value] of values.entries()) {
    if (!Number.isSafeInteger(value)) {
      throw new SceneBoundaryQualityBaselineError(`${field}[${index}] must be a safe integer`);
    }
    if (previous !== undefined && value <= previous) {
      throw new SceneBoundaryQualityBaselineError(`${field} must be strictly increasing`);
    }
    previous = value;
  }
}

function validateBenchmark(benchmark: SceneBoundaryQualityBenchmark): void {
  if (benchmark.schemaVersion !== SCENE_BOUNDARY_QUALITY_BASELINE_SCHEMA_VERSION) {
    throw new SceneBoundaryQualityBaselineError('unsupported scene-boundary quality baseline schemaVersion');
  }
  if (!benchmark.benchmarkId.trim()) {
    throw new SceneBoundaryQualityBaselineError('benchmarkId is required');
  }
  if (!benchmark.benchmarkVersion.trim()) {
    throw new SceneBoundaryQualityBaselineError('benchmarkVersion is required');
  }
  if (!Number.isSafeInteger(benchmark.tolerancePts) || benchmark.tolerancePts < 0) {
    throw new SceneBoundaryQualityBaselineError('tolerancePts must be a non-negative safe integer');
  }
  assertStrictlyIncreasingSafeIntegers(benchmark.expectedBoundaryPts, 'expectedBoundaryPts');
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return numerator === 0 ? 1 : 0;
  return numerator / denominator;
}

/**
 * Deterministically measures scene-boundary quality against a versioned labeled
 * benchmark. Source timing remains native integer PTS + rational stream time
 * base; no seconds/milliseconds are introduced as evaluation authority.
 */
export function evaluateSceneBoundaryQuality(
  sceneSet: SceneSetRevision,
  benchmark: SceneBoundaryQualityBenchmark,
): SceneBoundaryQualityReport {
  const validation = validateSceneSetRevision(sceneSet);
  if (!validation.valid) {
    throw new SceneBoundaryQualityBaselineError(`invalid scene-set revision: ${validation.errors.join('; ')}`);
  }
  validateBenchmark(benchmark);

  if (!sameSceneSourceMapping(sceneSet.source, benchmark.source)) {
    throw new SceneBoundaryQualityBaselineError('benchmark source mapping does not match scene-set source mapping');
  }

  const actualBoundaryPts = sceneSet.scenes.slice(1).map((scene) => scene.sourceStartPts);
  assertStrictlyIncreasingSafeIntegers(actualBoundaryPts, 'actualBoundaryPts');

  const matches: SceneBoundaryMatch[] = [];
  let expectedIndex = 0;
  let actualIndex = 0;

  while (expectedIndex < benchmark.expectedBoundaryPts.length && actualIndex < actualBoundaryPts.length) {
    const expectedPts = benchmark.expectedBoundaryPts[expectedIndex];
    const actualPts = actualBoundaryPts[actualIndex];
    if (expectedPts === undefined || actualPts === undefined) break;

    const deltaPts = actualPts - expectedPts;
    if (Math.abs(deltaPts) <= benchmark.tolerancePts) {
      matches.push({ expectedPts, actualPts, deltaPts });
      expectedIndex += 1;
      actualIndex += 1;
      continue;
    }

    if (actualPts < expectedPts) actualIndex += 1;
    else expectedIndex += 1;
  }

  const precision = ratio(matches.length, actualBoundaryPts.length);
  const recall = ratio(matches.length, benchmark.expectedBoundaryPts.length);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    schemaVersion: SCENE_BOUNDARY_QUALITY_BASELINE_SCHEMA_VERSION,
    benchmarkId: benchmark.benchmarkId,
    benchmarkVersion: benchmark.benchmarkVersion,
    sceneSetRevisionId: sceneSet.revisionId,
    detectorVersion: sceneSet.detectorVersion,
    tolerancePts: benchmark.tolerancePts,
    expectedBoundaryCount: benchmark.expectedBoundaryPts.length,
    actualBoundaryCount: actualBoundaryPts.length,
    matchedBoundaryCount: matches.length,
    precision,
    recall,
    f1,
    matches,
  };
}
