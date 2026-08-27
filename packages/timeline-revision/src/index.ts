import {
  normalizeCanonicalRational,
  validateCanonicalTimelineV2,
  type CanonicalRational,
  type CanonicalSourceRangeV2,
  type CanonicalTimelineAssetItemV2,
  type CanonicalTimelineV2,
} from '../../contracts/src/canonical-timeline.contract.js';

export const CANONICAL_SOURCE_WINDOW_EDITOR_VERSION = 'canonical-v2-source-window-editor-v1' as const;
export const CANONICAL_HUMAN_REVIEW_EDITOR_VERSION = 'canonical-v2-human-review-editor-v1' as const;
export const CANONICAL_REVIEW_LOCK_SCHEMA_VERSION = 'canonical-review-lock-v1' as const;
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

export interface CanonicalReplacementSourceV1 {
  assetId: string;
  streamIndex: number;
  sourceStartPts: number;
  sourceEndPts: number;
  sourceTimeBase: CanonicalRational;
}

export interface CanonicalReplaceReviewEditV1 {
  action: 'replace';
  itemId: string;
  replacement: CanonicalReplacementSourceV1;
}

export interface CanonicalTrimReviewEditV1 {
  action: 'trim';
  itemId: string;
  startFrame: number;
  endFrame: number;
  sourceStartPts: number;
  sourceEndPts: number;
}

export interface CanonicalLockReviewEditV1 {
  action: 'lock';
  itemId: string;
}

export type CanonicalHumanReviewEditV1 = CanonicalReplaceReviewEditV1 | CanonicalTrimReviewEditV1 | CanonicalLockReviewEditV1;

export interface CanonicalReviewLockStateV1 {
  schemaVersion: typeof CANONICAL_REVIEW_LOCK_SCHEMA_VERSION;
  revisionId: string;
  lockedItemIds: readonly string[];
}

export interface CanonicalHumanReviewRevisionResultV1 {
  timeline: CanonicalTimelineV2;
  lockState: CanonicalReviewLockStateV1;
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
  validateParentAndIdentity(parent, identity);
  if (!Number.isSafeInteger(edit.sourceStartPts) || !Number.isSafeInteger(edit.sourceEndPts) || edit.sourceEndPts <= edit.sourceStartPts) {
    throw new CanonicalRevisionEditError('edited source PTS range must use safe integers with end > start');
  }

  const child = structuredClone(parent) as CanonicalTimelineV2;
  const item = findAssetVideoItem(child, edit.itemId);
  const parentSpan = item.source.sourceEndPts - item.source.sourceStartPts;
  const editedSpan = edit.sourceEndPts - edit.sourceStartPts;
  if (editedSpan !== parentSpan) {
    throw new CanonicalRevisionEditError('source-window edit must preserve the native PTS span');
  }

  item.source.sourceStartPts = edit.sourceStartPts;
  item.source.sourceEndPts = edit.sourceEndPts;
  applyChildIdentity(child, parent, identity);
  validateChild(child);
  return deepFreeze(child);
}

/**
 * Applies one reviewed replace/trim/lock action as an immutable canonical-v2
 * child revision. Review-lock state is revision-bound sidecar evidence rather
 * than timeline timing/source authority, and locked items reject later media
 * edits unless a future explicit unlock capability is versioned separately.
 */
export function createHumanReviewChildRevisionV2(
  parent: Readonly<CanonicalTimelineV2>,
  edit: Readonly<CanonicalHumanReviewEditV1>,
  identity: Readonly<CanonicalChildRevisionIdentityV1>,
  priorLockState?: Readonly<CanonicalReviewLockStateV1>,
): CanonicalHumanReviewRevisionResultV1 {
  validateParentAndIdentity(parent, identity);
  const normalizedLocks = normalizeLockState(parent, priorLockState);
  const child = structuredClone(parent) as CanonicalTimelineV2;
  const item = findAssetVideoItem(child, edit.itemId);

  if (edit.action !== 'lock' && normalizedLocks.includes(edit.itemId)) {
    throw new CanonicalRevisionEditError(`asset-video item ${edit.itemId} is review-locked`);
  }

  if (edit.action === 'replace') {
    applyReplacement(item, edit.replacement);
  } else if (edit.action === 'trim') {
    applyTrim(item, edit);
  }

  applyChildIdentity(child, parent, identity);
  validateChild(child);

  const nextLocks = edit.action === 'lock'
    ? [...new Set([...normalizedLocks, edit.itemId])].sort()
    : normalizedLocks;
  const lockState: CanonicalReviewLockStateV1 = deepFreeze({
    schemaVersion: CANONICAL_REVIEW_LOCK_SCHEMA_VERSION,
    revisionId: child.revisionId,
    lockedItemIds: nextLocks,
  });

  return deepFreeze({ timeline: deepFreeze(child), lockState });
}

