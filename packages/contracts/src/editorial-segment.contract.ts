import { type CanonicalRational } from './canonical-timeline.contract.js';
import {
  validateTranscriptRevision,
  type TranscriptRevision,
} from './transcript.contract.js';

export const EDITORIAL_SEGMENT_SCHEMA_VERSION = '1.0' as const;

/**
 * Editorial segmentation is an immutable grouping of transcript words. It does
 * not persist a second copy of source timing: stable word identities are the
 * authority link and native PTS is derived from the bound transcript revision.
 */
export interface EditorialSegment {
  segmentId: string;
  ordinal: number;
  startWordId: string;
  endWordId: string;
}

export interface EditorialSegmentRevision {
  schemaVersion: typeof EDITORIAL_SEGMENT_SCHEMA_VERSION;
  segmentSetId: string;
  revisionId: string;
  transcriptId: string;
  transcriptRevisionId: string;
  createdAt: string;
  segments: EditorialSegment[];
}

export interface EditorialSegmentValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ResolvedEditorialSegment extends EditorialSegment {
  sourceStartPts: number;
  sourceEndPts: number;
}

export interface ResolvedEditorialSegmentRevision {
  segmentSetId: string;
  revisionId: string;
  transcriptId: string;
  transcriptRevisionId: string;
  sourceTimeBase: CanonicalRational;
  segments: ResolvedEditorialSegment[];
}

export interface EditorialSegmentResolutionResult extends EditorialSegmentValidationResult {
  resolved: ResolvedEditorialSegmentRevision | null;
}

export function validateEditorialSegmentRevision(
  revision: EditorialSegmentRevision,
): EditorialSegmentValidationResult {
  const errors: string[] = [];

  if (revision.schemaVersion !== EDITORIAL_SEGMENT_SCHEMA_VERSION) {
    errors.push('unsupported editorial segment schemaVersion');
  }
  if (!revision.segmentSetId.trim()) errors.push('segmentSetId is required');
  if (!revision.revisionId.trim()) errors.push('revisionId is required');
  if (!revision.transcriptId.trim()) errors.push('transcriptId is required');
  if (!revision.transcriptRevisionId.trim()) errors.push('transcriptRevisionId is required');
  if (Number.isNaN(Date.parse(revision.createdAt))) errors.push('createdAt must be an ISO-compatible timestamp');

  const seenSegmentIds = new Set<string>();
  for (const [index, segment] of revision.segments.entries()) {
    if (!segment.segmentId.trim()) errors.push(`segments[${index}].segmentId is required`);
    if (seenSegmentIds.has(segment.segmentId)) errors.push(`duplicate segmentId ${segment.segmentId}`);
    seenSegmentIds.add(segment.segmentId);

    if (!Number.isSafeInteger(segment.ordinal) || segment.ordinal !== index) {
      errors.push(`segments[${index}].ordinal must equal its zero-based position`);
    }
    if (!segment.startWordId.trim()) errors.push(`segments[${index}].startWordId is required`);
    if (!segment.endWordId.trim()) errors.push(`segments[${index}].endWordId is required`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Resolve editorial word references against the exact immutable transcript
 * revision. Returned PTS/time-base values are derived read state, never a
 * second canonical timing record.
 */
export function resolveEditorialSegmentsAgainstTranscript(
  revision: EditorialSegmentRevision,
  transcript: TranscriptRevision,
): EditorialSegmentResolutionResult {
  const segmentValidation = validateEditorialSegmentRevision(revision);
  const transcriptValidation = validateTranscriptRevision(transcript);
  const errors = [...segmentValidation.errors];

  if (!transcriptValidation.valid) {
    errors.push(...transcriptValidation.errors.map((error) => `invalid transcript: ${error}`));
  }
  if (revision.transcriptId !== transcript.transcriptId) {
    errors.push('editorial segment transcriptId does not match transcript');
  }
  if (revision.transcriptRevisionId !== transcript.revisionId) {
    errors.push('editorial segment transcriptRevisionId does not match transcript revision');
  }

  const wordIndexById = new Map(transcript.words.map((word, index) => [word.wordId, index] as const));
  const resolvedSegments: ResolvedEditorialSegment[] = [];
  let previousEndWordIndex: number | undefined;

  for (const [index, segment] of revision.segments.entries()) {
    const startWordIndex = wordIndexById.get(segment.startWordId);
    const endWordIndex = wordIndexById.get(segment.endWordId);

    if (startWordIndex === undefined) {
      errors.push(`segments[${index}].startWordId does not exist in bound transcript revision`);
    }
    if (endWordIndex === undefined) {
      errors.push(`segments[${index}].endWordId does not exist in bound transcript revision`);
    }
    if (startWordIndex === undefined || endWordIndex === undefined) continue;

    if (endWordIndex < startWordIndex) {
      errors.push(`segments[${index}] endWordId precedes startWordId`);
      continue;
    }
    if (previousEndWordIndex !== undefined && startWordIndex <= previousEndWordIndex) {
      errors.push(`segments[${index}] overlaps or is out of transcript word order`);
      continue;
    }

    const startWord = transcript.words[startWordIndex];
    const endWord = transcript.words[endWordIndex];
    if (startWord === undefined || endWord === undefined) continue;

    resolvedSegments.push({
      ...segment,
      sourceStartPts: startWord.sourceStartPts,
      sourceEndPts: endWord.sourceEndPts,
    });
    previousEndWordIndex = endWordIndex;
  }

  if (errors.length > 0) return { valid: false, errors, resolved: null };

  return {
    valid: true,
    errors: [],
    resolved: {
      segmentSetId: revision.segmentSetId,
      revisionId: revision.revisionId,
      transcriptId: revision.transcriptId,
      transcriptRevisionId: revision.transcriptRevisionId,
      sourceTimeBase: { ...transcript.source.timeBase },
      segments: resolvedSegments,
    },
  };
}
