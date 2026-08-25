import { describe, expect, it } from 'vitest';

import {
  TRANSCRIPT_SCHEMA_VERSION,
  sameTranscriptSource,
  validateTranscriptRevision,
  type TranscriptRevision,
} from './transcript.contract.js';

const ASSET_ID = `sha256:${'d'.repeat(64)}`;

function validTranscript(): TranscriptRevision {
  return {
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    transcriptId: 'transcript:voiceover-001',
    revisionId: 'transcript-revision:asr-v1',
    source: {
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:1`,
      streamIndex: 1,
      timeBase: { numerator: 1, denominator: 48_000 },
    },
    revisionKind: 'asr',
    asrModelVersion: 'whisper-local/1.0.0',
    language: 'th',
    createdAt: '2026-08-26T00:00:00.000Z',
    words: [
      { wordId: 'w-000', ordinal: 0, text: 'เรา', sourceStartPts: 0, sourceEndPts: 9_600, confidence: 0.98 },
      { wordId: 'w-001', ordinal: 1, text: 'ไป', sourceStartPts: 9_600, sourceEndPts: 16_800, confidence: 0.97 },
      { wordId: 'w-002', ordinal: 2, text: 'น่าน', sourceStartPts: 16_800, sourceEndPts: 28_800 },
    ],
  };
}

describe('transcript revision contract', () => {
  it('accepts immutable ASR evidence with stable native-PTS word timing', () => {
    expect(validateTranscriptRevision(validTranscript())).toEqual({ valid: true, errors: [] });
  });

  it('requires correction revisions to carry explicit immutable parent lineage', () => {
    const correction = validTranscript();
    correction.revisionKind = 'correction';
    correction.revisionId = 'transcript-revision:correction-v2';
    correction.parentRevisionId = 'transcript-revision:asr-v1';
    correction.words[2] = { ...correction.words[2], text: 'เมืองน่าน' };

    expect(validateTranscriptRevision(correction)).toEqual({ valid: true, errors: [] });

    delete correction.parentRevisionId;
    expect(validateTranscriptRevision(correction).errors).toContain('correction revision requires parentRevisionId');
  });

  it('rejects parent mutation semantics on root ASR revisions', () => {
    const transcript = validTranscript();
    transcript.parentRevisionId = 'older-revision';
    expect(validateTranscriptRevision(transcript).errors).toContain('asr revision must not have parentRevisionId');
  });

  it('rejects fractional, overlapping, duplicate and unstable word timing evidence', () => {
    const transcript = validTranscript();
    transcript.words = [
      { wordId: 'dup', ordinal: 1, text: 'หนึ่ง', sourceStartPts: 0.5, sourceEndPts: 9_600 },
      { wordId: 'dup', ordinal: 1, text: 'สอง', sourceStartPts: 9_000, sourceEndPts: 8_000 },
    ];

    const result = validateTranscriptRevision(transcript);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('ordinal must equal its zero-based position');
    expect(result.errors.join('\n')).toContain('sourceStartPts must be a safe integer');
    expect(result.errors.join('\n')).toContain('duplicate wordId dup');
    expect(result.errors.join('\n')).toContain('sourceEndPts must be greater than sourceStartPts');
    expect(result.errors.join('\n')).toContain('overlaps or is out of source order');
  });

  it('validates confidence as untrusted bounded model evidence', () => {
    const transcript = validTranscript();
    transcript.words[0] = { ...transcript.words[0], confidence: 1.01 };
    expect(validateTranscriptRevision(transcript).errors).toContain('words[0].confidence must be between 0 and 1 when present');
  });

  it('compares immutable audio source authority with rational normalization', () => {
    const source = validTranscript().source;
    expect(sameTranscriptSource(source, {
      ...source,
      timeBase: { numerator: 2, denominator: 96_000 },
    })).toBe(true);
    expect(sameTranscriptSource(source, {
      ...source,
      streamIndex: 0,
    })).toBe(false);
  });
});
