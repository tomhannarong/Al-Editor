import { describe, expect, it } from 'vitest';

import {
  HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION,
  type HybridRetrievalPolicy,
} from '../../contracts/src/hybrid-retrieval-policy.contract.js';
import {
  INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
  type IndexedSceneDocument,
  type IndexedSceneSourceLineage,
} from '../../contracts/src/indexed-scene-document.contract.js';
import { computeIndexedSceneVectorSha256 } from '../../indexed-scene-library/src/qdrant.js';
import {
  HybridRetrievalExecutionInvariantError,
  executeHybridRetrieval,
  type ExecuteHybridRetrievalInput,
  type HybridRetrievalCandidate,
} from './execution.js';

function policy(): HybridRetrievalPolicy {
  return {
    schemaVersion: HYBRID_RETRIEVAL_POLICY_SCHEMA_VERSION,
    policyId: 'hybrid-policy:travel-scenes',
    revisionId: 'hybrid-policy-revision:v1',
    benchmarkControl: {
      benchmarkId: 'phase4-labeled-recall-at-10',
      benchmarkRevisionId: 'phase4-labeled-recall-at-10:v1',
      baselinePolicyRevisionId: 'single-vector-baseline:v1',
    },
    fusionMethod: 'weighted-cosine-score-v1',
    candidatePoolSize: 3,
    representations: [
      {
        representationId: 'scene-caption',
        representationRevisionId: 'scene-caption:v2',
        embeddingRevisionId: 'embedding:text:v3',
        modelId: 'text-embedding-local',
        modelVersion: '3.0.0',
        weightBasisPoints: 6_000,
      },
      {
        representationId: 'visual-tags',
        representationRevisionId: 'visual-tags:v4',
        embeddingRevisionId: 'embedding:visual-tags:v2',
        modelId: 'visual-embedding-local',
        modelVersion: '2.1.0',
        weightBasisPoints: 4_000,
      },
    ],
    createdAt: '2026-08-26T14:30:00.000Z',
  };
}

function source(sceneId: string, overrides: Partial<IndexedSceneSourceLineage> = {}): IndexedSceneSourceLineage {
  return {
    sceneSetId: 'scene-set:trip-001',
    sceneSetRevisionId: 'scene-set-revision:v2',
    sceneId,
    assetId: `sha256:${'a'.repeat(64)}`,
    streamId: 'stream:video:0',
    streamIndex: 0,
    sourceTimeBase: { numerator: 1, denominator: 90_000 },
    sourceStartPts: 90_000,
    sourceEndPts: 180_000,
    ...overrides,
  };
}

function candidate(
  representationId: 'scene-caption' | 'visual-tags',
  sceneId: string,
  vector: number[],
  sourceOverrides: Partial<IndexedSceneSourceLineage> = {},
): HybridRetrievalCandidate {
  const representation = policy().representations
    .find((entry) => entry.representationId === representationId)!;
  const document: IndexedSceneDocument = {
    schemaVersion: INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
    documentId: `document:${representationId}:${sceneId}`,
    revisionId: `document-revision:${representationId}:${sceneId}`,
    source: source(sceneId, sourceOverrides),
    representationRevisionId: representation.representationRevisionId,
    representationText: `${representationId} ${sceneId}`,
    embedding: {
      embeddingRevisionId: representation.embeddingRevisionId,
      modelId: representation.modelId,
      modelVersion: representation.modelVersion,
      dimensions: vector.length,
      vectorSha256: computeIndexedSceneVectorSha256(vector),
    },
    createdAt: '2026-08-26T14:40:00.000Z',
  };
  return { representationId, document, vector: [...vector] };
}

function input(): ExecuteHybridRetrievalInput {
  return {
    policy: policy(),
    topK: 3,
    queryRepresentations: [
      {
        representationId: 'scene-caption',
        representationRevisionId: 'scene-caption:v2',
        embeddingRevisionId: 'embedding:text:v3',
        modelId: 'text-embedding-local',
        modelVersion: '3.0.0',
        vector: [1, 0],
      },
      {
        representationId: 'visual-tags',
        representationRevisionId: 'visual-tags:v4',
        embeddingRevisionId: 'embedding:visual-tags:v2',
        modelId: 'visual-embedding-local',
        modelVersion: '2.1.0',
        vector: [0, 1],
      },
    ],
    candidates: [
      candidate('scene-caption', 'scene-a', [1, 0]),
      candidate('visual-tags', 'scene-a', [0, 1]),
      candidate('scene-caption', 'scene-b', [1, 0]),
      candidate('visual-tags', 'scene-b', [1, 0]),
      candidate('scene-caption', 'scene-c', [0, 1]),
      candidate('visual-tags', 'scene-c', [0, 1]),
    ],
  };
}

