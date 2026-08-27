import {
  TEMPORAL_LIGHTWEIGHT_BASELINE_FIXTURE_SCHEMA_VERSION,
  type TemporalLightweightBaselineFixtureV1,
} from './lightweight-baseline.js';

const TB = { numerator: 1, denominator: 30000 } as const;

export const PHASE11_LIGHTWEIGHT_TEMPORAL_BASELINE_FIXTURE_V1: TemporalLightweightBaselineFixtureV1 = Object.freeze({
  schemaVersion: TEMPORAL_LIGHTWEIGHT_BASELINE_FIXTURE_SCHEMA_VERSION,
  benchmarkId: 'temporal-benchmark:phase11',
  benchmarkRevisionId: 'temporal-benchmark:phase11:r1',
  fixtureRevisionId: 'temporal-fixture:lightweight-control:r1',
  approachId: 'lightweight-scene-retrieval-control',
  approachRevisionId: 'lightweight-scene-retrieval-control:r1',
  scenes: Object.freeze([
    { sceneRevisionId: 'scene:a1:r1', assetId: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', streamIndex: 0, sourceStartPts: 0, sourceEndPts: 30000, sourceTimeBase: TB },
    { sceneRevisionId: 'scene:a1-overlap:r1', assetId: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', streamIndex: 0, sourceStartPts: 6000, sourceEndPts: 36000, sourceTimeBase: TB },
    { sceneRevisionId: 'scene:a2:r1', assetId: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', streamIndex: 0, sourceStartPts: 30000, sourceEndPts: 60000, sourceTimeBase: TB },
    { sceneRevisionId: 'scene:a3:r1', assetId: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', streamIndex: 0, sourceStartPts: 60000, sourceEndPts: 90000, sourceTimeBase: TB },
    { sceneRevisionId: 'scene:b1:r1', assetId: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', streamIndex: 0, sourceStartPts: 0, sourceEndPts: 30000, sourceTimeBase: TB },
    { sceneRevisionId: 'scene:b2:r1', assetId: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', streamIndex: 0, sourceStartPts: 30000, sourceEndPts: 60000, sourceTimeBase: TB },
    { sceneRevisionId: 'scene:b3:r1', assetId: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', streamIndex: 0, sourceStartPts: 60000, sourceEndPts: 90000, sourceTimeBase: TB },
    { sceneRevisionId: 'scene:c1:r1', assetId: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', streamIndex: 0, sourceStartPts: 0, sourceEndPts: 30000, sourceTimeBase: TB },
  ]),
  cases: Object.freeze([
    {
      caseId: 'case:continue-a',
      expectedOrderedSceneRevisionIds: Object.freeze(['scene:a2:r1', 'scene:a3:r1']),
      lightweightRankingSceneRevisionIds: Object.freeze(['scene:a2:r1', 'scene:a1-overlap:r1', 'scene:b2:r1', 'scene:c1:r1']),
    },
    {
      caseId: 'case:continue-b',
      expectedOrderedSceneRevisionIds: Object.freeze(['scene:b2:r1', 'scene:b3:r1']),
      lightweightRankingSceneRevisionIds: Object.freeze(['scene:b2:r1', 'scene:b3:r1', 'scene:c1:r1']),
    },
    {
      caseId: 'case:ordered-a',
      expectedOrderedSceneRevisionIds: Object.freeze(['scene:a1:r1', 'scene:a2:r1']),
      lightweightRankingSceneRevisionIds: Object.freeze(['scene:a1:r1', 'scene:a1-overlap:r1', 'scene:a2:r1']),
    },
  ]),
});
