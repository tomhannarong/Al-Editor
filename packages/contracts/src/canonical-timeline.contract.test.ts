import { describe, expect, it } from 'vitest';
import {
  CANONICAL_TIMELINE_V1_SCHEMA_VERSION,
  CANONICAL_TIMELINE_V2_SCHEMA_VERSION,
  isCanonicalTimelineV2,
  normalizeCanonicalRational,
  validateCanonicalTimelineV2,
  type CanonicalTimelineV1,
  type CanonicalTimelineV2,
} from './canonical-timeline.contract.js';

const validV2: CanonicalTimelineV2 = {
  schemaVersion: CANONICAL_TIMELINE_V2_SCHEMA_VERSION,
  timelineId: 'timeline-1', revisionId: 'revision-1', projectId: 'project-1',
  frameRate: { numerator: 30000, denominator: 1001 }, durationFrames: 90,
  items: [{ kind: 'asset-video', itemId: 'clip-1', trackId: 'video-0', startFrame: 0, endFrame: 90, assetId: 'asset-1', source: { streamIndex: 0, sourceStartPts: 9000, sourceEndPts: 99000, sourceTimeBase: { numerator: 1, denominator: 90000 } }, playbackRate: { numerator: 1, denominator: 1 } }],
  deliveryProfileVersion: 'delivery-v1', manifestSha256: 'a'.repeat(64), createdBy: 'test', createdAt: '2026-08-25T00:00:00.000Z',
};

describe('canonical timeline v2', () => {
  it('accepts rational project fps + native source pts/time-base', () => {
    expect(validateCanonicalTimelineV2(validV2)).toEqual({ valid: true, errors: [] });
  });
  it('normalizes rationals deterministically', () => {
    expect(normalizeCanonicalRational({ numerator: 60000, denominator: 2002 })).toEqual({ numerator: 30000, denominator: 1001 });
  });
  it('rejects non-integer native PTS', () => {
    const invalid = structuredClone(validV2);
    const item = invalid.items[0]!;
    if (item.kind !== 'asset-video') throw new Error('fixture');
    item.source.sourceStartPts = 1.5;
    expect(validateCanonicalTimelineV2(invalid).valid).toBe(false);
  });
  it('keeps v1 readable without treating it as v2', () => {
    const legacy: CanonicalTimelineV1 = { schemaVersion: CANONICAL_TIMELINE_V1_SCHEMA_VERSION, timelineId: 'legacy-1', projectId: 'project-1', frameRate: 30, durationFrames: 90, durationSeconds: 3, items: [{ itemId: 'legacy-clip', trackId: 'video-0', startFrame: 0, endFrame: 90, startSecond: 0, endSecond: 3, sourceStartSecond: 10, sourceEndSecond: 13 }], manifestSha256: 'b'.repeat(64), createdBy: 'legacy', createdAt: '2026-08-24T00:00:00.000Z' };
    expect(isCanonicalTimelineV2(legacy)).toBe(false);
    expect(legacy.items[0]!.sourceStartSecond).toBe(10);
  });
});