describe('deterministic hybrid retrieval execution', () => {
  it('fuses pinned representations with deterministic weighted cosine scoring', () => {
    const result = executeHybridRetrieval(input());

    expect(result.policyRevisionId).toBe('hybrid-policy-revision:v1');
    expect(result.fusionMethod).toBe('weighted-cosine-score-v1');
    expect(result.items.map((item) => item.source.sceneId)).toEqual(['scene-a', 'scene-b', 'scene-c']);
    expect(result.items.map((item) => item.fusedScore)).toEqual([1, 0.6, 0.4]);
    expect(result.items[0]!.representationScores.map((score) => score.representationId))
      .toEqual(['scene-caption', 'visual-tags']);
  });

  it('uses exact scene identity as deterministic tie-breaker', () => {
    const candidateInput = input();
    candidateInput.topK = 2;
    candidateInput.candidates = [
      candidate('scene-caption', 'scene-b', [1, 0]),
      candidate('visual-tags', 'scene-b', [0, 1]),
      candidate('scene-caption', 'scene-a', [1, 0]),
      candidate('visual-tags', 'scene-a', [0, 1]),
    ];

    expect(executeHybridRetrieval(candidateInput).items.map((item) => item.source.sceneId))
      .toEqual(['scene-a', 'scene-b']);
  });

  it('fails closed when query representation/model evidence differs from the policy', () => {
    const candidateInput = input();
    candidateInput.queryRepresentations[0] = {
      ...candidateInput.queryRepresentations[0]!,
      modelVersion: '3.1.0',
    };

    expect(() => executeHybridRetrieval(candidateInput))
      .toThrow(HybridRetrievalExecutionInvariantError);
  });

  it('fails closed when candidate representation or vector evidence differs from immutable evidence', () => {
    const changedRepresentation = input();
    changedRepresentation.candidates[0]!.document.representationRevisionId = 'scene-caption:v999';
    expect(() => executeHybridRetrieval(changedRepresentation))
      .toThrow(HybridRetrievalExecutionInvariantError);

    const changedVector = input();
    changedVector.candidates[0]!.vector = [0.5, 0.5];
    expect(() => executeHybridRetrieval(changedVector))
      .toThrow(HybridRetrievalExecutionInvariantError);
  });

  it('fails closed on conflicting source lineage for the same scene across representations', () => {
    const candidateInput = input();
    candidateInput.candidates[1] = candidate('visual-tags', 'scene-a', [0, 1], {
      assetId: `sha256:${'b'.repeat(64)}`,
    });

    expect(() => executeHybridRetrieval(candidateInput))
      .toThrow(HybridRetrievalExecutionInvariantError);
  });

  it('enforces bounded candidate pools and requires candidate evidence for every representation', () => {
    const tooMany = input();
    tooMany.candidates.push(candidate('scene-caption', 'scene-d', [1, 0]));
    expect(() => executeHybridRetrieval(tooMany))
      .toThrow(HybridRetrievalExecutionInvariantError);

    const missing = input();
    missing.candidates = missing.candidates
      .filter((entry) => entry.representationId !== 'visual-tags');
    expect(() => executeHybridRetrieval(missing))
      .toThrow(HybridRetrievalExecutionInvariantError);
  });

  it('rejects duplicate candidates for one representation/scene and invalid topK', () => {
    const duplicate = input();
    duplicate.candidates[1] = candidate('scene-caption', 'scene-a', [1, 0]);
    expect(() => executeHybridRetrieval(duplicate))
      .toThrow(HybridRetrievalExecutionInvariantError);

    const invalidTopK = input();
    invalidTopK.topK = invalidTopK.policy.candidatePoolSize + 1;
    expect(() => executeHybridRetrieval(invalidTopK))
      .toThrow(HybridRetrievalExecutionInvariantError);
  });
});