function applyReplacement(item: CanonicalTimelineAssetItemV2, replacement: Readonly<CanonicalReplacementSourceV1>): void {
  if (!replacement.assetId.trim()) throw new CanonicalRevisionEditError('replacement assetId is required');
  validateSourceRange(replacement);
  if (replacement.assetId === item.assetId && sameSourceRange(item.source, replacement)) {
    throw new CanonicalRevisionEditError('replacement must change asset or source lineage');
  }
  if (!equalSourceDuration(item.source, replacement)) {
    throw new CanonicalRevisionEditError('replacement source duration must exactly match the reviewed item duration');
  }

  item.assetId = replacement.assetId;
  item.source = {
    streamIndex: replacement.streamIndex,
    sourceStartPts: replacement.sourceStartPts,
    sourceEndPts: replacement.sourceEndPts,
    sourceTimeBase: normalizeCanonicalRational(replacement.sourceTimeBase),
  };
}

function applyTrim(item: CanonicalTimelineAssetItemV2, edit: Readonly<CanonicalTrimReviewEditV1>): void {
  if (!Number.isSafeInteger(edit.startFrame) || !Number.isSafeInteger(edit.endFrame) || edit.endFrame <= edit.startFrame) {
    throw new CanonicalRevisionEditError('trim frame range must use safe integers with end > start');
  }
  if (!Number.isSafeInteger(edit.sourceStartPts) || !Number.isSafeInteger(edit.sourceEndPts) || edit.sourceEndPts <= edit.sourceStartPts) {
    throw new CanonicalRevisionEditError('trim source PTS range must use safe integers with end > start');
  }
  if (edit.startFrame < item.startFrame || edit.endFrame > item.endFrame || edit.sourceStartPts < item.source.sourceStartPts || edit.sourceEndPts > item.source.sourceEndPts) {
    throw new CanonicalRevisionEditError('trim must be a strict subset of the reviewed item frame/source ranges');
  }
  if (edit.startFrame === item.startFrame && edit.endFrame === item.endFrame && edit.sourceStartPts === item.source.sourceStartPts && edit.sourceEndPts === item.source.sourceEndPts) {
    throw new CanonicalRevisionEditError('trim must change at least one boundary');
  }

  const parentFrames = item.endFrame - item.startFrame;
  const childFrames = edit.endFrame - edit.startFrame;
  const parentPts = item.source.sourceEndPts - item.source.sourceStartPts;
  const childPts = edit.sourceEndPts - edit.sourceStartPts;
  if (!crossEqual(childPts, parentFrames, parentPts, childFrames)) {
    throw new CanonicalRevisionEditError('trim must preserve the exact source-PTS to project-frame rate');
  }

  const leftFrames = edit.startFrame - item.startFrame;
  const leftPts = edit.sourceStartPts - item.source.sourceStartPts;
  const rightFrames = item.endFrame - edit.endFrame;
  const rightPts = item.source.sourceEndPts - edit.sourceEndPts;
  if (!crossEqual(leftPts, parentFrames, parentPts, leftFrames) || !crossEqual(rightPts, parentFrames, parentPts, rightFrames)) {
    throw new CanonicalRevisionEditError('trim frame and native-PTS boundaries must move proportionally');
  }

  item.startFrame = edit.startFrame;
  item.endFrame = edit.endFrame;
  item.source.sourceStartPts = edit.sourceStartPts;
  item.source.sourceEndPts = edit.sourceEndPts;
}

