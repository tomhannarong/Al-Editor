import { describe, expect, it } from 'vitest';

import {
  BASELINE_SCENE_RETRIEVAL_QUERY_SCHEMA_VERSION,
  type BaselineSceneRetrievalQuery,
} from '../../contracts/src/baseline-scene-retrieval-query.contract.js';
import {
  HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION,
  type HybridRetrievalPolicy,
} from '../../contracts/src/hybrid-retrieval-policy.contract.js';
import {
  INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
  type IndexedSceneDocument,
} from '../../contracts/src/indexed-scene-document.contract.js';
import {
  RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION,
  type RetrievalDuplicateControlPolicy,
} from '../../contracts/src/retrieval-duplicate-control-policy.contract.js';
import { computeIndexedSceneVectorSha256 } from '../../indexed-scene-library/src/qdrant.js';
import {
  BASELINE_RECALL_CUTOFF,
  LABELED_RECALL_AT_10_BENCHMARK_SCHEMA_VERSION,
  type BaselineIndexedSceneCandidate,
  type LabeledRecallAt10Benchmark,
} from '../../indexed-scene-library/src/recall-baseline.js';
import {
  HYBRID_RECALL_AT_10_EVALUATION_SCHEMA_VERSION,
  HybridRecallAt10EvaluationInvariantError,
  evaluateHybridRecallAt10,
  type HybridRecallAt10EvaluationInput,
} from './benchmark-evaluation.js';
import type {
  HybridRetrievalCandidate,
  HybridRetrievalQueryRepresentation,
} from './execution.js';

const ASSET_ID = `sha256:${'a'.repeat(64)}`;
const STREAM_ID = `${ASSET_ID}:stream:0`;
const SCENE_SET_ID = 'scene-set:asset-a:stream-0';
const SCENE_SET_REVISION_ID = 'scene-set-revision:v4';
const BASELINE_MODEL_ID = 'baseline-local-embedding';
const BASELINE_MODEL_VERSION = '1.0.0';
const BASELINE_REPRESENTATION_ID = 'baseline-text';
const COMPLEMENTARY_REPRESENTATION_ID = 'complementary-intent';

const BASELINE_VECTORS: number[][] = [
  [1, 0], [0.99, 0.1], [0.95, 0.2], [0.9, 0.3], [0.8, 0.4], [0.7, 0.5],
  [0.6, 0.6], [0.5, 0.7], [0.4, 0.8], [0.3, 0.9], [0.2, 0.95], [0, 1],
];

function baselineScene(index: number): BaselineIndexedSceneCandidate {
  const vector = BASELINE_VECTORS[index - 1]!;
  const startPts = (index - 1) * 90_000;
  const document: IndexedSceneDocument = {
    schemaVersion: INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
    documentId: `indexed-scene:scene-${index}`,
    revisionId: `indexed-scene-revision:${String(index).padStart(2, '0')}`,
    source: {
      sceneSetId: SCENE_SET_ID,
      sceneSetRevisionId: SCENE_SET_REVISION_ID,
      sceneId: `scene-${index}`,
      assetId: ASSET_ID,
      streamId: STREAM_ID,
      streamIndex: 0,
      sourceTimeBase: { numerator: 1, denominator: 90_000 },
      sourceStartPts: startPts,
      sourceEndPts: startPts + 90_000,
    },
    representationRevisionId: 'scene-representation:v1',
    representationText: `Labeled benchmark scene ${index}`,
    embedding: {
      embeddingRevisionId: 'embedding-revision:v1',
      modelId: BASELINE_MODEL_ID,
      modelVersion: BASELINE_MODEL_VERSION,
      dimensions: 2,
      vectorSha256: computeIndexedSceneVectorSha256(vector),
    },
    createdAt: '2026-08-26T11:30:00.000Z',
  };
  return { document, vector: [...vector] };
}

function query(queryId: string, text: string): BaselineSceneRetrievalQuery {
  return {
    schemaVersion: BASELINE_SCENE_RETRIEVAL_QUERY_SCHEMA_VERSION,
    queryId,
    revisionId: `${queryId}:revision:v1`,
    queryText: text,
    topK: BASELINE_RECALL_CUTOFF,
    scopes: [{
      sceneSetId: SCENE_SET_ID,
      sceneSetRevisionId: SCENE_SET_REVISION_ID,
      assetId: ASSET_ID,
      streamId: STREAM_ID,
      streamIndex: 0,
      sourceTimeBase: { numerator: 1, denominator: 90_000 },
    }],
    createdAt: '2026-08-26T11:31:00.000Z',
  };
}

