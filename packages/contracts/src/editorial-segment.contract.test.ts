import { describe, expect, it } from 'vitest';

import {
  EDITORIAL_SEGMENT_SCHEMA_VERSION,
  resolveEditorialSegmentsAgainstTranscript,
  validateEditorialSegmentRevision,
  type EditorialSegmentRevision,
} from './editorial-segment.contract.js';
import {
  TRANSCRIPT_SCHEMA_VERSION,
  type TranscriptRevision,
} from './transcript.contract.js';

const ASSET_ID = `sha256:${'e'.repeat(64)}`;

function transcript(): TranscriptRevision {
  return {
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    transcriptId: 'transcript:voiceover-001',
    revisionId: 'transcript-revision:correction-v2',
    source: {
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:1`,
      streamIndex: 1,
      timeBase: { numerator: 1, denominator: 48_000 },
    },
    revisionKind: 'correction',
    parentRevisionId: 'transcript-revision:asr-v1',
    asrModelVersion: 'whisper-local/1.0.0',
    language: 'th',
    createdAt: '2026-08-26T00:00:00.000Z',
    words: [
      { wordId: 'w-000', ordinal: 0, text: 'เรา', sourceStartPts: 0, sourceEndPts: 9_600 },
      { wordId: 'w-001', ordinal: 1, text: 'ไป', sourceStartPts: 9_600, sourceEndPts: 16_800 },
      { wordId: 'w-002', ordinal: 2, text: 'น่าน', sourceStartPts: 16_800, sourceEndPts: 28_800 },
      { wordId: 'w-003', ordinal: 3, text: 'กัน', sourceStartPts: 28_800, sourceEndPts: 38_400 },
    ],
  };
}

function segmentRevision(): EditorialSegmentRevision {
  return {
    schemaVersion: EDITORIAL_SEGMENT_SCHEMA_VERSION,
    segmentSetId: 'segment-set:voiceover-001',
    revisionId: 'segment-revision:v1',
    transcriptId: 'transcript:voiceover-001',
    transcriptRevisionId: 'transcript-revision:correction-v2',
    createdAt: '2026-08-26T01:00:00.000Z',
    segments: [
      { segmentId: 'segment:000', ordinal: 0, startWordId: 'w-000', endWordId: 'w-001' },
      { segmentId: 'segment:001', ordinal: 1, startWordId: 'w-002', endWordId: 'w-003' },
    ],
  };
}

describe('editorial segment contract', () => {
  it('accepts a versioned immutable grouping over stable transcript word identities', () => {
    expect(validateEditorialSegmentRevision(segmentRevision())).toEqual({ valid: true, errors: [] });
  });

  it('derives native PTS from the exact bound transcript revision instead of persisting segment timing', () => {
    const revision = segmentRevision();
    const result = resolveEditorialSegmentsAgainstTranscript(revision, transcript());

    expect(result.valid).toBe(true);
    expect(result.resolved).toEqual({
      segmentSetId: revision.segmentSetId,
      revisionId: revision.revisionId,
      transcriptId: revision.transcriptId,
      transcriptRevisionId: revision.transcriptRevisionId,
      sourceTimeBase: { numerator: 1, denominator: 48_000 },
      segments: [
        { ...revision.segments[0]!, sourceStartPts: 0, sourceEndPts: 16_800 },
        { ...revision.segments[1]!, sourceStartPts: 16_800, sourceEndPts: 38_400 },
      ],
    });
    expect('sourceStartPts' in revision.segments[0]!).toBe(false);
    expect('sourceEndPts' in revision.segments[0]!).toBe(false);
  });

  it('fails closed when transcript revision lineage does not match', () => {
    const revision = segmentRevision();
    revision.transcriptRevisionId = 'transcript-revision:stale';

    const result = resolveEditorialSegmentsAgainstTranscript(revision, transcript());
    expect(result.valid).toBe(false);
    expect(result.resolved).toBeNull();
    expect(result.errors).toContain('editorial segment transcriptRevisionId does not match transcript revision');
  });

  it('rejects missing, reversed, overlapping and out-of-order word references against the bound transcript', () => {
    const revision = segmentRevision();
    revision.segments = [
      { segmentId: 'segment:000', ordinal: 0, startWordId: 'w-002', endWordId: 'w-003' },
      { segmentId: 'segment:001', ordinal: 1, startWordId: 'w-001', endWordId: 'w-000' },
      { segmentId: 'segment:002', ordinal: 2, startWordId: 'missing', endWordId: 'w-003' },
    ];

    const result = resolveEditorialSegmentsAgainstTranscript(revision, transcript());
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('endWordId precedes startWordId');
    expect(result.errors.join('\n')).toContain('startWordId does not exist in bound transcript revision');
  });

  it('rejects duplicate segment identities and unstable ordinals structurally', () => {
    const revision = segmentRevision();
    revision.segments[1] = { ...revision.segments[1]!, segmentId: 'segment:000', ordinal: 5 };

    const result = validateEditorialSegmentRevision(revision);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duplicate segmentId segment:000');
    expect(result.errors).toContain('segments[1].ordinal must equal its zero-based position');
  });
});
