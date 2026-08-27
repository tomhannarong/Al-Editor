import {
  type TemporalQualityMetricV1,
} from '../../contracts/src/temporal-intelligence-benchmark.contract.js';

export const TEMPORAL_LIGHTWEIGHT_BASELINE_FIXTURE_SCHEMA_VERSION = '1.0' as const;

export interface TemporalBaselineSceneV1 {
  sceneRevisionId: string;
  assetId: string;
  streamIndex: number;
  sourceStartPts: number;
  sourceEndPts: number;
  sourceTimeBase: { numerator: number; denominator: number };
}

export interface TemporalBaselineCaseV1 {
  caseId: string;
  expectedOrderedSceneRevisionIds: readonly string[];
  lightweightRankingSceneRevisionIds: readonly string[];
}

export interface TemporalLightweightBaselineFixtureV1 {
  schemaVersion: typeof TEMPORAL_LIGHTWEIGHT_BASELINE_FIXTURE_SCHEMA_VERSION;
  benchmarkId: string;
  benchmarkRevisionId: string;
  fixtureRevisionId: string;
  approachId: string;
  approachRevisionId: string;
  scenes: readonly TemporalBaselineSceneV1[];
  cases: readonly TemporalBaselineCaseV1[];
}

export interface TemporalLightweightBaselineValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TemporalLightweightBaselineEvaluationV1 {
  benchmarkId: string;
  benchmarkRevisionId: string;
  fixtureRevisionId: string;
  approachId: string;
  approachRevisionId: string;
  quality: readonly TemporalQualityMetricV1[];
  caseCount: number;
  expectedSceneCount: number;
  rankedSceneCount: number;
}

const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};

function validTimeBase(value: TemporalBaselineSceneV1['sourceTimeBase']): boolean {
  return Number.isSafeInteger(value.numerator)
    && Number.isSafeInteger(value.denominator)
    && value.numerator > 0
    && value.denominator > 0;
}

function validateOrderedTemporalTarget(
  expected: readonly TemporalBaselineSceneV1[],
  caseId: string,
  errors: string[],
): void {
  if (expected.length < 2) {
    errors.push(`case ${caseId} must contain at least two ordered temporal target scenes`);
    return;
  }
  const first = expected[0]!;
  for (let index = 1; index < expected.length; index += 1) {
    const previous = expected[index - 1]!;
    const current = expected[index]!;
    if (current.assetId !== first.assetId || current.streamIndex !== first.streamIndex) {
      errors.push(`case ${caseId} expected scenes must share exact asset/stream lineage`);
      break;
    }
    if (current.sourceStartPts < previous.sourceEndPts) {
      errors.push(`case ${caseId} expected scenes must be non-overlapping and source-ordered`);
      break;
    }
  }
}

export function validateTemporalLightweightBaselineFixtureV1(
  fixture: TemporalLightweightBaselineFixtureV1,
): TemporalLightweightBaselineValidationResult {
  const errors: string[] = [];
  if (fixture.schemaVersion !== TEMPORAL_LIGHTWEIGHT_BASELINE_FIXTURE_SCHEMA_VERSION) {
    errors.push('schemaVersion must be 1.0');
  }
  if (!nonEmpty(fixture.benchmarkId)) errors.push('benchmarkId is required');
  if (!pinned(fixture.benchmarkRevisionId)) errors.push('benchmarkRevisionId must be pinned');
  if (!pinned(fixture.fixtureRevisionId)) errors.push('fixtureRevisionId must be pinned');
  if (!nonEmpty(fixture.approachId)) errors.push('approachId is required');
  if (!pinned(fixture.approachRevisionId)) errors.push('approachRevisionId must be pinned');
  if (fixture.scenes.length === 0) errors.push('scenes must not be empty');
  if (fixture.cases.length === 0) errors.push('cases must not be empty');

  const scenes = new Map<string, TemporalBaselineSceneV1>();
  fixture.scenes.forEach((scene, index) => {
    const prefix = `scenes[${index}]`;
    if (!pinned(scene.sceneRevisionId)) errors.push(`${prefix}.sceneRevisionId must be pinned`);
    else if (scenes.has(scene.sceneRevisionId)) errors.push(`${prefix}.sceneRevisionId must be unique`);
    else scenes.set(scene.sceneRevisionId, scene);
    if (!nonEmpty(scene.assetId)) errors.push(`${prefix}.assetId is required`);
    if (!Number.isSafeInteger(scene.streamIndex) || scene.streamIndex < 0) errors.push(`${prefix}.streamIndex must be a non-negative safe integer`);
    if (!Number.isSafeInteger(scene.sourceStartPts) || !Number.isSafeInteger(scene.sourceEndPts) || scene.sourceEndPts <= scene.sourceStartPts) {
      errors.push(`${prefix} must have a safe increasing native PTS range`);
    }
    if (!validTimeBase(scene.sourceTimeBase)) errors.push(`${prefix}.sourceTimeBase must be a positive safe rational`);
  });

  const caseIds = new Set<string>();
  fixture.cases.forEach((entry, index) => {
    const prefix = `cases[${index}]`;
    if (!nonEmpty(entry.caseId)) errors.push(`${prefix}.caseId is required`);
    else if (caseIds.has(entry.caseId)) errors.push(`${prefix}.caseId must be unique`);
    else caseIds.add(entry.caseId);

    const expectedIds = new Set(entry.expectedOrderedSceneRevisionIds);
    if (expectedIds.size !== entry.expectedOrderedSceneRevisionIds.length) errors.push(`${prefix}.expectedOrderedSceneRevisionIds must be unique`);
    const rankingIds = new Set(entry.lightweightRankingSceneRevisionIds);
    if (rankingIds.size !== entry.lightweightRankingSceneRevisionIds.length) errors.push(`${prefix}.lightweightRankingSceneRevisionIds must be unique`);

    const expectedScenes: TemporalBaselineSceneV1[] = [];
    for (const sceneId of entry.expectedOrderedSceneRevisionIds) {
      const scene = scenes.get(sceneId);
      if (!scene) errors.push(`${prefix} references unknown expected scene ${sceneId}`);
      else expectedScenes.push(scene);
    }
    for (const sceneId of entry.lightweightRankingSceneRevisionIds) {
      if (!scenes.has(sceneId)) errors.push(`${prefix} references unknown ranked scene ${sceneId}`);
    }
    if (expectedScenes.length === entry.expectedOrderedSceneRevisionIds.length) {
      validateOrderedTemporalTarget(expectedScenes, entry.caseId, errors);
    }
  });
  return { valid: errors.length === 0, errors };
}

