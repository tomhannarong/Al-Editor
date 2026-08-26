import { describe, expect, it } from 'vitest';

import {
  BASELINE_SCENE_RETRIEVAL_QUERY_SCHEMA_VERSION,
  sameBaselineSceneRetrievalScope,
  validateBaselineSceneRetrievalQuery,
  type BaselineSceneRetrievalQuery,
} from './baseline-scene-retrieval-query.contract.js';

const ASSET_ID = `sha256:${'a'.repeat(64)}`;

function validQuery(): BaselineSceneRetrievalQuery {
  return {
    schemaVersion: BASELINE_SCENE_RETRIEVAL_QUERY_SCHEMA_VERSION,
    queryId: 'query:segment-0001',
    revisionId: 'query-revision:v1',
    queryText: 'green mountain road beneath low clouds',
    topK: 10,
    scopes: [
      {
        sceneSetId: 'scene-set:asset-a:stream-0',
        sceneSetRevisionId: 'scene-set-revision:v1',
        assetId: ASSET_ID,
        streamId: `${ASSET_ID}:stream:0`,
        streamIndex: 0,
        sourceTimeBase: { numerator: 1, denominator: 90_000 },
      },
    ],
    createdAt: '2026-08-26T07:30:00.000Z',
  };
}

describe('baseline scene retrieval query contract', () => {
  it('accepts a versioned textual baseline query bound to exact indexed scene-set/source lineage', () => {
    expect(validateBaselineSceneRetrievalQuery(validQuery())).toEqual({ valid: true, errors: [] });
  });

  it('rejects empty or oversized text, invalid topK and empty scope', () => {
    const query = validQuery();
    query.queryText = ' '.repeat(4097);
    query.topK = 0;
    query.scopes = [];

    const result = validateBaselineSceneRetrievalQuery(query);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('queryText is required');
    expect(result.errors).toContain('queryText must be at most 4096 characters');
    expect(result.errors).toContain('topK must be a safe integer between 1 and 100');
    expect(result.errors).toContain('at least one exact scene-set scope is required');
  });

  it('rejects mutable source identity, invalid stream index and invalid source time base', () => {
    const query = validQuery();
    query.scopes = [{
      ...query.scopes[0]!,
      assetId: '/mutable/path/camera.mov',
      streamIndex: -1,
      sourceTimeBase: { numerator: 0, denominator: 1 },
    }];

    const result = validateBaselineSceneRetrievalQuery(query);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('canonical sha256 asset identity');
    expect(result.errors.join('\n')).toContain('streamIndex must be a non-negative safe integer');
    expect(result.errors.join('\n')).toContain('sourceTimeBase');
  });

  it('rejects duplicate exact scopes after rational normalization', () => {
    const query = validQuery();
    query.scopes.push({
      ...query.scopes[0]!,
      sourceTimeBase: { numerator: 2, denominator: 180_000 },
    });

    const result = validateBaselineSceneRetrievalQuery(query);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duplicate exact scene-set scope at scopes[1]');
  });

  it('compares scope identity using exact scene-set/source lineage and normalized rational time base', () => {
    const scope = validQuery().scopes[0]!;
    expect(sameBaselineSceneRetrievalScope(scope, {
      ...scope,
      sourceTimeBase: { numerator: 2, denominator: 180_000 },
    })).toBe(true);
    expect(sameBaselineSceneRetrievalScope(scope, {
      ...scope,
      sceneSetRevisionId: 'scene-set-revision:v2',
    })).toBe(false);
  });
});