function benchmark(): LabeledRecallAt10Benchmark {
  return {
    schemaVersion: LABELED_RECALL_AT_10_BENCHMARK_SCHEMA_VERSION,
    benchmarkId: 'phase4-labeled-recall-at-10',
    revisionId: 'phase4-labeled-recall-at-10:v1',
    embeddingModelId: BASELINE_MODEL_ID,
    embeddingModelVersion: BASELINE_MODEL_VERSION,
    embeddingDimensions: 2,
    indexedScenes: Array.from({ length: 12 }, (_, index) => baselineScene(index + 1)),
    cases: [
      {
        query: query('query-green-leading', 'green field opening shot'),
        queryVector: [1, 0],
        relevantDocumentRevisionIds: ['indexed-scene-revision:01', 'indexed-scene-revision:12'],
      },
      {
        query: query('query-blue-closing', 'blue sky closing shot'),
        queryVector: [0, 1],
        relevantDocumentRevisionIds: ['indexed-scene-revision:12'],
      },
      {
        query: query('query-balanced-mid', 'balanced travel transition'),
        queryVector: [0.7, 0.7],
        relevantDocumentRevisionIds: ['indexed-scene-revision:07'],
      },
    ],
    createdAt: '2026-08-26T11:32:00.000Z',
  };
}

function policy(): HybridRetrievalPolicy {
  return {
    schemaVersion: HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION,
    policyId: 'phase5-hybrid-retrieval',
    revisionId: 'phase5-hybrid-retrieval:v1',
    benchmarkControl: {
      benchmarkId: 'phase4-labeled-recall-at-10',
      benchmarkRevisionId: 'phase4-labeled-recall-at-10:v1',
      baselinePolicyRevisionId: 'phase4-single-vector-baseline:v1',
    },
    fusionMethod: 'weighted-cosine-score-v1',
    candidatePoolSize: 12,
    representations: [
      {
        representationId: BASELINE_REPRESENTATION_ID,
        representationRevisionId: 'scene-representation:v1',
        embeddingRevisionId: 'embedding-revision:v1',
        modelId: BASELINE_MODEL_ID,
        modelVersion: BASELINE_MODEL_VERSION,
        weightBasisPoints: 5_000,
      },
      {
        representationId: COMPLEMENTARY_REPRESENTATION_ID,
        representationRevisionId: 'scene-intent-representation:v1',
        embeddingRevisionId: 'intent-embedding-revision:v1',
        modelId: 'phase5-intent-embedding',
        modelVersion: '1.0.0',
        weightBasisPoints: 5_000,
      },
    ],
    createdAt: '2026-08-26T18:00:00.000Z',
  };
}

function duplicatePolicy(): RetrievalDuplicateControlPolicy {
  return {
    schemaVersion: RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION,
    policyId: 'phase5-retrieval-duplicate-control',
    revisionId: 'phase5-retrieval-duplicate-control:v1',
    hybridPolicyRevisionId: 'phase5-hybrid-retrieval:v1',
    method: 'same-source-interval-iou-v1',
    maxResults: 10,
    maxSameSourceIntervalIouBasisPoints: 8_000,
    createdAt: '2026-08-26T18:01:00.000Z',
  };
}

function complementaryVector(index: number): number[] {
  if (index === 12) return [1, 0, 0];
  if (index === 7) return [0, 1, 0];
  return [0, 0, 1];
}

function candidates(control: LabeledRecallAt10Benchmark): HybridRetrievalCandidate[] {
  return control.indexedScenes.flatMap((baseline, zeroBasedIndex) => {
    const index = zeroBasedIndex + 1;
    const complementary = complementaryVector(index);
    const complementaryDocument: IndexedSceneDocument = {
      ...baseline.document,
      documentId: `indexed-scene:intent:scene-${index}`,
      revisionId: `indexed-scene-intent-revision:${String(index).padStart(2, '0')}`,
      representationRevisionId: 'scene-intent-representation:v1',
      representationText: `Complementary intent scene ${index}`,
      embedding: {
        embeddingRevisionId: 'intent-embedding-revision:v1',
        modelId: 'phase5-intent-embedding',
        modelVersion: '1.0.0',
        dimensions: 3,
        vectorSha256: computeIndexedSceneVectorSha256(complementary),
      },
      createdAt: '2026-08-26T18:02:00.000Z',
    };
    return [
      {
        representationId: BASELINE_REPRESENTATION_ID,
        document: baseline.document,
        vector: [...baseline.vector],
      },
      {
        representationId: COMPLEMENTARY_REPRESENTATION_ID,
        document: complementaryDocument,
        vector: complementary,
      },
    ];
  });
}

