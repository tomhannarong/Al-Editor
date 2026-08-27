import {
  TEMPORAL_INTELLIGENCE_BENCHMARK_SCHEMA_VERSION,
  temporalQualityImprovedV1,
  validateTemporalIntelligenceBenchmarkComparisonV1,
  type TemporalApproachMeasurementV1,
  type TemporalIntelligenceBenchmarkComparisonV1,
  type TemporalQualityMetricV1,
} from '../../contracts/src/temporal-intelligence-benchmark.contract.js';
import {
  evaluateTemporalLightweightBaselineV1,
  validateTemporalLightweightBaselineFixtureV1,
  type TemporalBaselineSceneV1,
  type TemporalLightweightBaselineFixtureV1,
} from './lightweight-baseline.js';
import {
  measureTemporalLightweightBaselineRuntimeCostV1,
  temporalLightweightBaselineApproachMeasurementV1,
  TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION,
  type TemporalLightweightRuntimeCostOptionsV1,
  type TemporalMonotonicClockV1,
} from './runtime-cost.js';

export const TEMPORAL_ADJACENCY_CANDIDATE_APPROACH_ID = 'temporal-adjacency-overlap-candidate' as const;
export const TEMPORAL_ADJACENCY_CANDIDATE_REVISION_ID = 'temporal-adjacency-overlap-candidate:r1' as const;
export const TEMPORAL_ADJACENCY_CANDIDATE_PROTOCOL_VERSION = 'temporal-adjacency-overlap-candidate:v1' as const;

export interface TemporalAdjacencyCandidateEvaluationV1 {
  approachId: typeof TEMPORAL_ADJACENCY_CANDIDATE_APPROACH_ID;
  approachRevisionId: typeof TEMPORAL_ADJACENCY_CANDIDATE_REVISION_ID;
  quality: readonly TemporalQualityMetricV1[];
  rankedSceneCount: number;
  rankingsByCase: Readonly<Record<string, readonly string[]>>;
}

export interface TemporalAdjacencyCandidateRuntimeMeasurementV1 {
  protocolVersion: typeof TEMPORAL_ADJACENCY_CANDIDATE_PROTOCOL_VERSION;
  approach: TemporalApproachMeasurementV1;
  sampleWallClockMsPerEvaluation: readonly number[];
  totalMeasuredWallClockMs: number;
  computeUnitDefinition: typeof TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION;
}

export interface TemporalCandidateComparisonRunV1 {
  comparison: TemporalIntelligenceBenchmarkComparisonV1;
  baselineSamplesMsPerEvaluation: readonly number[];
  candidateSamplesMsPerEvaluation: readonly number[];
  baselineComputeUnitDefinition: typeof TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION;
  candidateComputeUnitDefinition: typeof TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION;
}

const MAX_RESULTS = 10;

function intervalIou(left: TemporalBaselineSceneV1, right: TemporalBaselineSceneV1): number {
  if (left.assetId !== right.assetId || left.streamIndex !== right.streamIndex) return 0;
  const intersection = Math.max(
    0,
    Math.min(left.sourceEndPts, right.sourceEndPts) - Math.max(left.sourceStartPts, right.sourceStartPts),
  );
  if (intersection === 0) return 0;
  const union = Math.max(left.sourceEndPts, right.sourceEndPts) - Math.min(left.sourceStartPts, right.sourceStartPts);
  return intersection / union;
}

function buildSuccessorIndex(scenes: readonly TemporalBaselineSceneV1[]): ReadonlyMap<string, string> {
  const successor = new Map<string, string>();
  for (const scene of scenes) {
    const next = scenes
      .filter((candidate) => candidate.sceneRevisionId !== scene.sceneRevisionId)
      .filter((candidate) => candidate.assetId === scene.assetId && candidate.streamIndex === scene.streamIndex)
      .filter((candidate) => candidate.sourceStartPts >= scene.sourceEndPts)
      .sort((left, right) => (
        left.sourceStartPts - right.sourceStartPts
        || left.sourceEndPts - right.sourceEndPts
        || left.sceneRevisionId.localeCompare(right.sceneRevisionId)
      ))[0];
    if (next) successor.set(scene.sceneRevisionId, next.sceneRevisionId);
  }
  return successor;
}