function normalizeLockState(parent: Readonly<CanonicalTimelineV2>, state?: Readonly<CanonicalReviewLockStateV1>): string[] {
  if (!state) return [];
  if (state.schemaVersion !== CANONICAL_REVIEW_LOCK_SCHEMA_VERSION || state.revisionId !== parent.revisionId) {
    throw new CanonicalRevisionEditError('review lock state must be bound to the exact parent revision');
  }
  const seen = new Set<string>();
  for (const itemId of state.lockedItemIds) {
    if (!itemId.trim() || seen.has(itemId)) throw new CanonicalRevisionEditError('review lock item IDs must be non-empty and unique');
    if (!parent.items.some((item) => item.itemId === itemId)) throw new CanonicalRevisionEditError(`review lock item ${itemId} was not found`);
    seen.add(itemId);
  }
  return [...seen].sort();
}

function validateParentAndIdentity(parent: Readonly<CanonicalTimelineV2>, identity: Readonly<CanonicalChildRevisionIdentityV1>): void {
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
}

function applyChildIdentity(child: CanonicalTimelineV2, parent: Readonly<CanonicalTimelineV2>, identity: Readonly<CanonicalChildRevisionIdentityV1>): void {
  child.parentRevisionId = parent.revisionId;
  child.revisionId = identity.revisionId;
  child.manifestSha256 = identity.manifestSha256.toLowerCase();
  child.createdBy = identity.createdBy;
  child.createdAt = identity.createdAt;
}

function validateChild(child: CanonicalTimelineV2): void {
  const childValidation = validateCanonicalTimelineV2(child);
  if (!childValidation.valid) {
    throw new CanonicalRevisionEditError(`child timeline is invalid: ${childValidation.errors.join('; ')}`);
  }
}

function findAssetVideoItem(timeline: CanonicalTimelineV2, itemId: string): CanonicalTimelineAssetItemV2 {
  const item = timeline.items.find((candidate): candidate is CanonicalTimelineAssetItemV2 => candidate.itemId === itemId && candidate.kind === 'asset-video');
  if (!item) throw new CanonicalRevisionEditError(`asset-video item ${itemId} was not found`);
  return item;
}

function validateSourceRange(source: Readonly<CanonicalReplacementSourceV1>): void {
  if (!Number.isSafeInteger(source.streamIndex) || source.streamIndex < 0) throw new CanonicalRevisionEditError('replacement streamIndex must be a non-negative safe integer');
  if (!Number.isSafeInteger(source.sourceStartPts) || !Number.isSafeInteger(source.sourceEndPts) || source.sourceEndPts <= source.sourceStartPts) {
    throw new CanonicalRevisionEditError('replacement source PTS range must use safe integers with end > start');
  }
  try { normalizeCanonicalRational(source.sourceTimeBase); } catch (error) { throw new CanonicalRevisionEditError(`replacement sourceTimeBase is invalid: ${String(error)}`); }
}

function sameSourceRange(left: CanonicalSourceRangeV2, right: Readonly<CanonicalReplacementSourceV1>): boolean {
  const leftBase = normalizeCanonicalRational(left.sourceTimeBase);
  const rightBase = normalizeCanonicalRational(right.sourceTimeBase);
  return left.streamIndex === right.streamIndex
    && left.sourceStartPts === right.sourceStartPts
    && left.sourceEndPts === right.sourceEndPts
    && leftBase.numerator === rightBase.numerator
    && leftBase.denominator === rightBase.denominator;
}

function equalSourceDuration(left: CanonicalSourceRangeV2, right: Readonly<CanonicalReplacementSourceV1>): boolean {
  const leftBase = normalizeCanonicalRational(left.sourceTimeBase);
  const rightBase = normalizeCanonicalRational(right.sourceTimeBase);
  const leftSpan = BigInt(left.sourceEndPts - left.sourceStartPts);
  const rightSpan = BigInt(right.sourceEndPts - right.sourceStartPts);
  return leftSpan * BigInt(leftBase.numerator) * BigInt(rightBase.denominator)
    === rightSpan * BigInt(rightBase.numerator) * BigInt(leftBase.denominator);
}

function crossEqual(leftA: number, leftB: number, rightA: number, rightB: number): boolean {
  return BigInt(leftA) * BigInt(leftB) === BigInt(rightA) * BigInt(rightB);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
