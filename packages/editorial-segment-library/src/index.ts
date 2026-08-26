import {
  validateEditorialSegmentRevision,
  type EditorialSegment,
  type EditorialSegmentRevision,
} from '../../contracts/src/editorial-segment.contract.js';

export class EditorialSegmentPersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorialSegmentPersistenceInvariantError';
  }
}

export interface RegisterEditorialSegmentRevisionResult {
  revision: EditorialSegmentRevision;
  created: boolean;
}

/**
 * Immutable editorial-segment revision persistence boundary. revisionId is a
 * global immutable evidence identity: exact semantic re-registration is
 * idempotent, while changed transcript lineage, segment word references,
 * ordering or creation evidence fails closed before mutation.
 */
export interface EditorialSegmentRevisionPersistence {
  registerRevision(candidate: EditorialSegmentRevision): RegisterEditorialSegmentRevisionResult;
  getRevision(revisionId: string): EditorialSegmentRevision | undefined;
}

export class InMemoryEditorialSegmentRevisionStore implements EditorialSegmentRevisionPersistence {
  readonly #revisions = new Map<string, EditorialSegmentRevision>();

  registerRevision(candidate: EditorialSegmentRevision): RegisterEditorialSegmentRevisionResult {
    assertValidRevision(candidate);
    const normalizedCandidate = cloneRevision(candidate);
    const existing = this.#revisions.get(candidate.revisionId);

    if (existing) {
      if (!sameImmutableEditorialSegmentRevision(existing, normalizedCandidate)) {
        throw new EditorialSegmentPersistenceInvariantError(
          `editorial segment revisionId ${candidate.revisionId} conflicts with existing immutable revision`,
        );
      }
      return { revision: cloneRevision(existing), created: false };
    }

    this.#revisions.set(normalizedCandidate.revisionId, normalizedCandidate);
    return { revision: cloneRevision(normalizedCandidate), created: true };
  }

  getRevision(revisionId: string): EditorialSegmentRevision | undefined {
    const stored = this.#revisions.get(revisionId);
    return stored ? cloneRevision(stored) : undefined;
  }
}

export function sameImmutableEditorialSegmentRevision(
  left: EditorialSegmentRevision,
  right: EditorialSegmentRevision,
): boolean {
  if (left.schemaVersion !== right.schemaVersion
    || left.segmentSetId !== right.segmentSetId
    || left.revisionId !== right.revisionId
    || left.transcriptId !== right.transcriptId
    || left.transcriptRevisionId !== right.transcriptRevisionId
    || left.createdAt !== right.createdAt
    || left.segments.length !== right.segments.length) {
    return false;
  }

  return left.segments.every((segment, index) => {
    const other = right.segments[index];
    return other !== undefined && sameEditorialSegment(segment, other);
  });
}

function assertValidRevision(candidate: EditorialSegmentRevision): void {
  const validation = validateEditorialSegmentRevision(candidate);
  if (!validation.valid) {
    throw new EditorialSegmentPersistenceInvariantError(validation.errors.join('; '));
  }
}

function sameEditorialSegment(left: EditorialSegment, right: EditorialSegment): boolean {
  return left.segmentId === right.segmentId
    && left.ordinal === right.ordinal
    && left.startWordId === right.startWordId
    && left.endWordId === right.endWordId;
}

function cloneRevision(revision: EditorialSegmentRevision): EditorialSegmentRevision {
  return {
    ...revision,
    segments: revision.segments.map((segment) => ({ ...segment })),
  };
}
