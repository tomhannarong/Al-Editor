import { normalizeCanonicalRational, type CanonicalRational } from './canonical-timeline.contract.js';

export const TRANSCRIPT_SCHEMA_VERSION = '1.0' as const;

export interface TranscriptSourceMapping {
  assetId: string;
  streamId: string;
  streamIndex: number;
  timeBase: CanonicalRational;
}

export interface TranscriptWord {
  wordId: string;
  ordinal: number;
  text: string;
  sourceStartPts: number;
  sourceEndPts: number;
  confidence?: number;
}

export type TranscriptRevisionKind = 'asr' | 'correction';

/**
 * Immutable transcript evidence for one source audio stream. Word timing is
 * authoritative only in native integer PTS plus the source stream time base.
 * UI milliseconds/decimal seconds are derived values and deliberately absent.
 */
export interface TranscriptRevision {
  schemaVersion: typeof TRANSCRIPT_SCHEMA_VERSION;
  transcriptId: string;
  revisionId: string;
  source: TranscriptSourceMapping;
  revisionKind: TranscriptRevisionKind;
  parentRevisionId?: string;
  asrModelVersion: string;
  language: string;
  createdAt: string;
  words: TranscriptWord[];
}

export interface TranscriptValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_ASSET_ID = /^sha256:[a-f0-9]{64}$/;

export function validateTranscriptRevision(transcript: TranscriptRevision): TranscriptValidationResult {
  const errors: string[] = [];

  if (transcript.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION) errors.push('unsupported transcript schemaVersion');
  if (!transcript.transcriptId.trim()) errors.push('transcriptId is required');
  if (!transcript.revisionId.trim()) errors.push('revisionId is required');
  if (!transcript.asrModelVersion.trim()) errors.push('asrModelVersion is required');
  if (!transcript.language.trim()) errors.push('language is required');
  if (Number.isNaN(Date.parse(transcript.createdAt))) errors.push('createdAt must be an ISO-compatible timestamp');

  if (transcript.revisionKind === 'asr') {
    if (transcript.parentRevisionId !== undefined) errors.push('asr revision must not have parentRevisionId');
  } else if (transcript.revisionKind === 'correction') {
    if (!transcript.parentRevisionId?.trim()) errors.push('correction revision requires parentRevisionId');
    if (transcript.parentRevisionId === transcript.revisionId) errors.push('correction parentRevisionId must differ from revisionId');
  } else {
    errors.push('revisionKind must be asr or correction');
  }

  const source = transcript.source;
  if (!SHA256_ASSET_ID.test(source.assetId)) errors.push('source.assetId must be a canonical sha256 asset identity');
  if (!source.streamId.trim()) errors.push('source.streamId is required');
  if (!Number.isSafeInteger(source.streamIndex) || source.streamIndex < 0) {
    errors.push('source.streamIndex must be a non-negative safe integer');
  }
  try {
    normalizeCanonicalRational(source.timeBase);
  } catch (error) {
    errors.push(`invalid source.timeBase: ${String(error)}`);
  }

  const seenWordIds = new Set<string>();
  let previousEndPts: number | undefined;
  for (const [index, word] of transcript.words.entries()) {
    if (!word.wordId.trim()) errors.push(`words[${index}].wordId is required`);
    if (seenWordIds.has(word.wordId)) errors.push(`duplicate wordId ${word.wordId}`);
    seenWordIds.add(word.wordId);

    if (!Number.isSafeInteger(word.ordinal) || word.ordinal !== index) {
      errors.push(`words[${index}].ordinal must equal its zero-based position`);
    }
    if (!word.text.trim()) errors.push(`words[${index}].text is required`);
    if (!Number.isSafeInteger(word.sourceStartPts)) {
      errors.push(`words[${index}].sourceStartPts must be a safe integer`);
    }
    if (!Number.isSafeInteger(word.sourceEndPts)) {
      errors.push(`words[${index}].sourceEndPts must be a safe integer`);
    }
    if (Number.isSafeInteger(word.sourceStartPts) && Number.isSafeInteger(word.sourceEndPts)
      && word.sourceEndPts <= word.sourceStartPts) {
      errors.push(`words[${index}] sourceEndPts must be greater than sourceStartPts`);
    }
    if (previousEndPts !== undefined && Number.isSafeInteger(word.sourceStartPts)
      && word.sourceStartPts < previousEndPts) {
      errors.push(`words[${index}] overlaps or is out of source order`);
    }
    if (Number.isSafeInteger(word.sourceEndPts)) previousEndPts = word.sourceEndPts;

    if (word.confidence !== undefined
      && (!Number.isFinite(word.confidence) || word.confidence < 0 || word.confidence > 1)) {
      errors.push(`words[${index}].confidence must be between 0 and 1 when present`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Exact immutable source equality; rationally equivalent time bases compare equal. */
export function sameTranscriptSource(left: TranscriptSourceMapping, right: TranscriptSourceMapping): boolean {
  try {
    const leftTimeBase = normalizeCanonicalRational(left.timeBase);
    const rightTimeBase = normalizeCanonicalRational(right.timeBase);
    return left.assetId === right.assetId
      && left.streamId === right.streamId
      && left.streamIndex === right.streamIndex
      && leftTimeBase.numerator === rightTimeBase.numerator
      && leftTimeBase.denominator === rightTimeBase.denominator;
  } catch {
    return false;
  }
}
