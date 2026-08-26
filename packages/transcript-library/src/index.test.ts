import { describe, expect, it } from 'vitest';

import {
  TRANSCRIPT_SCHEMA_VERSION,
  type TranscriptRevision,
} from '../../contracts/src/transcript.contract.js';
import {
  InMemoryTranscriptRevisionStore,
  TranscriptPersistenceInvariantError,
  sameImmutableTranscriptRevision,
} from './index.js';

function revision(overrides: Partial<TranscriptRevision> = {}): TranscriptRevision {
  return {
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    transcriptId: 'transcript:asset-a:audio-1',
    revisionId: 'transcript-revision:001',
    source: {
      assetId: `sha256:${'a'.repeat(64)}`,
      streamId: `sha256:${'a'.repeat(64)}:stream:1`,
      streamIndex: 1,
      timeBase: { numerator: 1, denominator: 48000 },
    },
    revisionKind: 'asr',
    asrModelVersion: 'whisper-large-v3/2026-08',
    language: 'th',
    createdAt: '2026-08-26T00:00:00.000Z',
    words: [
      {
        wordId: 'word-000',
        ordinal: 0,
        text: 'เรา',
        sourceStartPts: 4800,
        sourceEndPts: 9600,
        confidence: 0.97,
      },
      {
        wordId: 'word-001',
        ordinal: 1,
        text: 'ไป',
        sourceStartPts: 10000,
        sourceEndPts: 13200,
        confidence: 0.92,
      },
    ],
    ...overrides,
  };
}

describe('immutable transcript revision persistence', () => {
  it('registers once and treats equivalent rational source time bases as idempotent', () => {
    const store = new InMemoryTranscriptRevisionStore();
    const first = store.registerRevision(revision());
    const second = store.registerRevision(revision({
      source: {
        ...revision().source,
        timeBase: { numerator: 2, denominator: 96000 },
      },
    }));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.revision.source.timeBase).toEqual({ numerator: 1, denominator: 48000 });
    expect(store.getRevision(first.revision.revisionId)).toEqual(first.revision);
  });

  it('rejects revisionId reuse when source or correction-lineage evidence changes', () => {
    const store = new InMemoryTranscriptRevisionStore();
    store.registerRevision(revision());

    expect(() => store.registerRevision(revision({
      source: {
        ...revision().source,
        streamId: `sha256:${'a'.repeat(64)}:stream:2`,
        streamIndex: 2,
      },
    }))).toThrow('conflicts with existing immutable revision');

    expect(() => store.registerRevision(revision({
      revisionKind: 'correction',
      parentRevisionId: 'transcript-revision:000',
    }))).toThrow('conflicts with existing immutable revision');
  });

  it('rejects revisionId reuse when ASR, language, creation or word evidence changes', () => {
    const store = new InMemoryTranscriptRevisionStore();
    store.registerRevision(revision());

    expect(() => store.registerRevision(revision({ asrModelVersion: 'whisper-large-v3/next' })))
      .toThrow('conflicts with existing immutable revision');
    expect(() => store.registerRevision(revision({ language: 'en' })))
      .toThrow('conflicts with existing immutable revision');
    expect(() => store.registerRevision(revision({ createdAt: '2026-08-26T00:01:00.000Z' })))
      .toThrow('conflicts with existing immutable revision');

    const changedWords = revision().words.map((word) => ({ ...word }));
    changedWords[0]!.text = 'ฉัน';
    expect(() => store.registerRevision(revision({ words: changedWords })))
      .toThrow('conflicts with existing immutable revision');

    const changedTiming = revision().words.map((word) => ({ ...word }));
    changedTiming[1]!.sourceEndPts = 13300;
    expect(() => store.registerRevision(revision({ words: changedTiming })))
      .toThrow('conflicts with existing immutable revision');

    const changedConfidence = revision().words.map((word) => ({ ...word }));
    changedConfidence[1]!.confidence = 0.91;
    expect(() => store.registerRevision(revision({ words: changedConfidence })))
      .toThrow('conflicts with existing immutable revision');
  });

  it('allows additive correction revisions without mutating prior ASR evidence', () => {
    const store = new InMemoryTranscriptRevisionStore();
    const original = store.registerRevision(revision()).revision;
    const correctedWords = revision().words.map((word) => ({ ...word }));
    correctedWords[0]!.text = 'ฉัน';

    const correction = store.registerRevision(revision({
      revisionId: 'transcript-revision:002',
      revisionKind: 'correction',
      parentRevisionId: original.revisionId,
      createdAt: '2026-08-26T00:05:00.000Z',
      words: correctedWords,
    })).revision;

    expect(correction.revisionId).not.toBe(original.revisionId);
    expect(correction.parentRevisionId).toBe(original.revisionId);
    expect(store.getRevision(original.revisionId)).toEqual(original);
    expect(store.getRevision(correction.revisionId)).toEqual(correction);
  });

  it('defensively copies persisted revisions so callers cannot mutate immutable evidence', () => {
    const store = new InMemoryTranscriptRevisionStore();
    const created = store.registerRevision(revision()).revision;
    created.source.timeBase.numerator = 999;
    created.words[0]!.text = 'mutated';
    created.words[0]!.sourceStartPts = 123456;

    const readback = store.getRevision('transcript-revision:001');
    expect(readback?.source.timeBase).toEqual({ numerator: 1, denominator: 48000 });
    expect(readback?.words[0]?.text).toBe('เรา');
    expect(readback?.words[0]?.sourceStartPts).toBe(4800);
  });

  it('validates candidates before persistence side effects', () => {
    const store = new InMemoryTranscriptRevisionStore();
    expect(() => store.registerRevision(revision({
      words: [{
        wordId: 'bad',
        ordinal: 0,
        text: 'bad',
        sourceStartPts: 100,
        sourceEndPts: 100,
      }],
    }))).toThrow(TranscriptPersistenceInvariantError);
    expect(store.getRevision('transcript-revision:001')).toBeUndefined();
  });
});

describe('sameImmutableTranscriptRevision', () => {
  it('compares all immutable transcript evidence while normalizing rational time bases', () => {
    const left = revision();
    const right = revision({
      source: {
        ...revision().source,
        timeBase: { numerator: 2, denominator: 96000 },
      },
    });

    expect(sameImmutableTranscriptRevision(left, right)).toBe(true);
    expect(sameImmutableTranscriptRevision(left, revision({ revisionId: 'different' }))).toBe(false);
  });
});