function buildCandidateRankings(
  fixture: TemporalLightweightBaselineFixtureV1,
): Readonly<Record<string, readonly string[]>> {
  const scenes = new Map(fixture.scenes.map((scene) => [scene.sceneRevisionId, scene]));
  const successor = buildSuccessorIndex(fixture.scenes);
  const rankings: Record<string, readonly string[]> = {};

  for (const entry of fixture.cases) {
    const selected: TemporalBaselineSceneV1[] = [];
    const selectedIds = new Set<string>();

    const consider = (sceneId: string): boolean => {
      if (selectedIds.has(sceneId) || selected.length >= MAX_RESULTS) return false;
      const scene = scenes.get(sceneId);
      if (!scene) throw new Error(`Candidate ranking references unknown scene ${sceneId}`);
      if (selected.some((earlier) => intervalIou(scene, earlier) >= 0.5)) return false;
      selected.push(scene);
      selectedIds.add(sceneId);
      return true;
    };

    for (const sceneId of entry.lightweightRankingSceneRevisionIds) {
      const inserted = consider(sceneId);
      if (inserted && selected.length < MAX_RESULTS) {
        const nextSceneId = successor.get(sceneId);
        if (nextSceneId) consider(nextSceneId);
      }
      if (selected.length >= MAX_RESULTS) break;
    }
    rankings[entry.caseId] = Object.freeze(selected.map((scene) => scene.sceneRevisionId));
  }

  return Object.freeze(rankings);
}

function candidateFixture(
  fixture: TemporalLightweightBaselineFixtureV1,
  rankingsByCase: Readonly<Record<string, readonly string[]>>,
): TemporalLightweightBaselineFixtureV1 {
  return Object.freeze({
    ...fixture,
    approachId: TEMPORAL_ADJACENCY_CANDIDATE_APPROACH_ID,
    approachRevisionId: TEMPORAL_ADJACENCY_CANDIDATE_REVISION_ID,
    cases: Object.freeze(fixture.cases.map((entry) => Object.freeze({
      ...entry,
      lightweightRankingSceneRevisionIds: rankingsByCase[entry.caseId] ?? Object.freeze([]),
    }))),
  });
}

