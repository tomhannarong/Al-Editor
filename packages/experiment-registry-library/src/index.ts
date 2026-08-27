import {
  validateExperimentRegistryRevisionV1,
  type ExperimentRegistryRevisionV1,
} from '../../contracts/src/experiment-registry.contract.js';

export class ExperimentRegistryPersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExperimentRegistryPersistenceInvariantError';
  }
}

export interface RegisterExperimentRevisionResult {
  revision: ExperimentRegistryRevisionV1;
  created: boolean;
}

/**
 * Immutable metadata boundary for Phase-9 experiment evidence.
 *
 * revisionId is immutable evidence identity. Exact semantic re-registration is
 * idempotent. Reusing revisionId with changed benchmark/control, candidate
 * registry identities, evaluation/result evidence or timestamps fails closed.
 * Raw model/prompt/benchmark/result payloads intentionally remain outside this
 * store; the experiment revision keeps only pinned registry/evidence refs.
 */
export interface ExperimentRegistryPersistence {
  registerRevision(candidate: ExperimentRegistryRevisionV1): RegisterExperimentRevisionResult;
  getRevision(revisionId: string): ExperimentRegistryRevisionV1 | undefined;
}

export class InMemoryExperimentRegistryStore implements ExperimentRegistryPersistence {
  readonly #revisions = new Map<string, ExperimentRegistryRevisionV1>();

  registerRevision(candidate: ExperimentRegistryRevisionV1): RegisterExperimentRevisionResult {
    assertValidRevision(candidate);
    const normalizedCandidate = cloneRevision(candidate);
    const existing = this.#revisions.get(candidate.revisionId);

    if (existing) {
      if (!sameImmutableExperimentRevision(existing, normalizedCandidate)) {
        throw new ExperimentRegistryPersistenceInvariantError(
          `experiment revisionId ${candidate.revisionId} conflicts with existing immutable evidence`,
        );
      }
      return { revision: cloneRevision(existing), created: false };
    }

    this.#revisions.set(normalizedCandidate.revisionId, normalizedCandidate);
    return { revision: cloneRevision(normalizedCandidate), created: true };
  }

  getRevision(revisionId: string): ExperimentRegistryRevisionV1 | undefined {
    const stored = this.#revisions.get(revisionId);
    return stored ? cloneRevision(stored) : undefined;
  }
}

export function sameImmutableExperimentRevision(
  left: ExperimentRegistryRevisionV1,
  right: ExperimentRegistryRevisionV1,
): boolean {
  return JSON.stringify(cloneRevision(left)) === JSON.stringify(cloneRevision(right));
}

function assertValidRevision(candidate: ExperimentRegistryRevisionV1): void {
  const validation = validateExperimentRegistryRevisionV1(candidate);
  if (!validation.valid) {
    throw new ExperimentRegistryPersistenceInvariantError(validation.errors.join('; '));
  }
}

function cloneRevision(revision: ExperimentRegistryRevisionV1): ExperimentRegistryRevisionV1 {
  const candidate = {
    policy: { ...revision.candidate.policy },
    model: { ...revision.candidate.model },
    executionProfile: { ...revision.candidate.executionProfile },
    ...(revision.candidate.prompt === undefined ? {} : { prompt: { ...revision.candidate.prompt } }),
  };

  return {
    ...revision,
    benchmarkControl: { ...revision.benchmarkControl },
    candidate,
    evaluation: { ...revision.evaluation },
  };
}
