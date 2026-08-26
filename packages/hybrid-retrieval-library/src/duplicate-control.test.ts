import { describe, expect, it } from 'vitest';

import {
  RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION,
  type RetrievalDuplicateControlPolicy,
} from '../../contracts/src/retrieval-duplicate-control-policy.contract.js';
import type { IndexedSceneSourceLineage } from '../../contracts/src/indexed-scene-document.contract.js';
import type {
  ExecuteHybridRetrievalResult,
  HybridRetrievalResultItem,
} from './execution.js';
import {
  RetrievalDuplicateControlInvariantError,
  applyRetrievalDuplicateControl,
} from './duplicate-control.js';

function policy(overrides: Partial<RetrievalDuplicateControlPolicy> = {}): RetrievalDuplicateControlPolicy {
  return {
    schemaVersion: RETRIEVAL_DUPLICATE_CONTROL_POLICY_SCHEMA_VERSION,
    policyId: 'duplicate-policy:travel-scenes',
    revisionId: 'duplicate-policy-revision:v1',
    hybridPolicyRevisionId: 'hybrid-policy-revision:v1',
    method: 'same-source-interval-iou-v1',
    maxResults: 3,
    maxSameSourceIntervalIouBasisPoints: 5_000,
    createdAt: '2026-08-26T17:35:00.000Z',
    ...overrides,
  };
}

function source(
  sceneId: string,
  startPts: number,
  endPts: number,
  overrides: Partial<IndexedSceneSourceLineage> = {},
): IndexedSceneSourceLineage {
  return {
    sceneSetId: 'scene-set:trip-001',
    sceneSetRevisionId: 'scene-set-revision:v2',
    sceneId,
    assetId: `sha256:${'a'.repeat(64)}`,
    streamId: 'stream:video:0',
    streamIndex: 0,
    sourceTimeBase: { numerator: 1, denominator: 90_000 },
    sourceStartPts: startPts,
    sourceEndPts: endPts,
    ...overrides,
  };
}

function item(
  sceneId: string,
  startPts: number,
  endPts: number,
  score: number,
  overrides: Partial<IndexedSceneSourceLineage> = {},
): HybridRetrievalResultItem {
  return {
    sceneKey: JSON.stringify(['scene-set:trip-001', 'scene-set-revision:v2', sceneId]),
    source: source(sceneId, startPts, endPts, overrides),
    fusedScore: score,
    representationScores: [],
  };
}

function retrieval(items: HybridRetrievalResultItem[]): ExecuteHybridRetrievalResult {
  return {
    policyRevisionId: 'hybrid-policy-revision:v1',
    fusionMethod: 'weighted-cosine-score-v1',
    items,
  };
}

describe('deterministic retrieval duplicate control', () => {
  it('suppresses later same-stream candidates whose native-PTS IoU exceeds the threshold', () => {
    const first = item('scene-a', 0, 100, 1);
    const duplicate = item('scene-b', 20, 100, 0.9);
    const distinct = item('scene-c', 100, 200, 0.8);

    const result = applyRetrievalDuplicateControl({
      policy: policy(),
      retrieval: retrieval([first, duplicate, distinct]),
    });

    expect(result.items.map((entry) => entry.source.sceneId)).toEqual(['scene-a', 'scene-c']);
    expect(result.suppressed).toEqual([
      {
        sceneKey: duplicate.sceneKey,
        suppressedBySceneKey: first.sceneKey,
        intervalIouBasisPoints: 8_000,
      },
    ]);
  });

  it('retains candidates at exact threshold equality and candidates on different immutable streams', () => {
    const exactThreshold = applyRetrievalDuplicateControl({
      policy: policy({ maxSameSourceIntervalIouBasisPoints: 5_000 }),
      retrieval: retrieval([
        item('scene-a', 0, 100, 1),
        item('scene-b', 0, 50, 0.9),
      ]),
    });
    expect(exactThreshold.items).toHaveLength(2);
    expect(exactThreshold.suppressed).toEqual([]);

    const differentStream = applyRetrievalDuplicateControl({
      policy: policy(),
      retrieval: retrieval([
        item('scene-a', 0, 100, 1),
        item('scene-b', 0, 100, 0.9, { streamId: 'stream:video:1', streamIndex: 1 }),
      ]),
    });
    expect(differentStream.items).toHaveLength(2);
  });

  it('preserves incoming ranking order and enforces maxResults after deterministic suppression', () => {
    const result = applyRetrievalDuplicateControl({
      policy: policy({ maxResults: 2 }),
      retrieval: retrieval([
        item('scene-a', 0, 100, 1),
        item('scene-b', 10, 90, 0.95),
        item('scene-c', 100, 200, 0.9),
        item('scene-d', 200, 300, 0.8),
      ]),
    });

    expect(result.items.map((entry) => entry.source.sceneId)).toEqual(['scene-a', 'scene-c']);
    expect(result.suppressed.map((entry) => entry.sceneKey)).toEqual([
      JSON.stringify(['scene-set:trip-001', 'scene-set-revision:v2', 'scene-b']),
    ]);
  });

  it('fails closed when duplicate-control policy lineage does not match hybrid retrieval evidence', () => {
    expect(() => applyRetrievalDuplicateControl({
      policy: policy({ hybridPolicyRevisionId: 'hybrid-policy-revision:v999' }),
      retrieval: retrieval([item('scene-a', 0, 100, 1)]),
    })).toThrow(RetrievalDuplicateControlInvariantError);
  });

  it('fails closed on conflicting time-base evidence for the same immutable asset/stream', () => {
    expect(() => applyRetrievalDuplicateControl({
      policy: policy(),
      retrieval: retrieval([
        item('scene-a', 0, 100, 1),
        item('scene-b', 10, 90, 0.9, {
          sourceTimeBase: { numerator: 1, denominator: 1_000 },
        }),
      ]),
    })).toThrow(RetrievalDuplicateControlInvariantError);
  });

  it('fails closed on duplicate scene keys and invalid native-PTS intervals', () => {
    const duplicated = item('scene-a', 0, 100, 1);
    expect(() => applyRetrievalDuplicateControl({
      policy: policy(),
      retrieval: retrieval([duplicated, { ...duplicated }]),
    })).toThrow(RetrievalDuplicateControlInvariantError);

    expect(() => applyRetrievalDuplicateControl({
      policy: policy(),
      retrieval: retrieval([item('scene-a', 100, 100, 1)]),
    })).toThrow(RetrievalDuplicateControlInvariantError);
  });

  it('returns defensive copies of kept evidence', () => {
    const original = item('scene-a', 0, 100, 1);
    const result = applyRetrievalDuplicateControl({
      policy: policy(),
      retrieval: retrieval([original]),
    });

    result.items[0]!.source.sourceTimeBase.denominator = 1;
    expect(original.source.sourceTimeBase.denominator).toBe(90_000);
  });
});
