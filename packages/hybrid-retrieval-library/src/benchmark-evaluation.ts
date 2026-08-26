import type { HybridRetrievalPolicy } from '../../contracts/src/hybrid-retrieval-policy.contract.js';
import type { RetrievalDuplicateControlPolicy } from '../../contracts/src/retrieval-duplicate-control-policy.contract.js';
import type { IndexedSceneSourceLineage } from '../../contracts/src/indexed-scene-document.contract.js';
import {
  BASELINE_RECALL_CUTOFF,
  evaluateLabeledRecallAt10Benchmark,
  type LabeledRecallAt10Benchmark,
  type LabeledRecallAt10BenchmarkResult,
} from '../../indexed-scene-library/src/recall-baseline.js';
import {
  applyRetrievalDuplicateControl,
  type RetrievalDuplicateControlResult,
} from './duplicate-control.js';
import {
  executeHybridRetrieval,
  type HybridRetrievalCandidate,
  type HybridRetrievalQueryRepresentation,
} from './execution.js';

export const HYBRID_RECALL_AT_10_EVALUATION_SCHEMA_VERSION = '1.0' as const;

export interface HybridRecallAt10CaseInput {
  queryId: string;
  queryRepresentations: HybridRetrievalQueryRepresentation[];
}

export interface HybridRecallAt10EvaluationInput {
  schemaVersion: typeof HYBRID_RECALL_AT_10_EVALUATION_SCHEMA_VERSION;
  evaluationId: string;
  revisionId: string;
  benchmark: LabeledRecallAt10Benchmark;
  hybridPolicy: HybridRetrievalPolicy;
  duplicateControlPolicy: RetrievalDuplicateControlPolicy;
  candidates: HybridRetrievalCandidate[];
  cases: HybridRecallAt10CaseInput[];
  createdAt: string;
}

export interface HybridRecallAt10CaseResult {
  queryId: string;
  relevantCount: number;
  retrievedRelevantCount: number;
  recallAt10: number;
  retrievedSceneKeys: string[];
  rawHybridCandidateCount: number;
  controlledResultCount: number;
  suppressedDuplicateCount: number;
  duplicateOccupancyBeforeControl: number;
  duplicateOccupancyAfterControl: 0;
}

export interface HybridRecallAt10EvaluationResult {
  evaluationId: string;
  revisionId: string;
  benchmarkId: string;
  benchmarkRevisionId: string;
  hybridPolicyRevisionId: string;
  duplicateControlPolicyRevisionId: string;
  baseline: LabeledRecallAt10BenchmarkResult;
  caseResults: HybridRecallAt10CaseResult[];
  macroRecallAt10: number;
  microRecallAt10: number;
  macroRecallAt10Gain: number;
  microRecallAt10Gain: number;
  totalRelevant: number;
  totalRelevantRetrieved: number;
  meanDuplicateOccupancyBeforeControl: number;
  meanDuplicateOccupancyAfterControl: 0;
}

export class HybridRecallAt10EvaluationInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HybridRecallAt10EvaluationInvariantError';
  }
}

/**
 * Phase-5 same-benchmark evaluator. The Phase-4 single-vector result remains
 * the immutable control; hybrid fusion and duplicate control execute against
 * the same labeled scene identities. No reranking or editorial scoring occurs
 * in this boundary.
 */
