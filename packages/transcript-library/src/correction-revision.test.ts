import { describe, expect, it } from 'vitest';
import {
  TRANSCRIPT_SCHEMA_VERSION,
  type TranscriptRevision,
} from '../../contracts/src/transcript.contract.js';
import {
  TranscriptCorrectionRevisionError,
  buildTranscriptCorrectionRevision,
  type BuildTranscriptCorrectionRevisionInput,
} from './correction-revision.js';

function parentFixture(): TranscriptRevision {
  return {
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    transcriptId: 'transcript-001',
    revisionId: 'transcript-rev-asr-001',
    source: {
      assetId: `sha256:${'a'.repeat(64)}`,
      streamId: 'audio-main',
      streamIndex: 1,
      timeBase: { numerator: 2, denominator: 180000 },
    },
    revisionKind: 'asr',
    asrModelVersion: 'asr-model-v1',
    language: 'th',
    createdAt: '2026-08-26T05:00:00.000Z',
    words: [
      {
        wordId: 'transcript-rev-asr-001:word:0',
        ordinal: 0,
        text: 'สวัดดี',
        sourceStartPts: 0,
        sourceEndPts: 45000,
        confidence: 0.82,
      },
      {
        wordId: 'transcript-rev-asr-001:word:1',
        ordinal: 1,
        text: 'ค่ะ',
        sourceStartPts: 45000,
        sourceEndPts: 90000,
        confidence: 0.96,
      },
    ],
  };
}

function inputFixture(
  overrides: Partial<Omit<BuildTranscriptCorrectionRevisionInput, 'parent'>> = {},
): BuildTranscriptCorrectionRevisionInput {
  return {
    parent: parentFixture(),
    revisionId: 'transcript-rev-correction-001',
    createdAt: '2026-08-26T06:00:00.000Z',
    corrections: [
      { wordId: 'transcript-rev-asr-001:word:0', text: 'สวัสดี' },
    ],
    ...overrides,
  };
}

describe('buildTranscriptCorrectionRevision', () => {
  it('creates an additive correction while preserving source and stable word timing identities', () => {
    const parent = parentFixture();
    const revision = buildTranscriptCorrectionRevision({
      ...inputFixture(),
      parent,
    });

    expect(revision.revisionKind).toBe('correction');
    expect(revision.parentRevisionId).toBe(parent.revisionId);
    expect(revision.transcriptId).toBe(parent.transcriptId);
    expect(revision.asrModelVersion).toBe(parent.asrModelVersion);
    expect(revision.language).toBe(parent.language);
    expect(revision.source).toEqual({
      ...parent.source,
      timeBase: { numerator: 1, denominator: 90000 },
    });
    expect(revision.words).toEqual([
      { ...parent.words[0]!, text: 'สวัสดี' },
      { ...parent.words[1]! },
    ]);
    expect(revision.words.map(({ wordId, ordinal, sourceStartPts, sourceEndPts }) => ({
      wordId,
      ordinal,
      sourceStartPts,
      sourceEndPts,
    }))).toEqual(parent.words.map(({ wordId, ordinal, sourceStartPts, sourceEndPts }) => ({
      wordId,
      ordinal,
      sourceStartPts,
      sourceEndPts,
    })));
  });

  it('is deterministic for identical parent and correction evidence', () => {
    expect(buildTranscriptCorrectionRevision(inputFixture()))
      .toEqual(buildTranscriptCorrectionRevision(inputFixture()));
  });

  it('supports additive correction chains without rebasing stable word identities', () => {
    const first = buildTranscriptCorrectionRevision(inputFixture());
    const second = buildTranscriptCorrectionRevision({
      parent: first,
      revisionId: 'transcript-rev-correction-002',
      createdAt: '2026-08-26T06:30:00.000Z',
      corrections: [{ wordId: first.words[1]!.wordId, text: 'ครับ' }],
    });

    expect(second.parentRevisionId).toBe(first.revisionId);
    expect(second.words[0]!.wordId).toBe(first.words[0]!.wordId);
    expect(second.words[1]!.wordId).toBe(first.words[1]!.wordId);
    expect(second.words[0]!.sourceStartPts).toBe(first.words[0]!.sourceStartPts);
    expect(second.words[1]!.sourceEndPts).toBe(first.words[1]!.sourceEndPts);
  });

  it('fails closed for revision identity misuse, unknown words and duplicate corrections', () => {
    expect(() => buildTranscriptCorrectionRevision(inputFixture({
      revisionId: 'transcript-rev-asr-001',
    }))).toThrow('correction revisionId must differ from parent revisionId');

    expect(() => buildTranscriptCorrectionRevision(inputFixture({
      corrections: [{ wordId: 'missing-word', text: 'แก้' }],
    }))).toThrow('does not exist in parent revision');

    expect(() => buildTranscriptCorrectionRevision(inputFixture({
      corrections: [
        { wordId: 'transcript-rev-asr-001:word:0', text: 'สวัสดี' },
        { wordId: 'transcript-rev-asr-001:word:0', text: 'สวัสดีค่ะ' },
      ],
    }))).toThrow('duplicate correction wordId');
  });

  it('rejects empty/no-op corrections and an invalid parent before creating evidence', () => {
    expect(() => buildTranscriptCorrectionRevision(inputFixture({ corrections: [] })))
      .toThrow('at least one word correction is required');

    expect(() => buildTranscriptCorrectionRevision(inputFixture({
      corrections: [{ wordId: 'transcript-rev-asr-001:word:0', text: 'สวัดดี' }],
    }))).toThrow('must change at least one word text');

    const invalidParent = parentFixture();
    invalidParent.words[1]!.sourceStartPts = 44000;
    expect(() => buildTranscriptCorrectionRevision({
      ...inputFixture(),
      parent: invalidParent,
    })).toThrow(TranscriptCorrectionRevisionError);
  });
});
