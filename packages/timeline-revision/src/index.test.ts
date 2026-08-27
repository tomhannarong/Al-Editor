import { describe, expect, it } from 'vitest';
import type { CanonicalTimelineAssetItemV2, CanonicalTimelineV2 } from '../../contracts/src/canonical-timeline.contract.js';
import {
  CANONICAL_REVIEW_LOCK_SCHEMA_VERSION,
  CanonicalRevisionEditError,
  createHumanReviewChildRevisionV2,
  createShiftedSourceRevisionV2,
} from './index.js';

const makeParent = (): CanonicalTimelineV2 => ({
  schemaVersion: '2.0', timelineId: 'timeline-1', revisionId: 'revision-1', projectId: 'project-1',
  frameRate: { numerator: 30000, denominator: 1001 }, durationFrames: 90,
  items: [{ kind: 'asset-video', itemId: 'clip-1', trackId: 'video-0', startFrame: 0, endFrame: 90, assetId: 'asset-1', source: { streamIndex: 0, sourceStartPts: 29010, sourceEndPts: 119100, sourceTimeBase: { numerator: 1, denominator: 30000 } }, playbackRate: { numerator: 1, denominator: 1 } }],
  deliveryProfileVersion: 'delivery-v1', manifestSha256: 'a'.repeat(64), createdBy: 'parent', createdAt: '2026-08-25T00:00:00Z',
});
const identity = { revisionId: 'revision-2', manifestSha256: 'b'.repeat(64), createdBy: 'editor', createdAt: '2026-08-25T00:00:01Z' };
const edit = { itemId: 'clip-1', sourceStartPts: 44025, sourceEndPts: 134115 };

describe('immutable canonical v2 source-window revision', () => {
  it('creates a distinct child without mutating the parent and deep-freezes the child', () => {
    const parent = makeParent();
    const before = JSON.stringify(parent);
    const child = createShiftedSourceRevisionV2(parent, edit, identity);
    expect(JSON.stringify(parent)).toBe(before);
    expect(child.revisionId).toBe('revision-2');
    expect(child.parentRevisionId).toBe('revision-1');
    expect(child.manifestSha256).toBe('b'.repeat(64));
    const item = child.items[0] as CanonicalTimelineAssetItemV2;
    expect(item.source.sourceStartPts).toBe(44025);
    expect(item.source.sourceEndPts).toBe(134115);
    expect(Object.isFrozen(child)).toBe(true);
    expect(Object.isFrozen(child.items)).toBe(true);
    expect(Object.isFrozen(item.source)).toBe(true);
    expect(() => { item.source.sourceStartPts = 1; }).toThrow(TypeError);
  });

  it('rejects reused revision identity or manifest identity', () => {
    const parent = makeParent();
    expect(() => createShiftedSourceRevisionV2(parent, edit, { ...identity, revisionId: parent.revisionId })).toThrow(CanonicalRevisionEditError);
    expect(() => createShiftedSourceRevisionV2(parent, edit, { ...identity, manifestSha256: parent.manifestSha256 })).toThrow(CanonicalRevisionEditError);
  });

  it('rejects an edit that changes the authoritative native-PTS span', () => {
    expect(() => createShiftedSourceRevisionV2(makeParent(), { ...edit, sourceEndPts: edit.sourceEndPts + 1 }, identity)).toThrow(/preserve the native PTS span/);
  });

  it('rejects invalid or backwards child chronology', () => {
    expect(() => createShiftedSourceRevisionV2(makeParent(), edit, { ...identity, createdAt: 'bad' })).toThrow(CanonicalRevisionEditError);
    expect(() => createShiftedSourceRevisionV2(makeParent(), edit, { ...identity, createdAt: '2026-08-24T23:59:59Z' })).toThrow(CanonicalRevisionEditError);
  });
});