export function evaluateTemporalAdjacencyCandidateV1(
  fixture: TemporalLightweightBaselineFixtureV1,
): TemporalAdjacencyCandidateEvaluationV1 {
  const validation = validateTemporalLightweightBaselineFixtureV1(fixture);
  if (!validation.valid) throw new Error(`Invalid temporal fixture: ${validation.errors.join('; ')}`);

  const rankingsByCase = buildCandidateRankings(fixture);
  const evaluation = evaluateTemporalLightweightBaselineV1(candidateFixture(fixture, rankingsByCase));
  return Object.freeze({
    approachId: TEMPORAL_ADJACENCY_CANDIDATE_APPROACH_ID,
    approachRevisionId: TEMPORAL_ADJACENCY_CANDIDATE_REVISION_ID,
    quality: Object.freeze(evaluation.quality.map((metric) => Object.freeze({ ...metric }))),
    rankedSceneCount: evaluation.rankedSceneCount,
    rankingsByCase,
  });
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function validateMeasurementOptions(options: TemporalLightweightRuntimeCostOptionsV1): void {
  if (!Number.isSafeInteger(options.warmupIterations) || options.warmupIterations < 0 || options.warmupIterations > 100_000) {
    throw new Error('Invalid candidate runtime warmupIterations');
  }
  if (!Number.isSafeInteger(options.measuredIterationsPerSample) || options.measuredIterationsPerSample < 1 || options.measuredIterationsPerSample > 100_000) {
    throw new Error('Invalid candidate runtime measuredIterationsPerSample');
  }
  if (!Number.isSafeInteger(options.sampleCount) || options.sampleCount < 1 || options.sampleCount > 101 || options.sampleCount % 2 === 0) {
    throw new Error('Invalid candidate runtime sampleCount');
  }
}

export function measureTemporalAdjacencyCandidateRuntimeV1(
  fixture: TemporalLightweightBaselineFixtureV1,
  options: TemporalLightweightRuntimeCostOptionsV1,
  nowNs: TemporalMonotonicClockV1 = process.hrtime.bigint,
): TemporalAdjacencyCandidateRuntimeMeasurementV1 {
  validateMeasurementOptions(options);
  const reference = evaluateTemporalAdjacencyCandidateV1(fixture);
  for (let iteration = 0; iteration < options.warmupIterations; iteration += 1) evaluateTemporalAdjacencyCandidateV1(fixture);

  const samples: number[] = [];
  let totalMeasuredWallClockMs = 0;
  for (let sampleIndex = 0; sampleIndex < options.sampleCount; sampleIndex += 1) {
    const startedNs = nowNs();
    for (let iteration = 0; iteration < options.measuredIterationsPerSample; iteration += 1) {
      const current = evaluateTemporalAdjacencyCandidateV1(fixture);
      if (JSON.stringify(current.quality) !== JSON.stringify(reference.quality)) {
        throw new Error('Temporal candidate quality changed during runtime measurement');
      }
    }
    const completedNs = nowNs();
    if (completedNs <= startedNs) throw new Error('Monotonic runtime clock must advance for every candidate sample');
    const sampleTotalMs = Number(completedNs - startedNs) / 1_000_000;
    if (!Number.isFinite(sampleTotalMs) || sampleTotalMs <= 0) throw new Error('Candidate wall-clock duration must be finite and positive');
    totalMeasuredWallClockMs += sampleTotalMs;
    samples.push(sampleTotalMs / options.measuredIterationsPerSample);
  }

  return Object.freeze({
    protocolVersion: TEMPORAL_ADJACENCY_CANDIDATE_PROTOCOL_VERSION,
    approach: {
      approach: {
        approachId: reference.approachId,
        revisionId: reference.approachRevisionId,
        policyRevisionId: TEMPORAL_ADJACENCY_CANDIDATE_REVISION_ID,
      },
      quality: reference.quality.map((metric) => ({ ...metric })),
      cost: {
        wallClockMs: median(samples),
        computeUnits: reference.rankedSceneCount,
      },
    },
    sampleWallClockMsPerEvaluation: Object.freeze(samples),
    totalMeasuredWallClockMs,
    computeUnitDefinition: TEMPORAL_LIGHTWEIGHT_COMPUTE_UNIT_DEFINITION,
  });
}

export function runTemporalCandidateComparisonV1(
  fixture: TemporalLightweightBaselineFixtureV1,
  options: TemporalLightweightRuntimeCostOptionsV1,
  measuredAt: string,
  nowNs: TemporalMonotonicClockV1 = process.hrtime.bigint,
): TemporalCandidateComparisonRunV1 {
  const baselineRuntime = measureTemporalLightweightBaselineRuntimeCostV1(fixture, options, nowNs);
  const candidateRuntime = measureTemporalAdjacencyCandidateRuntimeV1(fixture, options, nowNs);
  const comparison: TemporalIntelligenceBenchmarkComparisonV1 = {
    schemaVersion: TEMPORAL_INTELLIGENCE_BENCHMARK_SCHEMA_VERSION,
    comparisonId: 'temporal-comparison:phase11:adjacency-r1',
    revisionId: 'temporal-comparison:phase11:adjacency-r1',
    fixture: {
      benchmarkId: fixture.benchmarkId,
      benchmarkRevisionId: fixture.benchmarkRevisionId,
      fixtureRevisionId: fixture.fixtureRevisionId,
    },
    lightweightBaseline: temporalLightweightBaselineApproachMeasurementV1(baselineRuntime),
    candidate: candidateRuntime.approach,
    measuredAt,
  };
  const validation = validateTemporalIntelligenceBenchmarkComparisonV1(comparison);
  if (!validation.valid) throw new Error(`Invalid temporal candidate comparison: ${validation.errors.join('; ')}`);

  return Object.freeze({
    comparison: Object.freeze(comparison),
    baselineSamplesMsPerEvaluation: baselineRuntime.sampleWallClockMsPerEvaluation,
    candidateSamplesMsPerEvaluation: candidateRuntime.sampleWallClockMsPerEvaluation,
    baselineComputeUnitDefinition: baselineRuntime.computeUnitDefinition,
    candidateComputeUnitDefinition: candidateRuntime.computeUnitDefinition,
  });
}

export function temporalCandidateWinsEveryQualityMetricV1(
  comparison: TemporalIntelligenceBenchmarkComparisonV1,
): boolean {
  const candidateById = new Map(comparison.candidate.quality.map((metric) => [metric.metricId, metric]));
  return comparison.lightweightBaseline.quality.every((baselineMetric) => {
    const candidateMetric = candidateById.get(baselineMetric.metricId);
    return candidateMetric !== undefined && temporalQualityImprovedV1(baselineMetric, candidateMetric);
  });
}