export function evaluateHybridRecallAt10(
  input: HybridRecallAt10EvaluationInput,
): HybridRecallAt10EvaluationResult {
  validateEvaluationHeader(input);
  const baseline = evaluateLabeledRecallAt10Benchmark(input.benchmark);
  const relevantSceneKeysByQuery = buildRelevantSceneKeys(input.benchmark);
  const caseInputByQuery = new Map(input.cases.map((entry) => [entry.queryId, entry]));
  if (caseInputByQuery.size !== input.cases.length) {
    throw new HybridRecallAt10EvaluationInvariantError('evaluation case queryId values must be unique');
  }
  if (caseInputByQuery.size !== input.benchmark.cases.length) {
    throw new HybridRecallAt10EvaluationInvariantError(
      'evaluation must contain exactly one hybrid case for every benchmark query',
    );
  }

  const caseResults = input.benchmark.cases.map((benchmarkCase) => {
    const queryId = benchmarkCase.query.queryId;
    const evaluationCase = caseInputByQuery.get(queryId);
    if (!evaluationCase) {
      throw new HybridRecallAt10EvaluationInvariantError(`missing hybrid case for benchmark query ${queryId}`);
    }

    const rawHybrid = executeHybridRetrieval({
      policy: input.hybridPolicy,
      topK: input.hybridPolicy.candidatePoolSize,
      queryRepresentations: evaluationCase.queryRepresentations,
      candidates: input.candidates,
    });
    const controlled = applyRetrievalDuplicateControl({
      policy: input.duplicateControlPolicy,
      retrieval: rawHybrid,
    });
    const relevantSceneKeys = relevantSceneKeysByQuery.get(queryId)!;
    const retrievedSceneKeys = controlled.items
      .slice(0, BASELINE_RECALL_CUTOFF)
      .map((item) => item.sceneKey);
    const retrievedRelevantCount = retrievedSceneKeys
      .filter((sceneKey) => relevantSceneKeys.has(sceneKey)).length;
    const suppressedDuplicateCount = controlled.suppressed.length;

    return {
      queryId,
      relevantCount: relevantSceneKeys.size,
      retrievedRelevantCount,
      recallAt10: retrievedRelevantCount / relevantSceneKeys.size,
      retrievedSceneKeys,
      rawHybridCandidateCount: rawHybrid.items.length,
      controlledResultCount: controlled.items.length,
      suppressedDuplicateCount,
      duplicateOccupancyBeforeControl: rawHybrid.items.length === 0
        ? 0
        : suppressedDuplicateCount / rawHybrid.items.length,
      duplicateOccupancyAfterControl: 0,
    } satisfies HybridRecallAt10CaseResult;
  });

  const totalRelevant = caseResults.reduce((sum, result) => sum + result.relevantCount, 0);
  const totalRelevantRetrieved = caseResults
    .reduce((sum, result) => sum + result.retrievedRelevantCount, 0);
  const macroRecallAt10 = caseResults
    .reduce((sum, result) => sum + result.recallAt10, 0) / caseResults.length;
  const microRecallAt10 = totalRelevantRetrieved / totalRelevant;
  const meanDuplicateOccupancyBeforeControl = caseResults
    .reduce((sum, result) => sum + result.duplicateOccupancyBeforeControl, 0) / caseResults.length;

  return {
    evaluationId: input.evaluationId,
    revisionId: input.revisionId,
    benchmarkId: input.benchmark.benchmarkId,
    benchmarkRevisionId: input.benchmark.revisionId,
    hybridPolicyRevisionId: input.hybridPolicy.revisionId,
    duplicateControlPolicyRevisionId: input.duplicateControlPolicy.revisionId,
    baseline,
    caseResults,
    macroRecallAt10,
    microRecallAt10,
    macroRecallAt10Gain: macroRecallAt10 - baseline.macroRecallAt10,
    microRecallAt10Gain: microRecallAt10 - baseline.microRecallAt10,
    totalRelevant,
    totalRelevantRetrieved,
    meanDuplicateOccupancyBeforeControl,
    meanDuplicateOccupancyAfterControl: 0,
  };
}

function validateEvaluationHeader(input: HybridRecallAt10EvaluationInput): void {
  if (input.schemaVersion !== HYBRID_RECALL_AT_10_EVALUATION_SCHEMA_VERSION) {
    throw new HybridRecallAt10EvaluationInvariantError('unsupported hybrid Recall@10 evaluation schemaVersion');
  }
  if (!input.evaluationId.trim()) throw new HybridRecallAt10EvaluationInvariantError('evaluationId is required');
  if (!input.revisionId.trim()) throw new HybridRecallAt10EvaluationInvariantError('revisionId is required');
  if (Number.isNaN(Date.parse(input.createdAt))) {
    throw new HybridRecallAt10EvaluationInvariantError('createdAt must be an ISO-compatible timestamp');
  }
  if (
    input.hybridPolicy.benchmarkControl.benchmarkId !== input.benchmark.benchmarkId
    || input.hybridPolicy.benchmarkControl.benchmarkRevisionId !== input.benchmark.revisionId
  ) {
    throw new HybridRecallAt10EvaluationInvariantError(
      'hybrid policy benchmark control does not match exact Phase-4 benchmark revision',
    );
  }
  if (input.hybridPolicy.candidatePoolSize < BASELINE_RECALL_CUTOFF) {
    throw new HybridRecallAt10EvaluationInvariantError(
      `hybrid candidatePoolSize must be at least ${BASELINE_RECALL_CUTOFF} for Recall@10 evaluation`,
    );
  }
  if (input.duplicateControlPolicy.hybridPolicyRevisionId !== input.hybridPolicy.revisionId) {
    throw new HybridRecallAt10EvaluationInvariantError(
      'duplicate-control policy does not bind to exact hybrid policy revision',
    );
  }
  if (input.duplicateControlPolicy.maxResults !== BASELINE_RECALL_CUTOFF) {
    throw new HybridRecallAt10EvaluationInvariantError(
      `duplicate-control maxResults must equal ${BASELINE_RECALL_CUTOFF} for Recall@10 evaluation`,
    );
  }
}

function buildRelevantSceneKeys(
  benchmark: LabeledRecallAt10Benchmark,
): Map<string, Set<string>> {
  const sceneKeyByRevision = new Map(
    benchmark.indexedScenes.map((candidate) => [
      candidate.document.revisionId,
      sourceSceneKey(candidate.document.source),
    ]),
  );
  return new Map(benchmark.cases.map((benchmarkCase) => [
    benchmarkCase.query.queryId,
    new Set(benchmarkCase.relevantDocumentRevisionIds.map((revisionId) => {
      const sceneKey = sceneKeyByRevision.get(revisionId);
      if (!sceneKey) {
        throw new HybridRecallAt10EvaluationInvariantError(
          `relevance label ${revisionId} cannot resolve to benchmark scene identity`,
        );
      }
      return sceneKey;
    })),
  ]));
}

function sourceSceneKey(source: IndexedSceneSourceLineage): string {
  return JSON.stringify([source.sceneSetId, source.sceneSetRevisionId, source.sceneId]);
}

export function countSuppressedDuplicates(result: RetrievalDuplicateControlResult): number {
  return result.suppressed.length;
}
