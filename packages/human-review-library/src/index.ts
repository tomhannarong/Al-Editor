import {
  validateHumanReviewDecision,
  type HumanReviewDecisionV1,
} from '../../contracts/src/human-review-decision.contract.js';

export class HumanReviewDecisionPersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HumanReviewDecisionPersistenceInvariantError';
  }
}

export interface RegisterHumanReviewDecisionResult {
  decision: HumanReviewDecisionV1;
  created: boolean;
}

/**
 * Immutable human-review decision persistence boundary.
 *
 * decisionId is an immutable evidence identity. Exact semantic
 * re-registration is idempotent; changed review lineage/action/result evidence
 * under the same decisionId fails closed before mutation. Canonical timeline
 * timing/source semantics stay in the referenced immutable revisions rather
 * than being duplicated here.
 */
export interface HumanReviewDecisionPersistence {
  registerDecision(candidate: HumanReviewDecisionV1): RegisterHumanReviewDecisionResult;
  getDecision(decisionId: string): HumanReviewDecisionV1 | undefined;
}

export class InMemoryHumanReviewDecisionStore implements HumanReviewDecisionPersistence {
  readonly #decisions = new Map<string, HumanReviewDecisionV1>();

  registerDecision(candidate: HumanReviewDecisionV1): RegisterHumanReviewDecisionResult {
    assertValidDecision(candidate);
    const normalizedCandidate = cloneDecision(candidate);
    const existing = this.#decisions.get(candidate.decisionId);

    if (existing) {
      if (!sameImmutableHumanReviewDecision(existing, normalizedCandidate)) {
        throw new HumanReviewDecisionPersistenceInvariantError(
          `human review decisionId ${candidate.decisionId} conflicts with existing immutable decision`,
        );
      }
      return { decision: cloneDecision(existing), created: false };
    }

    this.#decisions.set(normalizedCandidate.decisionId, normalizedCandidate);
    return { decision: cloneDecision(normalizedCandidate), created: true };
  }

  getDecision(decisionId: string): HumanReviewDecisionV1 | undefined {
    const stored = this.#decisions.get(decisionId);
    return stored ? cloneDecision(stored) : undefined;
  }
}

export function sameImmutableHumanReviewDecision(
  left: HumanReviewDecisionV1,
  right: HumanReviewDecisionV1,
): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.decisionId === right.decisionId
    && left.reviewSessionId === right.reviewSessionId
    && left.aiDecisionId === right.aiDecisionId
    && left.reviewedRevisionId === right.reviewedRevisionId
    && left.itemId === right.itemId
    && left.action === right.action
    && left.resultingRevisionId === right.resultingRevisionId
    && left.reviewedBy === right.reviewedBy
    && left.reviewedAt === right.reviewedAt;
}

function assertValidDecision(candidate: HumanReviewDecisionV1): void {
  const validation = validateHumanReviewDecision(candidate);
  if (!validation.valid) {
    throw new HumanReviewDecisionPersistenceInvariantError(validation.errors.join('; '));
  }
}

function cloneDecision(decision: HumanReviewDecisionV1): HumanReviewDecisionV1 {
  return { ...decision };
}
