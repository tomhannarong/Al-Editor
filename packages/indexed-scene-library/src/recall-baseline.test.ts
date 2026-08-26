import { describe, expect, it } from 'vitest';

import {
  BASELINE_SCENE_RETRIEVAL_QUERY_SCHEMA_VERSION,
  type BaselineSceneRetrievalQuery,
} from '../../contracts/src/baseline-scene-retrieval-query.contract.js';
import {
  INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
  type IndexedSceneDocument,
} from '../../contracts/src/indexed-scene-document.contract.js';
import { computeIndexedSceneVectorSha256 } from './qdrant.js';
import {
  BASELINE_RECALL_CUTOFF,
  LABELED_RECALL_AT_10_BENCHMARK_SCHEMA_VERSION,
  LabeledRecallAt10InvariantError,
  evaluateLabeledRecallAt10Benchmark,
  type BaselineIndexedSceneCandidate,
  type LabeledRecallAt10Benchmark,
} from './recall-baseline.js';

const ASSET_ID = `sha256:${'a'.repeat(64)}`;
const STREAM_ID = `${ASSET_ID}:stream:0`;
const SCENE_SET_ID = 'scene-set:asset-a:stream-0';
const SCENE_SET_REVISION_ID = 'scene-set-revision:v4';
const MODEL_ID = 'baseline-local-embedding';
const MODEL_VERSION = '1.0.0';
const DIMENSIONS = 2;

const VECTORS: number[][] = [
  [1, 0],
  [0.99, 0.1],
  [0.95, 0.2],
  [0.9, 0.3],
  [0.8, 0.4],
  [0.7, 0.5],
  [0.6, 0.6],
  [0.5, 0.7],
  [0.4, 0.8],
  [0.3, 0.9],
  [0.2, 0.95],
  [0, 1],
];

function indexedScene(index: number): BaselineIndexedSceneCandidate {
  const vector = VECTORS[index - 1]!;
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
      modelId: MODEL_ID,
      modelVersion: MODEL_VERSION,
      dimensions: DIMENSIONS,
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
    embeddingModelId: MODEL_ID,
    embeddingModelVersion: MODEL_VERSION,
    embeddingDimensions: DIMENSIONS,
    indexedScenes: Array.from({ length: 12 }, (_, index) => indexedScene(index + 1)),
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

describe('Phase-4 labeled Recall@10 baseline', () => {
  it('measures a deterministic imperfect baseline over typed indexed-scene documents', () => {
    const result = evaluateLabeledRecallAt10Benchmark(benchmark());

    expect(result.cutoff).toBe(10);
    expect(result.caseResults).toHaveLength(3);
    expect(result.caseResults[0]?.recallAt10).toBe(0.5);
    expect(result.caseResults[0]?.retrievedDocumentRevisionIds)
      .not.toContain('indexed-scene-revision:12');
    expect(result.caseResults[1]?.recallAt10).toBe(1);
    expect(result.caseResults[2]?.recallAt10).toBe(1);
    expect(result.macroRecallAt10).toBeCloseTo(5 / 6, 12);
    expect(result.microRecallAt10).toBeCloseTo(3 / 4, 12);
    expect(result.totalRelevant).toBe(4);
    expect(result.totalRelevantRetrieved).toBe(3);
  });

  it('is deterministic across repeated evaluation', () => {
    expect(evaluateLabeledRecallAt10Benchmark(benchmark()))
      .toEqual(evaluateLabeledRecallAt10Benchmark(benchmark()));
  });

  it('fails closed when a relevance label is not an actual indexed scene in exact query scope', () => {
    const candidate = benchmark();
    candidate.cases[0]!.relevantDocumentRevisionIds = ['indexed-scene-revision:99'];

    expect(() => evaluateLabeledRecallAt10Benchmark(candidate))
      .toThrow(LabeledRecallAt10InvariantError);
  });

  it('fails closed when immutable source embedding digest evidence does not match vector bytes', () => {
    const candidate = benchmark();
    candidate.indexedScenes[0]!.document.embedding.vectorSha256 = 'f'.repeat(64);

    expect(() => evaluateLabeledRecallAt10Benchmark(candidate))
      .toThrow(/vector does not match immutable vectorSha256 evidence/);
  });

  it('keeps Recall@10 fixed and does not silently evaluate a different topK', () => {
    const candidate = benchmark();
    candidate.cases[0]!.query.topK = 5;

    expect(() => evaluateLabeledRecallAt10Benchmark(candidate))
      .toThrow('Recall@10 benchmark requires query.topK = 10');
  });

  it('requires a pinned single embedding revision family across the benchmark', () => {
    const candidate = benchmark();
    candidate.indexedScenes[0]!.document.embedding.modelVersion = '2.0.0';

    expect(() => evaluateLabeledRecallAt10Benchmark(candidate))
      .toThrow(/embedding evidence does not match benchmark revision/);
  });
});