function queryRepresentations(
  benchmarkCase: LabeledRecallAt10Benchmark['cases'][number],
): HybridRetrievalQueryRepresentation[] {
  const intentVector = benchmarkCase.query.queryId === 'query-balanced-mid'
    ? [0, 1, 0]
    : [1, 0, 0];
  return [
    {
      representationId: BASELINE_REPRESENTATION_ID,
      representationRevisionId: 'scene-representation:v1',
      embeddingRevisionId: 'embedding-revision:v1',
      modelId: BASELINE_MODEL_ID,
      modelVersion: BASELINE_MODEL_VERSION,
      vector: [...benchmarkCase.queryVector],
    },
    {
      representationId: COMPLEMENTARY_REPRESENTATION_ID,
      representationRevisionId: 'scene-intent-representation:v1',
      embeddingRevisionId: 'intent-embedding-revision:v1',
      modelId: 'phase5-intent-embedding',
      modelVersion: '1.0.0',
      vector: intentVector,
    },
  ];
}

function evaluationInput(): HybridRecallAt10EvaluationInput {
  const control = benchmark();
  return {
    schemaVersion: HYBRID_RECALL_AT_10_EVALUATION_SCHEMA_VERSION,
    evaluationId: 'phase5-hybrid-duplicate-control-evaluation',
    revisionId: 'phase5-hybrid-duplicate-control-evaluation:v1',
    benchmark: control,
    hybridPolicy: policy(),
    duplicateControlPolicy: duplicatePolicy(),
    candidates: candidates(control),
    cases: control.cases.map((benchmarkCase) => ({
      queryId: benchmarkCase.query.queryId,
      queryRepresentations: queryRepresentations(benchmarkCase),
    })),
    createdAt: '2026-08-26T18:03:00.000Z',
  };
}

describe('Phase-5 same-benchmark hybrid + duplicate-control evaluation', () => {
  it('measures a deterministic Recall@10 gain on the exact Phase-4 benchmark revision', () => {
    const result = evaluateHybridRecallAt10(evaluationInput());

    expect(result.baseline.macroRecallAt10).toBeCloseTo(5 / 6, 12);
    expect(result.baseline.microRecallAt10).toBeCloseTo(3 / 4, 12);
    expect(result.macroRecallAt10).toBe(1);
    expect(result.microRecallAt10).toBe(1);
    expect(result.macroRecallAt10Gain).toBeCloseTo(1 / 6, 12);
    expect(result.microRecallAt10Gain).toBeCloseTo(1 / 4, 12);
    expect(result.totalRelevantRetrieved).toBe(4);
    expect(result.caseResults.map((entry) => entry.recallAt10)).toEqual([1, 1, 1]);
  });

  it('executes duplicate control and records zero occupancy for the non-overlapping control fixture', () => {
    const result = evaluateHybridRecallAt10(evaluationInput());

    expect(result.caseResults.every((entry) => entry.suppressedDuplicateCount === 0)).toBe(true);
    expect(result.meanDuplicateOccupancyBeforeControl).toBe(0);
    expect(result.meanDuplicateOccupancyAfterControl).toBe(0);
    expect(result.caseResults.every((entry) => entry.controlledResultCount === 10)).toBe(true);
  });

  it('is deterministic across repeated evaluation', () => {
    expect(evaluateHybridRecallAt10(evaluationInput()))
      .toEqual(evaluateHybridRecallAt10(evaluationInput()));
  });

  it('fails closed if the hybrid policy points at another benchmark revision', () => {
    const input = evaluationInput();
    input.hybridPolicy.benchmarkControl.benchmarkRevisionId = 'phase4-labeled-recall-at-10:v2';

    expect(() => evaluateHybridRecallAt10(input))
      .toThrow(HybridRecallAt10EvaluationInvariantError);
  });

  it('fails closed if duplicate control does not bind to the exact hybrid policy revision', () => {
    const input = evaluationInput();
    input.duplicateControlPolicy.hybridPolicyRevisionId = 'phase5-hybrid-retrieval:v2';

    expect(() => evaluateHybridRecallAt10(input))
      .toThrow('duplicate-control policy does not bind to exact hybrid policy revision');
  });
});