describe('canonical human-review replace/trim/lock revisions', () => {
  it('replaces source lineage while preserving project placement and exact media duration', () => {
    const parent = makeParent();
    const before = JSON.stringify(parent);
    const result = createHumanReviewChildRevisionV2(parent, {
      action: 'replace',
      itemId: 'clip-1',
      replacement: {
        assetId: 'asset-2', streamIndex: 1, sourceStartPts: 1000, sourceEndPts: 91090,
        sourceTimeBase: { numerator: 2, denominator: 60000 },
      },
    }, identity);

    expect(JSON.stringify(parent)).toBe(before);
    const item = result.timeline.items[0] as CanonicalTimelineAssetItemV2;
    expect(item.assetId).toBe('asset-2');
    expect(item.startFrame).toBe(0);
    expect(item.endFrame).toBe(90);
    expect(item.source.streamIndex).toBe(1);
    expect(item.source.sourceTimeBase).toEqual({ numerator: 1, denominator: 30000 });
    expect(result.timeline.parentRevisionId).toBe(parent.revisionId);
    expect(result.lockState).toEqual({ schemaVersion: CANONICAL_REVIEW_LOCK_SCHEMA_VERSION, revisionId: identity.revisionId, lockedItemIds: [] });
    expect(Object.isFrozen(result.timeline)).toBe(true);
  });

  it('trims frame and native-PTS boundaries proportionally without changing project durationFrames', () => {
    const result = createHumanReviewChildRevisionV2(makeParent(), {
      action: 'trim', itemId: 'clip-1', startFrame: 10, endFrame: 80, sourceStartPts: 39020, sourceEndPts: 109090,
    }, identity);
    const item = result.timeline.items[0] as CanonicalTimelineAssetItemV2;
    expect(item.startFrame).toBe(10);
    expect(item.endFrame).toBe(80);
    expect(item.source.sourceStartPts).toBe(39020);
    expect(item.source.sourceEndPts).toBe(109090);
    expect(result.timeline.durationFrames).toBe(90);
  });

  it('locks a canonical item in revision-bound sidecar evidence and blocks later media edits', () => {
    const parent = makeParent();
    const locked = createHumanReviewChildRevisionV2(parent, { action: 'lock', itemId: 'clip-1' }, identity);
    const lockedItem = locked.timeline.items[0] as CanonicalTimelineAssetItemV2;
    const parentItem = parent.items[0] as CanonicalTimelineAssetItemV2;
    expect(lockedItem.assetId).toBe(parentItem.assetId);
    expect(lockedItem.source).toEqual(parentItem.source);
    expect(locked.lockState.lockedItemIds).toEqual(['clip-1']);

    expect(() => createHumanReviewChildRevisionV2(locked.timeline, {
      action: 'trim', itemId: 'clip-1', startFrame: 10, endFrame: 80, sourceStartPts: 39020, sourceEndPts: 109090,
    }, { revisionId: 'revision-3', manifestSha256: 'c'.repeat(64), createdBy: 'editor', createdAt: '2026-08-25T00:00:02Z' }, locked.lockState)).toThrow(/review-locked/);
  });

  it('rejects replacement duration drift and trim boundary drift', () => {
    expect(() => createHumanReviewChildRevisionV2(makeParent(), {
      action: 'replace', itemId: 'clip-1', replacement: {
        assetId: 'asset-2', streamIndex: 0, sourceStartPts: 0, sourceEndPts: 90089,
        sourceTimeBase: { numerator: 1, denominator: 30000 },
      },
    }, identity)).toThrow(/duration must exactly match/);

    expect(() => createHumanReviewChildRevisionV2(makeParent(), {
      action: 'trim', itemId: 'clip-1', startFrame: 10, endFrame: 80, sourceStartPts: 39021, sourceEndPts: 109090,
    }, identity)).toThrow(CanonicalRevisionEditError);
  });

  it('rejects stale lock state that is not bound to the exact parent revision', () => {
    expect(() => createHumanReviewChildRevisionV2(makeParent(), { action: 'lock', itemId: 'clip-1' }, identity, {
      schemaVersion: CANONICAL_REVIEW_LOCK_SCHEMA_VERSION, revisionId: 'revision-other', lockedItemIds: [],
    })).toThrow(/exact parent revision/);
  });
});
