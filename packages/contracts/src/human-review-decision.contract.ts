export const HUMAN_REVIEW_DECISION_SCHEMA_VERSION = '1.0' as const;

export type HumanReviewAction = 'accept' | 'replace' | 'trim' | 'lock';

export interface HumanReviewDecisionV1 {
  schemaVersion: typeof HUMAN_REVIEW_DECISION_SCHEMA_VERSION;
  decisionId: string;
  reviewSessionId: string;
  aiDecisionId: string;
  reviewedRevisionId: string;
  itemId: string;
  action: HumanReviewAction;
  resultingRevisionId?: string;
  reviewedBy: string;
  reviewedAt: string;
}

export interface HumanReviewDecisionValidationResult {
  valid: boolean;
  errors: string[];
}

function required(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Durable human-review evidence over an immutable canonical timeline revision.
 *
 * The UI is never persistence or timing authority. An accept decision records
 * review of the existing immutable revision. Replace/trim/lock decisions must
 * point at a distinct child revision created by the canonical revision layer;
 * this contract intentionally does not duplicate source PTS, project frames or
 * lock state from that canonical child revision.
 */
export function validateHumanReviewDecision(
  decision: HumanReviewDecisionV1,
): HumanReviewDecisionValidationResult {
  const errors: string[] = [];

  if (decision.schemaVersion !== HUMAN_REVIEW_DECISION_SCHEMA_VERSION) {
    errors.push('unsupported human-review decision schemaVersion');
  }
  if (!required(decision.decisionId)) errors.push('decisionId is required');
  if (!required(decision.reviewSessionId)) errors.push('reviewSessionId is required');
  if (!required(decision.aiDecisionId)) errors.push('aiDecisionId is required');
  if (!required(decision.reviewedRevisionId)) errors.push('reviewedRevisionId is required');
  if (!required(decision.itemId)) errors.push('itemId is required');
  if (!required(decision.reviewedBy)) errors.push('reviewedBy is required');
  if (Number.isNaN(Date.parse(decision.reviewedAt))) {
    errors.push('reviewedAt must be an ISO-compatible timestamp');
  }

  const supportedActions: readonly HumanReviewAction[] = ['accept', 'replace', 'trim', 'lock'];
  if (!supportedActions.includes(decision.action)) {
    errors.push('unsupported human-review action');
    return { valid: errors.length === 0, errors };
  }

  if (decision.action === 'accept') {
    if (decision.resultingRevisionId !== undefined) {
      errors.push('accept must not create a resulting revision');
    }
  } else {
    if (!decision.resultingRevisionId || !required(decision.resultingRevisionId)) {
      errors.push(`${decision.action} requires resultingRevisionId`);
    } else if (decision.resultingRevisionId === decision.reviewedRevisionId) {
      errors.push('resultingRevisionId must differ from reviewedRevisionId');
    }
  }

  return { valid: errors.length === 0, errors };
}
