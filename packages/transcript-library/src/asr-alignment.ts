import {
  normalizeCanonicalRational,
  type CanonicalRational,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  TRANSCRIPT_SCHEMA_VERSION,
  validateTranscriptRevision,
  type TranscriptRevision,
  type TranscriptSourceMapping,
} from '../../contracts/src/transcript.contract.js';
import { microsecondsToSourcePts } from '../../media-time/src/index.js';

export interface AlignedAsrWordInput {
  text: string;
  startMicroseconds: number;
  endMicroseconds: number;
  confidence?: number;
}

export interface AlignedAsrInput {
  transcriptId: string;
  revisionId: string;
  source: TranscriptSourceMapping;
  asrModelVersion: string;
  language: string;
  createdAt: string;
  words: AlignedAsrWordInput[];
}

export class AsrAlignmentNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AsrAlignmentNormalizationError';
  }
}

/**
 * Converts normalized provider/alignment timestamps into canonical native source
 * PTS before persistence. Integer microseconds are accepted only as an untrusted
 * adapter input; the returned immutable transcript contains no microsecond or
 * decimal-second timing authority.
 */
export function normalizeAlignedAsrInput(input: AlignedAsrInput): TranscriptRevision {
  assertInputShape(input);
  const timeBase = normalizeCanonicalRational(input.source.timeBase);

  const revision: TranscriptRevision = {
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    transcriptId: input.transcriptId,
    revisionId: input.revisionId,
    source: {
      ...input.source,
      timeBase: { ...timeBase },
    },
    revisionKind: 'asr',
    asrModelVersion: input.asrModelVersion,
    language: input.language,
    createdAt: input.createdAt,
    words: input.words.map((word, ordinal) => ({
      wordId: `${input.revisionId}:word:${ordinal}`,
      ordinal,
      text: word.text,
      sourceStartPts: microsecondsToSourcePts(
        word.startMicroseconds,
        timeBase,
        'nearest-half-away-from-zero',
      ),
      sourceEndPts: microsecondsToSourcePts(
        word.endMicroseconds,
        timeBase,
        'nearest-half-away-from-zero',
      ),
      ...(word.confidence === undefined ? {} : { confidence: word.confidence }),
    })),
  };

  const validation = validateTranscriptRevision(revision);
  if (!validation.valid) {
    throw new AsrAlignmentNormalizationError(validation.errors.join('; '));
  }

  return revision;
}

function assertInputShape(input: AlignedAsrInput): void {
  if (!input.transcriptId.trim()) throw new AsrAlignmentNormalizationError('transcriptId is required');
  if (!input.revisionId.trim()) throw new AsrAlignmentNormalizationError('revisionId is required');
  if (!input.asrModelVersion.trim()) throw new AsrAlignmentNormalizationError('asrModelVersion is required');
  if (!input.language.trim()) throw new AsrAlignmentNormalizationError('language is required');
  if (Number.isNaN(Date.parse(input.createdAt))) {
    throw new AsrAlignmentNormalizationError('createdAt must be an ISO-compatible timestamp');
  }

  let previousEndMicroseconds: number | undefined;
  for (const [index, word] of input.words.entries()) {
    if (!word.text.trim()) throw new AsrAlignmentNormalizationError(`words[${index}].text is required`);
    assertMicroseconds(word.startMicroseconds, `words[${index}].startMicroseconds`);
    assertMicroseconds(word.endMicroseconds, `words[${index}].endMicroseconds`);
    if (word.endMicroseconds <= word.startMicroseconds) {
      throw new AsrAlignmentNormalizationError(
        `words[${index}].endMicroseconds must be greater than startMicroseconds`,
      );
    }
    if (previousEndMicroseconds !== undefined && word.startMicroseconds < previousEndMicroseconds) {
      throw new AsrAlignmentNormalizationError(`words[${index}] overlaps or is out of source order`);
    }
    if (word.confidence !== undefined
      && (!Number.isFinite(word.confidence) || word.confidence < 0 || word.confidence > 1)) {
      throw new AsrAlignmentNormalizationError(`words[${index}].confidence must be between 0 and 1 when present`);
    }
    previousEndMicroseconds = word.endMicroseconds;
  }
}

function assertMicroseconds(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new AsrAlignmentNormalizationError(`${name} must be a safe integer`);
  }
}
