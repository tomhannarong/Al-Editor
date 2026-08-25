import {
  normalizeCanonicalRational,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateProxyDerivativeRevision,
  type ProxyDerivativeRevision,
} from '../../contracts/src/proxy-derivative.contract.js';

export class ProxyDerivativePersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyDerivativePersistenceInvariantError';
  }
}

export interface RegisterProxyDerivativeRevisionResult {
  revision: ProxyDerivativeRevision;
  created: boolean;
}

/**
 * Immutable metadata boundary for rebuildable proxy derivatives.
 *
 * revisionId is immutable evidence identity. Re-registering the same semantic
 * revision is idempotent; reusing that revisionId with changed source lineage,
 * profile/toolchain evidence, artifact location or creation evidence fails
 * closed. Rebuilding to different derivative state therefore creates a new
 * revision rather than mutating historical evidence.
 */
export interface ProxyDerivativeRevisionPersistence {
  registerRevision(candidate: ProxyDerivativeRevision): RegisterProxyDerivativeRevisionResult;
  getRevision(revisionId: string): ProxyDerivativeRevision | undefined;
}

export class InMemoryProxyDerivativeRevisionStore implements ProxyDerivativeRevisionPersistence {
  readonly #revisions = new Map<string, ProxyDerivativeRevision>();

  registerRevision(candidate: ProxyDerivativeRevision): RegisterProxyDerivativeRevisionResult {
    assertValidRevision(candidate);
    const normalizedCandidate = cloneNormalizedRevision(candidate);
    const existing = this.#revisions.get(candidate.revisionId);

    if (existing) {
      if (!sameImmutableProxyDerivativeRevision(existing, normalizedCandidate)) {
        throw new ProxyDerivativePersistenceInvariantError(
          `proxy derivative revisionId ${candidate.revisionId} conflicts with existing immutable revision`,
        );
      }
      return { revision: cloneNormalizedRevision(existing), created: false };
    }

    this.#revisions.set(normalizedCandidate.revisionId, normalizedCandidate);
    return { revision: cloneNormalizedRevision(normalizedCandidate), created: true };
  }

  getRevision(revisionId: string): ProxyDerivativeRevision | undefined {
    const stored = this.#revisions.get(revisionId);
    return stored ? cloneNormalizedRevision(stored) : undefined;
  }
}

export function sameImmutableProxyDerivativeRevision(
  left: ProxyDerivativeRevision,
  right: ProxyDerivativeRevision,
): boolean {
  const leftTimeBase = normalizeTimeBaseOrUndefined(left);
  const rightTimeBase = normalizeTimeBaseOrUndefined(right);
  if (!leftTimeBase || !rightTimeBase) return false;

  return left.schemaVersion === right.schemaVersion
    && left.derivativeId === right.derivativeId
    && left.revisionId === right.revisionId
    && left.source.sceneSetId === right.source.sceneSetId
    && left.source.sceneSetRevisionId === right.source.sceneSetRevisionId
    && left.source.assetId === right.source.assetId
    && left.source.streamId === right.source.streamId
    && left.source.streamIndex === right.source.streamIndex
    && leftTimeBase.numerator === rightTimeBase.numerator
    && leftTimeBase.denominator === rightTimeBase.denominator
    && left.derivativeProfileVersion === right.derivativeProfileVersion
    && left.toolchain.name === right.toolchain.name
    && left.toolchain.version === right.toolchain.version
    && left.artifactUri === right.artifactUri
    && left.createdAt === right.createdAt;
}

function assertValidRevision(candidate: ProxyDerivativeRevision): void {
  const validation = validateProxyDerivativeRevision(candidate);
  if (!validation.valid) {
    throw new ProxyDerivativePersistenceInvariantError(validation.errors.join('; '));
  }
}

function normalizeTimeBaseOrUndefined(revision: ProxyDerivativeRevision) {
  try {
    return normalizeCanonicalRational(revision.source.timeBase);
  } catch {
    return undefined;
  }
}

function cloneNormalizedRevision(revision: ProxyDerivativeRevision): ProxyDerivativeRevision {
  const timeBase = normalizeCanonicalRational(revision.source.timeBase);
  return {
    ...revision,
    source: {
      ...revision.source,
      timeBase: { ...timeBase },
    },
    toolchain: { ...revision.toolchain },
  };
}
