import {
  normalizeCanonicalRational,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  sameTranscriptSource,
  validateTranscriptRevision,
  type TranscriptRevision,
  type TranscriptWord,
} from '../../contracts/src/transcript.contract.js';

export class TranscriptPersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptPersistenceInvariantError';
  }
}

export interface RegisterTranscriptRevisionResult {
  revision: TranscriptRevision;
  created: boolean;
}

/**
 * Immutable transcript-revision persistence boundary. A revisionId is a global
 * immutable evidence identity: semantically identical re-registration is
 * idempotent, while any changed source, lineage, ASR or word evidence fails
 * closed before mutation.
 */
export interface TranscriptRevisionPersistence {
  registerRevision(candidate: TranscriptRevision): RegisterTranscriptRevisionResult;
  getRevision(revisionId: string): TranscriptRevision | undefined;
}

export class InMemoryTranscriptRevisionStore implements TranscriptRevisionPersistence {
  readonly #revisions = new Map<string, TranscriptRevision>();

  registerRevision(candidate: TranscriptRevision): RegisterTranscriptRevisionResult {
    assertValidRevision(candidate);
    const normalizedCandidate = cloneNormalizedRevision(candidate);
    const existing = this.#revisions.get(candidate.revisionId);

    if (existing) {
      if (!sameImmutableTranscriptRevision(existing, normalizedCandidate)) {
        throw new TranscriptPersistenceInvariantError(
          `transcript revisionId ${candidate.revisionId} conflicts with existing immutable revision`,
        );
      }
      return { revision: cloneNormalizedRevision(existing), created: false };
    }

    this.#revisions.set(normalizedCandidate.revisionId, normalizedCandidate);
    return { revision: cloneNormalizedRevision(normalizedCandidate), created: true };
  }

  getRevision(revisionId: string): TranscriptRevision | undefined {
    const stored = this.#revisions.get(revisionId);
    return stored ? cloneNormalizedRevision(stored) : undefined;
  }
}

export function sameImmutableTranscriptRevision(left: TranscriptRevision, right: TranscriptRevision): boolean {
  if (left.schemaVersion !== right.schemaVersion
    || left.transcriptId !== right.transcriptId
    || left.revisionId !== right.revisionId
    || left.revisionKind !== right.revisionKind
    || left.parentRevisionId !== right.parentRevisionId
    || left.asrModelVersion !== right.asrModelVersion
    || left.language !== right.language
    || left.createdAt !== right.createdAt
    || !sameTranscriptSource(left.source, right.source)
    || left.words.length !== right.words.length) {
    return false;
  }

  return left.words.every((word, index) => {
    const other = right.words[index];
    return other !== undefined && sameTranscriptWord(word, other);
  });
}

function assertValidRevision(candidate: TranscriptRevision): void {
  const validation = validateTranscriptRevision(candidate);
  if (!validation.valid) {
    throw new TranscriptPersistenceInvariantError(validation.errors.join('; '));
  }
}

function sameTranscriptWord(left: TranscriptWord, right: TranscriptWord): boolean {
  return left.wordId === right.wordId
    && left.ordinal === right.ordinal
    && left.text === right.text
    && left.sourceStartPts === right.sourceStartPts
    && left.sourceEndPts === right.sourceEndPts
    && left.confidence === right.confidence;
}

function cloneNormalizedRevision(revision: TranscriptRevision): TranscriptRevision {
  const timeBase = normalizeCanonicalRational(revision.source.timeBase);
  return {
    ...revision,
    source: {
      ...revision.source,
      timeBase: { ...timeBase },
    },
    words: revision.words.map((word) => ({ ...word })),
  };
}
