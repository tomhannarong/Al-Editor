import {
  sameBaselineSceneRetrievalScope,
  validateBaselineSceneRetrievalQuery,
  type BaselineSceneRetrievalQuery,
  type BaselineSceneRetrievalScope,
} from '../../contracts/src/baseline-scene-retrieval-query.contract.js';
import {
  validateIndexedSceneDocument,
  type IndexedSceneDocument,
} from '../../contracts/src/indexed-scene-document.contract.js';
import { computeIndexedSceneVectorSha256 } from './qdrant.js';

export const LABELED_RECALL_AT_10_BENCHMARK_SCHEMA_VERSION = '1.0' as const;
export const BASELINE_RECALL_CUTOFF = 10 as const;

export interface BaselineIndexedSceneCandidate {
  document: IndexedSceneDocument;
  vector: number[];
}

export interface LabeledRecallAt10Case {
  query: BaselineSceneRetrievalQuery;
  queryVector: number[];
  relevantDocumentRevisionIds: string[];
}

export interface LabeledRecallAt10Benchmark {
  schemaVersion: typeof LABELED_RECALL_AT_10_BENCHMARK_SCHEMA_VERSION;
  benchmarkId: string;
  revisionId: string;
  embeddingModelId: string;
  embeddingModelVersion: string;
  embeddingDimensions: number;
  indexedScenes: BaselineIndexedSceneCandidate[];
  cases: LabeledRecallAt10Case[];
  createdAt: string;
}

export interface LabeledRecallAt10CaseResult {
  queryId: string;
  relevantCount: number;
  retrievedRelevantCount: number;
  recallAt10: number;
  retrievedDocumentRevisionIds: string[];
}

export interface LabeledRecallAt10BenchmarkResult {
  benchmarkId: string;
  revisionId: string;
  cutoff: typeof BASELINE_RECALL_CUTOFF;
  caseResults: LabeledRecallAt10CaseResult[];
  macroRecallAt10: number;
  microRecallAt10: number;
  totalRelevant: number;
  totalRelevantRetrieved: number;
}

export class LabeledRecallAt10InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LabeledRecallAt10InvariantError';
  }
}

/**
 * Deterministic Phase-4 baseline evaluator. It performs only single-vector
 * cosine retrieval inside exact query scopes. Hybrid signals, reranking and
 * editorial judgment intentionally remain outside this baseline.
 */
