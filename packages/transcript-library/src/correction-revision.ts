import {
  normalizeCanonicalRational,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateTranscriptRevision,
  type TranscriptRevision,
} from '../../contracts/src/transcript.contract.js';

export interface TranscriptWordCorrection {
  wordId: string;
  text: string;
}

export interface BuildTranscriptCorrectionRevisionInput {
  parent: TranscriptRevision;
  revisionId: string;
  createdAt: string;
  corrections: readonly TranscriptWordCorrection[];
}

export class TranscriptCorrectionRevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptCorrectionRevisionError';
  }
}

/**
 * Builds an additive immutable correction revision from an already immutable
 * parent transcript. Corrections may change word text only: source mapping,
 * word identity/order/native PTS and existing model confidence evidence are
 * preserved exactly from the parent. Timing remains authoritative only as
 * native integer PTS plus the source rational time base.
 */
export function buildTranscriptCorrectionRevision(
  input: BuildTranscriptCorrectionRevisionInput,
): TranscriptRevision {
  const parentValidation = validateTranscriptRevision(input.parent);
  if (!parentValidation.valid) {
    throw new TranscriptCorrectionRevisionError(
      `parent transcript is invalid: ${parentValidation.errors.join('; ')}`,
    );
  }

  if (!input.revisionId.trim()) {
    throw new TranscriptCorrectionRevisionError('revisionId is required');
  }
  if (input.revisionId === input.parent.revisionId) {
    throw new TranscriptCorrectionRevisionError('correction revisionId must differ from parent revisionId');
  }
  if (Number.isNaN(Date.parse(input.createdAt))) {
    throw new TranscriptCorrectionRevisionError('createdAt must be an ISO-compatible timestamp');
  }
  if (input.corrections.length === 0) {
    throw new TranscriptCorrectionRevisionError('at least one word correction is required');
  }

  const parentWordIds = new Set(input.parent.words.map((word) => word.wordId));
  const corrections = new Map<string, string>();
  for (const [index, correction] of input.corrections.entries()) {
    if (!correction.wordId.trim()) {
      throw new TranscriptCorrectionRevisionError(`corrections[${index}].wordId is required`);
    }
    if (!correction.text.trim()) {
      throw new TranscriptCorrectionRevisionError(`corrections[${index}].text is required`);
    }
    if (!parentWordIds.has(correction.wordId)) {
      throw new TranscriptCorrectionRevisionError(
        `corrections[${index}].wordId ${correction.wordId} does not exist in parent revision`,
      );
    }
    if (corrections.has(correction.wordId)) {
      throw new TranscriptCorrectionRevisionError(`duplicate correction wordId ${correction.wordId}`);
    }
    corrections.set(correction.wordId, correction.text);
  }

  let changed = false;
  const words = input.parent.words.map((word) => {
    const correctedText = corrections.get(word.wordId);
    if (correctedText !== undefined && correctedText !== word.text) changed = true;
    return {
      ...word,
      ...(correctedText === undefined ? {} : { text: correctedText }),
    };
  });

  if (!changed) {
    throw new TranscriptCorrectionRevisionError('correction revision must change at least one word text');
  }

  const timeBase = normalizeCanonicalRational(input.parent.source.timeBase);
  const revision: TranscriptRevision = {
    schemaVersion: input.parent.schemaVersion,
    transcriptId: input.parent.transcriptId,
    revisionId: input.revisionId,
    source: {
      ...input.parent.source,
      timeBase: { ...timeBase },
    },
    revisionKind: 'correction',
    parentRevisionId: input.parent.revisionId,
    asrModelVersion: input.parent.asrModelVersion,
    language: input.parent.language,
    createdAt: input.createdAt,
    words,
  };

  const validation = validateTranscriptRevision(revision);
  if (!validation.valid) {
    throw new TranscriptCorrectionRevisionError(validation.errors.join('; '));
  }

  return revision;
}
