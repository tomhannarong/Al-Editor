import { normalizeCanonicalRational, type CanonicalRational } from './canonical-timeline.contract.js';

export const BASELINE_SCENE_RETRIEVAL_QUERY_SCHEMA_VERSION = '1.0' as const;

export interface BaselineSceneRetrievalScope {
  sceneSetId: string;
  sceneSetRevisionId: string;
  assetId: string;
  streamId: string;
  streamIndex: number;
  sourceTimeBase: CanonicalRational;
}

/**
 * Phase-4 baseline query contract. It intentionally describes only one textual
 * retrieval request plus exact scene-index scope. Hybrid signals, reranker
 * policy and editorial judgment belong to later phases and are absent here.
 */
export interface BaselineSceneRetrievalQuery {
  schemaVersion: typeof BASELINE_SCENE_RETRIEVAL_QUERY_SCHEMA_VERSION;
  queryId: string;
  revisionId: string;
  queryText: string;
  topK: number;
  scopes: BaselineSceneRetrievalScope[];
  createdAt: string;
}

export interface BaselineSceneRetrievalQueryValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_ASSET_ID = /^sha256:[a-f0-9]{64}$/;
const MAX_QUERY_TEXT_LENGTH = 4096;
const MAX_TOP_K = 100;

function scopeIdentity(scope: BaselineSceneRetrievalScope): string {
  const timeBase = normalizeCanonicalRational(scope.sourceTimeBase);
  return [
    scope.sceneSetId,
    scope.sceneSetRevisionId,
    scope.assetId,
    scope.streamId,
    String(scope.streamIndex),
    `${timeBase.numerator}/${timeBase.denominator}`,
  ].join('|');
}

export function validateBaselineSceneRetrievalQuery(
  query: BaselineSceneRetrievalQuery,
): BaselineSceneRetrievalQueryValidationResult {
  const errors: string[] = [];

  if (query.schemaVersion !== BASELINE_SCENE_RETRIEVAL_QUERY_SCHEMA_VERSION) {
    errors.push('unsupported baseline scene retrieval query schemaVersion');
  }
  if (!query.queryId.trim()) errors.push('queryId is required');
  if (!query.revisionId.trim()) errors.push('revisionId is required');
  if (!query.queryText.trim()) errors.push('queryText is required');
  if (query.queryText.length > MAX_QUERY_TEXT_LENGTH) {
    errors.push(`queryText must be at most ${MAX_QUERY_TEXT_LENGTH} characters`);
  }
  if (!Number.isSafeInteger(query.topK) || query.topK < 1 || query.topK > MAX_TOP_K) {
    errors.push(`topK must be a safe integer between 1 and ${MAX_TOP_K}`);
  }
  if (query.scopes.length === 0) errors.push('at least one exact scene-set scope is required');
  if (Number.isNaN(Date.parse(query.createdAt))) errors.push('createdAt must be an ISO-compatible timestamp');

  const seenScopes = new Set<string>();
  for (const [index, scope] of query.scopes.entries()) {
    if (!scope.sceneSetId.trim()) errors.push(`scopes[${index}].sceneSetId is required`);
    if (!scope.sceneSetRevisionId.trim()) errors.push(`scopes[${index}].sceneSetRevisionId is required`);
    if (!SHA256_ASSET_ID.test(scope.assetId)) {
      errors.push(`scopes[${index}].assetId must be a canonical sha256 asset identity`);
    }
    if (!scope.streamId.trim()) errors.push(`scopes[${index}].streamId is required`);
    if (!Number.isSafeInteger(scope.streamIndex) || scope.streamIndex < 0) {
      errors.push(`scopes[${index}].streamIndex must be a non-negative safe integer`);
    }

    try {
      const identity = scopeIdentity(scope);
      if (seenScopes.has(identity)) errors.push(`duplicate exact scene-set scope at scopes[${index}]`);
      seenScopes.add(identity);
    } catch (error) {
      errors.push(`invalid scopes[${index}].sourceTimeBase: ${String(error)}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Equality is defined only by exact indexed scene-set/source lineage after
 * rational normalization. Derived decimal time and storage locations are not
 * part of retrieval scope identity.
 */
export function sameBaselineSceneRetrievalScope(
  left: BaselineSceneRetrievalScope,
  right: BaselineSceneRetrievalScope,
): boolean {
  try {
    return scopeIdentity(left) === scopeIdentity(right);
  } catch {
    return false;
  }
}