export function evaluateLabeledRecallAt10Benchmark(
  benchmark: LabeledRecallAt10Benchmark,
): LabeledRecallAt10BenchmarkResult {
  validateBenchmarkHeader(benchmark);

  const documentsByRevision = new Map<string, BaselineIndexedSceneCandidate>();
  for (const candidate of benchmark.indexedScenes) {
    validateCandidate(benchmark, candidate);
    if (documentsByRevision.has(candidate.document.revisionId)) {
      throw new LabeledRecallAt10InvariantError(
        `duplicate indexed-scene revisionId ${candidate.document.revisionId}`,
      );
    }
    documentsByRevision.set(candidate.document.revisionId, cloneCandidate(candidate));
  }

  const seenQueryIds = new Set<string>();
  const caseResults = benchmark.cases.map((benchmarkCase) => {
    const validation = validateBaselineSceneRetrievalQuery(benchmarkCase.query);
    if (!validation.valid) {
      throw new LabeledRecallAt10InvariantError(
        `invalid query ${benchmarkCase.query.queryId}: ${validation.errors.join('; ')}`,
      );
    }
    if (benchmarkCase.query.topK !== BASELINE_RECALL_CUTOFF) {
      throw new LabeledRecallAt10InvariantError(
        `Recall@10 benchmark requires query.topK = ${BASELINE_RECALL_CUTOFF}`,
      );
    }
    if (seenQueryIds.has(benchmarkCase.query.queryId)) {
      throw new LabeledRecallAt10InvariantError(`duplicate queryId ${benchmarkCase.query.queryId}`);
    }
    seenQueryIds.add(benchmarkCase.query.queryId);

    validateVector(
      benchmarkCase.queryVector,
      benchmark.embeddingDimensions,
      `query ${benchmarkCase.query.queryId}`,
    );

    const eligible = benchmark.indexedScenes.filter((candidate) =>
      benchmarkCase.query.scopes.some((scope) => candidateMatchesScope(candidate, scope)));
    if (eligible.length < BASELINE_RECALL_CUTOFF) {
      throw new LabeledRecallAt10InvariantError(
        `query ${benchmarkCase.query.queryId} has only ${eligible.length} eligible indexed scenes; Recall@10 requires at least 10`,
      );
    }

    const relevantIds = new Set<string>();
    for (const revisionId of benchmarkCase.relevantDocumentRevisionIds) {
      if (!revisionId.trim()) {
        throw new LabeledRecallAt10InvariantError(
          `query ${benchmarkCase.query.queryId} contains an empty relevance label`,
        );
      }
      if (relevantIds.has(revisionId)) {
        throw new LabeledRecallAt10InvariantError(
          `query ${benchmarkCase.query.queryId} contains duplicate relevance label ${revisionId}`,
        );
      }
      const candidate = documentsByRevision.get(revisionId);
      if (!candidate || !eligible.some((entry) => entry.document.revisionId === revisionId)) {
        throw new LabeledRecallAt10InvariantError(
          `query ${benchmarkCase.query.queryId} relevance label ${revisionId} is not an indexed scene in the exact query scope`,
        );
      }
      relevantIds.add(revisionId);
    }
    if (relevantIds.size === 0) {
      throw new LabeledRecallAt10InvariantError(
        `query ${benchmarkCase.query.queryId} requires at least one relevant indexed scene`,
      );
    }

    const ranked = eligible
      .map((candidate) => ({
        revisionId: candidate.document.revisionId,
        score: cosineSimilarity(benchmarkCase.queryVector, candidate.vector),
      }))
      .sort((left, right) => right.score - left.score || left.revisionId.localeCompare(right.revisionId))
      .slice(0, BASELINE_RECALL_CUTOFF);

    const retrievedDocumentRevisionIds = ranked.map((entry) => entry.revisionId);
    const retrievedRelevantCount = retrievedDocumentRevisionIds
      .filter((revisionId) => relevantIds.has(revisionId)).length;

    return {
      queryId: benchmarkCase.query.queryId,
      relevantCount: relevantIds.size,
      retrievedRelevantCount,
      recallAt10: retrievedRelevantCount / relevantIds.size,
      retrievedDocumentRevisionIds,
    };
  });

  const totalRelevant = caseResults.reduce((sum, result) => sum + result.relevantCount, 0);
  const totalRelevantRetrieved = caseResults
    .reduce((sum, result) => sum + result.retrievedRelevantCount, 0);
  const macroRecallAt10 = caseResults
    .reduce((sum, result) => sum + result.recallAt10, 0) / caseResults.length;

  return {
    benchmarkId: benchmark.benchmarkId,
    revisionId: benchmark.revisionId,
    cutoff: BASELINE_RECALL_CUTOFF,
    caseResults,
    macroRecallAt10,
    microRecallAt10: totalRelevantRetrieved / totalRelevant,
    totalRelevant,
    totalRelevantRetrieved,
  };
}

