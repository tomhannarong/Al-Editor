import { describe, expect, it } from 'vitest';

import {
  EDITORIAL_SEGMENT_SCHEMA_VERSION,
  type EditorialSegmentRevision,
} from '../../contracts/src/editorial-segment.contract.js';
import {
  EditorialSegmentPersistenceInvariantError,
  InMemoryEditorialSegmentRevisionStore,
  sameImmutableEditorialSegmentRevision,
} from './index.js';

function revision(overrides: Partial<EditorialSegmentRevision> = {}): EditorialSegmentRevision {
  return {
    schemaVersion: EDITORIAL_SEGMENT_SCHEMA_VERSION,
    segmentSetId: 'segment-set:transcript-001',
    revisionId: 'segment-revision:001',
    transcriptId: 'transcript:asset-a:audio-1',
    transcriptRevisionId: 'transcript-revision:001',
    createdAt: '2026-08-26T02:00:00.000Z',
    segments: [
      {
        segmentId: 'segment-000',
        ordinal: 0,
        startWordId: 'word-000',
        endWordId: 'word-002',
      },
      {
        segmentId: 'segment-001',
        ordinal: 1,
        startWordId: 'word-003',
        endWordId: 'word-005',
      },
    ],
    ...overrides,
  };
}

describe('immutable editorial segment revision persistence', () => {
  it('registers once and treats exact semantic re-registration as idempotent', () => {
    const store = new InMemoryEditorialSegmentRevisionStore();
    const first = store.registerRevision(revision());
    const second = store.registerRevision(revision());

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.revision).toEqual(first.revision);
    expect(store.getRevision(first.revision.revisionId)).toEqual(first.revision);
  });

  it('rejects revisionId reuse when transcript lineage changes', () => {
    const store = new InMemoryEditorialSegmentRevisionStore();
    store.registerRevision(revision());

    expect(() => store.registerRevision(revision({ transcriptId: 'transcript:other' })))
      .toThrow('conflicts with existing immutable revision');
    expect(() => store.registerRevision(revision({ transcriptRevisionId: 'transcript-revision:002' })))
      .toThrow('conflicts with existing immutable revision');
  });

  it('rejects revisionId reuse when segment boundaries, ordering or creation evidence changes', () => {
    const store = new InMemoryEditorialSegmentRevisionStore();
    store.registerRevision(revision());

    const changedBoundary = revision().segments.map((segment) => ({ ...segment }));
    changedBoundary[0]!.endWordId = 'word-001';
    expect(() => store.registerRevision(revision({ segments: changedBoundary })))
      .toThrow('conflicts with existing immutable revision');

    const reordered = revision().segments.map((segment) => ({ ...segment })).reverse();
    reordered.forEach((segment, index) => { segment.ordinal = index; });
    expect(() => store.registerRevision(revision({ segments: reordered })))
      .toThrow('conflicts with existing immutable revision');

    expect(() => store.registerRevision(revision({ createdAt: '2026-08-26T02:01:00.000Z' })))
      .toThrow('conflicts with existing immutable revision');
  });

  it('allows additive revisions without mutating prior editorial evidence', () => {
    const store = new InMemoryEditorialSegmentRevisionStore();
    const original = store.registerRevision(revision()).revision;
    const changedSegments = revision().segments.map((segment) => ({ ...segment }));
    changedSegments[0]!.endWordId = 'word-001';

    const next = store.registerRevision(revision({
      revisionId: 'segment-revision:002',
      createdAt: '2026-08-26T02:05:00.000Z',
      segments: changedSegments,
    })).revision;

    expect(next.revisionId).not.toBe(original.revisionId);
    expect(store.getRevision(original.revisionId)).toEqual(original);
    expect(store.getRevision(next.revisionId)).toEqual(next);
  });

  it('defensively copies persisted revisions so callers cannot mutate immutable evidence', () => {
    const store = new InMemoryEditorialSegmentRevisionStore();
    const created = store.registerRevision(revision()).revision;
    created.segments[0]!.startWordId = 'mutated';

    const readback = store.getRevision('segment-revision:001');
    expect(readback?.segments[0]?.startWordId).toBe('word-000');
  });

  it('validates candidates before persistence side effects', () => {
    const store = new InMemoryEditorialSegmentRevisionStore();
    expect(() => store.registerRevision(revision({
      segments: [{
        segmentId: 'bad',
        ordinal: 1,
        startWordId: 'word-000',
        endWordId: 'word-001',
      }],
    }))).toThrow(EditorialSegmentPersistenceInvariantError);
    expect(store.getRevision('segment-revision:001')).toBeUndefined();
  });
});

describe('sameImmutableEditorialSegmentRevision', () => {
  it('compares all immutable editorial segment evidence', () => {
    expect(sameImmutableEditorialSegmentRevision(revision(), revision())).toBe(true);
    expect(sameImmutableEditorialSegmentRevision(
      revision(),
      revision({ revisionId: 'segment-revision:other' }),
    )).toBe(false);
  });
});
