import {
  normalizeCanonicalRational,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateKeyframeDerivativeRevision,
  type KeyframeDerivativeRevision,
} from '../../contracts/src/keyframe-derivative.contract.js';

export class KeyframeDerivativePersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyframeDerivativePersistenceInvariantError';
  }
}

export interface RegisterKeyframeDerivativeRevisionResult {
  revision: KeyframeDerivativeRevision;
  created: boolean;
}

/**
 * Immutable metadata boundary for rebuildable keyframe derivatives.
 *
 * revisionId is immutable evidence identity. Re-registering the same semantic
 * revision is idempotent; reusing that revisionId with changed source lineage,
 * frame selection/location evidence, profile/toolchain evidence or creation
 * evidence fails closed. Re-extraction therefore creates a new revision rather
 * than mutating historical evidence.
 */
export interface KeyframeDerivativeRevisionPersistence {
  registerRevision(candidate: KeyframeDerivativeRevision): RegisterKeyframeDerivativeRevisionResult;
  getRevision(revisionId: string): KeyframeDerivativeRevision | undefined;
}

export class InMemoryKeyframeDerivativeRevisionStore implements KeyframeDerivativeRevisionPersistence {
  readonly #revisions = new Map<string, KeyframeDerivativeRevision>();

  registerRevision(candidate: KeyframeDerivativeRevision): RegisterKeyframeDerivativeRevisionResult {
    assertValidRevision(candidate);
    const normalizedCandidate = cloneNormalizedRevision(candidate);
    const existing = this.#revisions.get(candidate.revisionId);

    if (existing) {
      if (!sameImmutableKeyframeDerivativeRevision(existing, normalizedCandidate)) {
        throw new KeyframeDerivativePersistenceInvariantError(
          `keyframe derivative revisionId ${candidate.revisionId} conflicts with existing immutable revision`,
        );
      }
      return { revision: cloneNormalizedRevision(existing), created: false };
    }

    this.#revisions.set(normalizedCandidate.revisionId, normalizedCandidate);
    return { revision: cloneNormalizedRevision(normalizedCandidate), created: true };
  }

  getRevision(revisionId: string): KeyframeDerivativeRevision | undefined {
    const stored = this.#revisions.get(revisionId);
    return stored ? cloneNormalizedRevision(stored) : undefined;
  }
}

export function sameImmutableKeyframeDerivativeRevision(
  left: KeyframeDerivativeRevision,
  right: KeyframeDerivativeRevision,
): boolean {
  const leftTimeBase = normalizeTimeBaseOrUndefined(left);
  const rightTimeBase = normalizeTimeBaseOrUndefined(right);
  if (!leftTimeBase || !rightTimeBase) return false;

  if (left.schemaVersion !== right.schemaVersion
    || left.derivativeId !== right.derivativeId
    || left.revisionId !== right.revisionId
    || left.source.sceneSetId !== right.source.sceneSetId
    || left.source.sceneSetRevisionId !== right.source.sceneSetRevisionId
    || left.source.sceneId !== right.source.sceneId
    || left.source.assetId !== right.source.assetId
    || left.source.streamId !== right.source.streamId
    || left.source.streamIndex !== right.source.streamIndex
    || leftTimeBase.numerator !== rightTimeBase.numerator
    || leftTimeBase.denominator !== rightTimeBase.denominator
    || left.derivativeProfileVersion !== right.derivativeProfileVersion
    || left.toolchain.name !== right.toolchain.name
    || left.toolchain.version !== right.toolchain.version
    || left.createdAt !== right.createdAt
    || left.frames.length !== right.frames.length) {
    return false;
  }

  return left.frames.every((frame, index) => {
    const other = right.frames[index];
    return other !== undefined
      && frame.frameId === other.frameId
      && frame.sourcePts === other.sourcePts
      && frame.artifactUri === other.artifactUri;
  });
}

function assertValidRevision(candidate: KeyframeDerivativeRevision): void {
  const validation = validateKeyframeDerivativeRevision(candidate);
  if (!validation.valid) {
    throw new KeyframeDerivativePersistenceInvariantError(validation.errors.join('; '));
  }
}

function normalizeTimeBaseOrUndefined(revision: KeyframeDerivativeRevision) {
  try {
    return normalizeCanonicalRational(revision.source.timeBase);
  } catch {
    return undefined;
  }
}

function cloneNormalizedRevision(revision: KeyframeDerivativeRevision): KeyframeDerivativeRevision {
  const timeBase = normalizeCanonicalRational(revision.source.timeBase);
  return {
    ...revision,
    source: {
      ...revision.source,
      timeBase: { ...timeBase },
    },
    toolchain: { ...revision.toolchain },
    frames: revision.frames.map((frame) => ({ ...frame })),
  };
}
