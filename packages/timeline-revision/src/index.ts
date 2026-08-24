import {
  validateCanonicalTimelineV2,
  type CanonicalTimelineAssetItemV2,
  type CanonicalTimelineV2,
} from '../../contracts/src/canonical-timeline.contract.js';

export const CANONICAL_SOURCE_WINDOW_EDITOR_VERSION = 'canonical-v2-source-window-editor-v1' as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export class CanonicalRevisionEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalRevisionEditError';
  }
}

export interface CanonicalSourceWindowEditV1 {
  itemId: string;
  sourceStartPts: number;
  sourceEndPts: number;
}

export interface CanonicalChildRevisionIdentityV1 {
  revisionId: string;
  manifestSha256: string;
  createdBy: string;
  createdAt: string;
}

/**
 * Creates a new immutable canonical-v2 child revision by shifting one source
 * window in its native PTS domain. Project frame placement is intentionally
 * unchanged; this editor rejects source-span changes so a trim/selection edit
 * cannot silently alter canonical project duration.
 */
export function createShiftedSourceRevisionV2(
  parent: Readonly<CanonicalTimelineV2>,
  edit: Readonly<CanonicalSourceWindowEditV1>,
  identity: Readonly<CanonicalChildRevisionIdentityV1>,
): CanonicalTimelineV2 {
  const parentValidation = validateCanonicalTimelineV2(parent as CanonicalTimelineV2);
  if (!parentValidation.valid) {
    throw new CanonicalRevisionEditError(`parent timeline is invalid: ${parentValidation.errors.join('; ')}`);
  }
  if (!identity.revisionId.trim() || identity.revisionId === parent.revisionId) {
    throw new CanonicalRevisionEditError('child revisionId must be new and non-empty');
  }
  if (!SHA256_PATTERN.test(identity.manifestSha256) || identity.manifestSha256.toLowerCase() === parent.manifestSha256.toLowerCase()) {
    throw new CanonicalRevisionEditError('child manifestSha256 must be a new SHA-256 digest');
  }
  if (!identity.createdBy.trim()) throw new CanonicalRevisionEditError('createdBy is required');
  const parentCreatedAt = Date.parse(parent.createdAt);
  const childCreatedAt = Date.parse(identity.createdAt);
  if (!Number.isFinite(childCreatedAt) || childCreatedAt < parentCreatedAt) {
    throw new CanonicalRevisionEditError('child createdAt must be valid and not earlier than parent');
  }
  if (!Number.isSafeInteger(edit.sourceStartPts) || !Number.isSafeInteger(edit.sourceEndPts) || edit.sourceEndPts <= edit.sourceStartPts) {
    throw new CanonicalRevisionEditError('edited source PTS range must use safe integers with end > start');
  }

  const child = structuredClone(parent) as CanonicalTimelineV2;
  const item = child.items.find((candidate): candidate is CanonicalTimelineAssetItemV2 =>
    candidate.itemId === edit.itemId && candidate.kind === 'asset-video',
  );
  if (!item) throw new CanonicalRevisionEditError(`asset-video item ${edit.itemId} was not found`);

  const parentSpan = item.source.sourceEndPts - item.source.sourceStartPts;
  const editedSpan = edit.sourceEndPts - edit.sourceStartPts;
  if (editedSpan !== parentSpan) {
    throw new CanonicalRevisionEditError('source-window edit must preserve the native PTS span');
  }

  item.source.sourceStartPts = edit.sourceStartPts;
  item.source.sourceEndPts = edit.sourceEndPts;
  child.parentRevisionId = parent.revisionId;
  child.revisionId = identity.revisionId;
  child.manifestSha256 = identity.manifestSha256.toLowerCase();
  child.createdBy = identity.createdBy;
  child.createdAt = identity.createdAt;

  const childValidation = validateCanonicalTimelineV2(child);
  if (!childValidation.valid) {
    throw new CanonicalRevisionEditError(`child timeline is invalid: ${childValidation.errors.join('; ')}`);
  }
  return deepFreeze(child);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