function intervalIou(left: TemporalBaselineSceneV1, right: TemporalBaselineSceneV1): number {
  if (left.assetId !== right.assetId || left.streamIndex !== right.streamIndex) return 0;
  const intersection = Math.max(0, Math.min(left.sourceEndPts, right.sourceEndPts) - Math.max(left.sourceStartPts, right.sourceStartPts));
  if (intersection === 0) return 0;
  const union = Math.max(left.sourceEndPts, right.sourceEndPts) - Math.min(left.sourceStartPts, right.sourceStartPts);
  return intersection / union;
}

function isDuplicateAgainstEarlier(
  scene: TemporalBaselineSceneV1,
  earlier: readonly TemporalBaselineSceneV1[],
): boolean {
  return earlier.some((candidate) => intervalIou(scene, candidate) >= 0.5);
}

function orderedCompletion(expectedIds: readonly string[], topIds: readonly string[]): boolean {
  let previousIndex = -1;
  for (const expectedId of expectedIds) {
    const index = topIds.indexOf(expectedId);
    if (index <= previousIndex) return false;
    previousIndex = index;
  }
  return true;
}

export function evaluateTemporalLightweightBaselineV1(
  fixture: TemporalLightweightBaselineFixtureV1,
): TemporalLightweightBaselineEvaluationV1 {
  const validation = validateTemporalLightweightBaselineFixtureV1(fixture);
  if (!validation.valid) throw new Error(`Invalid temporal lightweight baseline fixture: ${validation.errors.join('; ')}`);

  const scenes = new Map(fixture.scenes.map((scene) => [scene.sceneRevisionId, scene]));
  let expectedSceneCount = 0;
  let recallHits = 0;
  let completedCases = 0;
  let rankedSceneCount = 0;
  let duplicateRankedScenes = 0;

  for (const entry of fixture.cases) {
    const topIds = entry.lightweightRankingSceneRevisionIds.slice(0, 10);
    expectedSceneCount += entry.expectedOrderedSceneRevisionIds.length;
    recallHits += entry.expectedOrderedSceneRevisionIds.filter((sceneId) => topIds.includes(sceneId)).length;
    if (orderedCompletion(entry.expectedOrderedSceneRevisionIds, topIds)) completedCases += 1;

    const earlier: TemporalBaselineSceneV1[] = [];
    for (const sceneId of topIds) {
      const scene = scenes.get(sceneId)!;
      rankedSceneCount += 1;
      if (isDuplicateAgainstEarlier(scene, earlier)) duplicateRankedScenes += 1;
      earlier.push(scene);
    }
  }

  const quality: TemporalQualityMetricV1[] = [
    {
      metricId: 'temporal-recall-at-10',
      direction: 'higher-is-better',
      value: expectedSceneCount === 0 ? 0 : recallHits / expectedSceneCount,
    },
    {
      metricId: 'ordered-sequence-completion-rate',
      direction: 'higher-is-better',
      value: fixture.cases.length === 0 ? 0 : completedCases / fixture.cases.length,
    },
    {
      metricId: 'duplicate-occupancy',
      direction: 'lower-is-better',
      value: rankedSceneCount === 0 ? 0 : duplicateRankedScenes / rankedSceneCount,
    },
  ];

  return Object.freeze({
    benchmarkId: fixture.benchmarkId,
    benchmarkRevisionId: fixture.benchmarkRevisionId,
    fixtureRevisionId: fixture.fixtureRevisionId,
    approachId: fixture.approachId,
    approachRevisionId: fixture.approachRevisionId,
    quality: Object.freeze(quality.map((metric) => Object.freeze({ ...metric }))),
    caseCount: fixture.cases.length,
    expectedSceneCount,
    rankedSceneCount,
  });
}
