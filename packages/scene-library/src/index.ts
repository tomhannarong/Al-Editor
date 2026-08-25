import {
  normalizeCanonicalRational,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  sameSceneSourceMapping,
  validateSceneSetRevision,
  type SceneInterval,
  type SceneSetRevision,
} from '../../contracts/src/scene-set.contract.js';

export class SceneSetPersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneSetPersistenceInvariantError';
  }
}

export interface RegisterSceneSetRevisionResult {
  revision: SceneSetRevision;
  created: boolean;
}

/**
 * Immutable scene-set revision persistence boundary. A revisionId is global
 * immutable identity: exact semantic re-registration is idempotent, while any
 * attempt to reuse it with changed source mapping, detector evidence or scene
 * intervals fails closed.
 */
export interface SceneSetRevisionPersistence {
  registerRevision(candidate: SceneSetRevision): RegisterSceneSetRevisionResult;
  getRevision(revisionId: string): SceneSetRevision | undefined;
}

export class InMemorySceneSetRevisionStore implements SceneSetRevisionPersistence {
  readonly #revisions = new Map<string, SceneSetRevision>();

  registerRevision(candidate: SceneSetRevision): RegisterSceneSetRevisionResult {
    assertValidRevision(candidate);
    const normalizedCandidate = cloneNormalizedRevision(candidate);
    const existing = this.#revisions.get(candidate.revisionId);

    if (existing) {
      if (!sameImmutableSceneSetRevision(existing, normalizedCandidate)) {
        throw new SceneSetPersistenceInvariantError(
          `scene-set revisionId ${candidate.revisionId} conflicts with existing immutable revision`,
        );
      }
      return { revision: cloneNormalizedRevision(existing), created: false };
    }

    this.#revisions.set(normalizedCandidate.revisionId, normalizedCandidate);
    return { revision: cloneNormalizedRevision(normalizedCandidate), created: true };
  }

  getRevision(revisionId: string): SceneSetRevision | undefined {
    const stored = this.#revisions.get(revisionId);
    return stored ? cloneNormalizedRevision(stored) : undefined;
  }
}

export function sameImmutableSceneSetRevision(left: SceneSetRevision, right: SceneSetRevision): boolean {
  if (left.schemaVersion !== right.schemaVersion
    || left.sceneSetId !== right.sceneSetId
    || left.revisionId !== right.revisionId
    || left.detectorVersion !== right.detectorVersion
    || left.createdAt !== right.createdAt
    || !sameSceneSourceMapping(left.source, right.source)
    || left.scenes.length !== right.scenes.length) {
    return false;
  }

  return left.scenes.every((scene, index) => {
    const other = right.scenes[index];
    return other !== undefined && sameSceneInterval(scene, other);
  });
}

function assertValidRevision(candidate: SceneSetRevision): void {
  const validation = validateSceneSetRevision(candidate);
  if (!validation.valid) {
    throw new SceneSetPersistenceInvariantError(validation.errors.join('; '));
  }
}

function sameSceneInterval(left: SceneInterval, right: SceneInterval): boolean {
  return left.sceneId === right.sceneId
    && left.sourceStartPts === right.sourceStartPts
    && left.sourceEndPts === right.sourceEndPts;
}

function cloneNormalizedRevision(revision: SceneSetRevision): SceneSetRevision {
  const timeBase = normalizeCanonicalRational(revision.source.timeBase);
  return {
    ...revision,
    source: {
      ...revision.source,
      timeBase: { ...timeBase },
    },
    scenes: revision.scenes.map((scene) => ({ ...scene })),
  };
}
