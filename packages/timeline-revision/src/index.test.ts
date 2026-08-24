import { describe, expect, it } from 'vitest';
import type { CanonicalTimelineAssetItemV2, CanonicalTimelineV2 } from '../../contracts/src/canonical-timeline.contract.js';
import { createShiftedSourceRevisionV2, CanonicalRevisionEditError } from './index.js';

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
