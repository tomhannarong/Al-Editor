import {
  DUPLICATE_CONTROL_RATIO_TOTAL_BASIS_POINTS,
  validateRetrievalDuplicateControlPolicy,
  type RetrievalDuplicateControlPolicy,
} from '../../contracts/src/retrieval-duplicate-control-policy.contract.js';
import type { IndexedSceneSourceLineage } from '../../contracts/src/indexed-scene-document.contract.js';
import type {
  ExecuteHybridRetrievalResult,
  HybridRetrievalResultItem,
} from './execution.js';

export interface ApplyRetrievalDuplicateControlInput {
  policy: RetrievalDuplicateControlPolicy;
  retrieval: ExecuteHybridRetrievalResult;
}

export interface SuppressedRetrievalDuplicate {
  sceneKey: string;
  suppressedBySceneKey: string;
  intervalIouBasisPoints: number;
}

export interface RetrievalDuplicateControlResult {
  policyRevisionId: string;
  hybridPolicyRevisionId: string;
  method: RetrievalDuplicateControlPolicy['method'];
  items: HybridRetrievalResultItem[];
  suppressed: SuppressedRetrievalDuplicate[];
}

export class RetrievalDuplicateControlInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetrievalDuplicateControlInvariantError';
  }
}

/**
 * Deterministic Phase-5 duplicate-control boundary.
 *
 * Candidates retain the hybrid-retrieval ranking order. A candidate is
 * suppressed only when an already-kept candidate maps to the same immutable
 * asset/stream lineage and their native-PTS interval IoU is strictly greater
 * than the policy threshold. This layer does not perform semantic/perceptual
 * duplicate detection, reranking or editorial scoring.
 */
export function applyRetrievalDuplicateControl(
  input: ApplyRetrievalDuplicateControlInput,
): RetrievalDuplicateControlResult {
  const policyValidation = validateRetrievalDuplicateControlPolicy(input.policy);
  if (!policyValidation.valid) {
    throw new RetrievalDuplicateControlInvariantError(
      `invalid retrieval duplicate-control policy: ${policyValidation.errors.join('; ')}`,
    );
  }
  if (input.policy.hybridPolicyRevisionId !== input.retrieval.policyRevisionId) {
    throw new RetrievalDuplicateControlInvariantError(
      'duplicate-control policy hybridPolicyRevisionId does not match retrieval policyRevisionId',
    );
  }

  const kept: HybridRetrievalResultItem[] = [];
  const suppressed: SuppressedRetrievalDuplicate[] = [];
  const seenSceneKeys = new Set<string>();

  for (const candidate of input.retrieval.items) {
    if (seenSceneKeys.has(candidate.sceneKey)) {
      throw new RetrievalDuplicateControlInvariantError(
        `retrieval result contains duplicate sceneKey ${candidate.sceneKey}`,
      );
    }
    seenSceneKeys.add(candidate.sceneKey);
    validateSourceInterval(candidate.source, candidate.sceneKey);

    const duplicate = findSuppressingCandidate(candidate, kept, input.policy);
    if (duplicate) {
      suppressed.push({
        sceneKey: candidate.sceneKey,
        suppressedBySceneKey: duplicate.item.sceneKey,
        intervalIouBasisPoints: duplicate.intervalIouBasisPoints,
      });
      continue;
    }

    if (kept.length < input.policy.maxResults) {
      kept.push(cloneItem(candidate));
    }
  }

  return {
    policyRevisionId: input.policy.revisionId,
    hybridPolicyRevisionId: input.policy.hybridPolicyRevisionId,
    method: input.policy.method,
    items: kept,
    suppressed,
  };
}

function findSuppressingCandidate(
  candidate: HybridRetrievalResultItem,
  kept: readonly HybridRetrievalResultItem[],
  policy: RetrievalDuplicateControlPolicy,
): { item: HybridRetrievalResultItem; intervalIouBasisPoints: number } | undefined {
  for (const existing of kept) {
    if (!sameAssetStream(existing.source, candidate.source)) continue;
    assertComparableSourceTimeBase(existing.source, candidate.source);
    const iouBasisPoints = intervalIouBasisPoints(existing.source, candidate.source);
    if (iouBasisPoints > policy.maxSameSourceIntervalIouBasisPoints) {
      return { item: existing, intervalIouBasisPoints: iouBasisPoints };
    }
  }
  return undefined;
}

function sameAssetStream(
  left: IndexedSceneSourceLineage,
  right: IndexedSceneSourceLineage,
): boolean {
  return left.assetId === right.assetId
    && left.streamId === right.streamId
    && left.streamIndex === right.streamIndex;
}

function assertComparableSourceTimeBase(
  left: IndexedSceneSourceLineage,
  right: IndexedSceneSourceLineage,
): void {
  if (
    left.sourceTimeBase.numerator !== right.sourceTimeBase.numerator
    || left.sourceTimeBase.denominator !== right.sourceTimeBase.denominator
  ) {
    throw new RetrievalDuplicateControlInvariantError(
      'same immutable asset/stream lineage has conflicting sourceTimeBase evidence',
    );
  }
}

function validateSourceInterval(source: IndexedSceneSourceLineage, sceneKey: string): void {
  if (
    !Number.isSafeInteger(source.sourceStartPts)
    || !Number.isSafeInteger(source.sourceEndPts)
    || source.sourceEndPts <= source.sourceStartPts
  ) {
    throw new RetrievalDuplicateControlInvariantError(
      `scene ${sceneKey} must have an ordered safe-integer native-PTS source interval`,
    );
  }
  if (
    !Number.isSafeInteger(source.sourceTimeBase.numerator)
    || !Number.isSafeInteger(source.sourceTimeBase.denominator)
    || source.sourceTimeBase.numerator <= 0
    || source.sourceTimeBase.denominator <= 0
  ) {
    throw new RetrievalDuplicateControlInvariantError(
      `scene ${sceneKey} must have a positive safe-integer rational sourceTimeBase`,
    );
  }
}

function intervalIouBasisPoints(
  left: IndexedSceneSourceLineage,
  right: IndexedSceneSourceLineage,
): number {
  const intersectionStart = Math.max(left.sourceStartPts, right.sourceStartPts);
  const intersectionEnd = Math.min(left.sourceEndPts, right.sourceEndPts);
  if (intersectionEnd <= intersectionStart) return 0;

  const intersection = BigInt(intersectionEnd - intersectionStart);
  const unionStart = Math.min(left.sourceStartPts, right.sourceStartPts);
  const unionEnd = Math.max(left.sourceEndPts, right.sourceEndPts);
  const union = BigInt(unionEnd - unionStart);
  const scaled = intersection * BigInt(DUPLICATE_CONTROL_RATIO_TOTAL_BASIS_POINTS);

  // Floor to integer basis points. Suppression uses strictly-greater-than the
  // configured threshold, so equality remains eligible by contract.
  return Number(scaled / union);
}

function cloneItem(item: HybridRetrievalResultItem): HybridRetrievalResultItem {
  return {
    ...item,
    source: {
      ...item.source,
      sourceTimeBase: { ...item.source.sourceTimeBase },
    },
    representationScores: item.representationScores.map((score) => ({ ...score })),
  };
}
