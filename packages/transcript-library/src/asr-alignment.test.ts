import { describe, expect, it } from 'vitest';
import type { TranscriptSourceMapping } from '../../contracts/src/transcript.contract.js';
import {
  AsrAlignmentNormalizationError,
  normalizeAlignedAsrInput,
  type AlignedAsrInput,
} from './asr-alignment.js';

const source: TranscriptSourceMapping = {
  assetId: `sha256:${'a'.repeat(64)}`,
  streamId: 'audio-main',
  streamIndex: 1,
  timeBase: { numerator: 2, denominator: 180000 },
};

function fixture(overrides: Partial<AlignedAsrInput> = {}): AlignedAsrInput {
  return {
    transcriptId: 'transcript-001',
    revisionId: 'transcript-rev-asr-001',
    source,
    asrModelVersion: 'asr-model-v1',
    language: 'th',
    createdAt: '2026-08-26T05:00:00.000Z',
    words: [
      { text: 'สวัสดี', startMicroseconds: 0, endMicroseconds: 500000, confidence: 0.98 },
      { text: 'ค่ะ', startMicroseconds: 500000, endMicroseconds: 1000000, confidence: 0.95 },
    ],
    ...overrides,
  };
}

describe('normalizeAlignedAsrInput', () => {
  it('normalizes aligned microseconds into native PTS with deterministic stable word identities', () => {
    const revision = normalizeAlignedAsrInput(fixture());

    expect(revision.revisionKind).toBe('asr');
    expect(revision.source.timeBase).toEqual({ numerator: 1, denominator: 90000 });
    expect(revision.words).toEqual([
      {
        wordId: 'transcript-rev-asr-001:word:0',
        ordinal: 0,
        text: 'สวัสดี',
        sourceStartPts: 0,
        sourceEndPts: 45000,
        confidence: 0.98,
      },
      {
        wordId: 'transcript-rev-asr-001:word:1',
        ordinal: 1,
        text: 'ค่ะ',
        sourceStartPts: 45000,
        sourceEndPts: 90000,
        confidence: 0.95,
      },
    ]);
    expect('startMicroseconds' in revision.words[0]!).toBe(false);
    expect('endMicroseconds' in revision.words[0]!).toBe(false);
  });

  it('is deterministic for identical aligned evidence', () => {
    expect(normalizeAlignedAsrInput(fixture())).toEqual(normalizeAlignedAsrInput(fixture()));
  });

  it('rejects fractional or overlapping provider timing before canonicalization', () => {
    const fractional = fixture({
      words: [{ text: 'bad', startMicroseconds: 0.5, endMicroseconds: 1000 }],
    });
    expect(() => normalizeAlignedAsrInput(fractional)).toThrow(AsrAlignmentNormalizationError);

    const overlapping = fixture({
      words: [
        { text: 'one', startMicroseconds: 0, endMicroseconds: 500000 },
        { text: 'two', startMicroseconds: 499999, endMicroseconds: 800000 },
      ],
    });
    expect(() => normalizeAlignedAsrInput(overlapping)).toThrow('overlaps or is out of source order');
  });

  it('fails closed when quantization would collapse a word interval', () => {
    const tooShort = fixture({
      words: [{ text: 'tiny', startMicroseconds: 0, endMicroseconds: 1 }],
    });

    expect(() => normalizeAlignedAsrInput(tooShort)).toThrow('sourceEndPts must be greater than sourceStartPts');
  });

  it('rejects invalid confidence as untrusted model evidence', () => {
    const invalid = fixture({
      words: [{ text: 'bad', startMicroseconds: 0, endMicroseconds: 500000, confidence: 1.01 }],
    });

    expect(() => normalizeAlignedAsrInput(invalid)).toThrow('confidence must be between 0 and 1');
  });
});