function validateBenchmarkHeader(benchmark: LabeledRecallAt10Benchmark): void {
  if (benchmark.schemaVersion !== LABELED_RECALL_AT_10_BENCHMARK_SCHEMA_VERSION) {
    throw new LabeledRecallAt10InvariantError('unsupported labeled Recall@10 benchmark schemaVersion');
  }
  if (!benchmark.benchmarkId.trim()) throw new LabeledRecallAt10InvariantError('benchmarkId is required');
  if (!benchmark.revisionId.trim()) throw new LabeledRecallAt10InvariantError('revisionId is required');
  if (!benchmark.embeddingModelId.trim()) {
    throw new LabeledRecallAt10InvariantError('embeddingModelId is required');
  }
  if (!benchmark.embeddingModelVersion.trim()) {
    throw new LabeledRecallAt10InvariantError('embeddingModelVersion is required');
  }
  if (!Number.isSafeInteger(benchmark.embeddingDimensions) || benchmark.embeddingDimensions < 1) {
    throw new LabeledRecallAt10InvariantError('embeddingDimensions must be a positive safe integer');
  }
  if (benchmark.indexedScenes.length < BASELINE_RECALL_CUTOFF) {
    throw new LabeledRecallAt10InvariantError('benchmark requires at least 10 indexed scenes');
  }
  if (benchmark.cases.length === 0) {
    throw new LabeledRecallAt10InvariantError('benchmark requires at least one labeled query case');
  }
  if (Number.isNaN(Date.parse(benchmark.createdAt))) {
    throw new LabeledRecallAt10InvariantError('createdAt must be an ISO-compatible timestamp');
  }
}

function validateCandidate(
  benchmark: LabeledRecallAt10Benchmark,
  candidate: BaselineIndexedSceneCandidate,
): void {
  const validation = validateIndexedSceneDocument(candidate.document);
  if (!validation.valid) {
    throw new LabeledRecallAt10InvariantError(
      `invalid indexed scene ${candidate.document.revisionId}: ${validation.errors.join('; ')}`,
    );
  }
  if (candidate.document.embedding.modelId !== benchmark.embeddingModelId
    || candidate.document.embedding.modelVersion !== benchmark.embeddingModelVersion
    || candidate.document.embedding.dimensions !== benchmark.embeddingDimensions) {
    throw new LabeledRecallAt10InvariantError(
      `indexed scene ${candidate.document.revisionId} embedding evidence does not match benchmark revision`,
    );
  }
  validateVector(candidate.vector, benchmark.embeddingDimensions, candidate.document.revisionId);
  const digest = computeIndexedSceneVectorSha256(candidate.vector);
  if (digest !== candidate.document.embedding.vectorSha256) {
    throw new LabeledRecallAt10InvariantError(
      `indexed scene ${candidate.document.revisionId} vector does not match immutable vectorSha256 evidence`,
    );
  }
}

function candidateMatchesScope(
  candidate: BaselineIndexedSceneCandidate,
  scope: BaselineSceneRetrievalScope,
): boolean {
  const source = candidate.document.source;
  return sameBaselineSceneRetrievalScope(scope, {
    sceneSetId: source.sceneSetId,
    sceneSetRevisionId: source.sceneSetRevisionId,
    assetId: source.assetId,
    streamId: source.streamId,
    streamIndex: source.streamIndex,
    sourceTimeBase: source.sourceTimeBase,
  });
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;
    dot += leftValue * rightValue;
    leftSquares += leftValue * leftValue;
    rightSquares += rightValue * rightValue;
  }
  if (leftSquares === 0 || rightSquares === 0) {
    throw new LabeledRecallAt10InvariantError('cosine vectors must have non-zero magnitude');
  }
  return dot / (Math.sqrt(leftSquares) * Math.sqrt(rightSquares));
}

function validateVector(vector: readonly number[], dimensions: number, label: string): void {
  if (vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
    throw new LabeledRecallAt10InvariantError(
      `${label} vector must contain exactly ${dimensions} finite numeric values`,
    );
  }
  if (vector.every((value) => value === 0)) {
    throw new LabeledRecallAt10InvariantError(`${label} vector must have non-zero magnitude`);
  }
}

function cloneCandidate(candidate: BaselineIndexedSceneCandidate): BaselineIndexedSceneCandidate {
  return {
    document: {
      ...candidate.document,
      source: {
        ...candidate.document.source,
        sourceTimeBase: { ...candidate.document.source.sourceTimeBase },
      },
      embedding: { ...candidate.document.embedding },
    },
    vector: [...candidate.vector],
  };
}
