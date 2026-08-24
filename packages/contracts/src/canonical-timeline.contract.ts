export const CANONICAL_TIMELINE_V1_SCHEMA_VERSION = '1.0' as const;
export const CANONICAL_TIMELINE_V2_SCHEMA_VERSION = '2.0' as const;

export interface CanonicalRational {
  numerator: number;
  denominator: number;
}

export interface CanonicalSourceRangeV2 {
  streamIndex: number;
  sourceStartPts: number;
  sourceEndPts: number;
  sourceTimeBase: CanonicalRational;
}

export interface CanonicalTimelineItemBase {
  itemId: string;
  trackId: string;
  startFrame: number;
  endFrame: number;
}

export interface CanonicalTimelineAssetItemV2 extends CanonicalTimelineItemBase {
  kind: 'asset-video' | 'source-audio';
  assetId: string;
  source: CanonicalSourceRangeV2;
  playbackRate: CanonicalRational;
}

export interface CanonicalTimelineMarkerItemV2 extends CanonicalTimelineItemBase {
  kind: 'graphic' | 'caption' | 'voiceover' | 'music' | 'sfx';
  text?: string;
}

export type CanonicalTimelineItemV2 = CanonicalTimelineAssetItemV2 | CanonicalTimelineMarkerItemV2;

export interface CanonicalTimelineV2 {
  schemaVersion: typeof CANONICAL_TIMELINE_V2_SCHEMA_VERSION;
  timelineId: string;
  revisionId: string;
  projectId: string;
  parentRevisionId?: string;
  frameRate: CanonicalRational;
  durationFrames: number;
  items: readonly CanonicalTimelineItemV2[];
  deliveryProfileVersion: string;
  styleProfileVersion?: string;
  manifestSha256: string;
  createdBy: string;
  createdAt: string;
}

/** Compatibility-only historical v1 representation. Decimal-second fields remain readable but are never authoritative for v2. */
export interface CanonicalTimelineItemV1 {
  itemId: string;
  trackId: string;
  startFrame: number;
  endFrame: number;
  startSecond: number;
  endSecond: number;
  assetId?: string;
  sourceStartSecond?: number;
  sourceEndSecond?: number;
}

export interface CanonicalTimelineV1 {
  schemaVersion: typeof CANONICAL_TIMELINE_V1_SCHEMA_VERSION;
  timelineId: string;
  projectId: string;
  frameRate: number;
  durationFrames: number;
  durationSeconds: number;
  items: readonly CanonicalTimelineItemV1[];
  manifestSha256: string;
  createdBy: string;
  createdAt: string;
}

export type ReadableCanonicalTimeline = CanonicalTimelineV1 | CanonicalTimelineV2;

export interface CanonicalTimelineValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function normalizeCanonicalRational(value: CanonicalRational): CanonicalRational {
  if (!Number.isSafeInteger(value.numerator) || !Number.isSafeInteger(value.denominator)) {
    throw new TypeError('Canonical rational numerator/denominator must be safe integers.');
  }
  if (value.denominator <= 0 || value.numerator <= 0) {
    throw new RangeError('Canonical rational numerator/denominator must be positive.');
  }
  const divisor = gcd(value.numerator, value.denominator);
  return Object.freeze({ numerator: value.numerator / divisor, denominator: value.denominator / divisor });
}

export function validateCanonicalTimelineV2(timeline: CanonicalTimelineV2): CanonicalTimelineValidationResult {
  const errors: string[] = [];
  try { normalizeCanonicalRational(timeline.frameRate); } catch (error) { errors.push(String(error)); }
  if (!timeline.timelineId.trim() || !timeline.revisionId.trim() || !timeline.projectId.trim()) errors.push('timelineId, revisionId and projectId are required');
  if (!Number.isSafeInteger(timeline.durationFrames) || timeline.durationFrames <= 0) errors.push('durationFrames must be a positive safe integer');
  if (!timeline.deliveryProfileVersion.trim()) errors.push('deliveryProfileVersion is required');
  if (!SHA256_PATTERN.test(timeline.manifestSha256)) errors.push('manifestSha256 must be a SHA-256 hex digest');
  if (!timeline.createdBy.trim() || Number.isNaN(Date.parse(timeline.createdAt))) errors.push('createdBy and valid createdAt are required');

  for (const item of timeline.items) {
    if (!Number.isSafeInteger(item.startFrame) || !Number.isSafeInteger(item.endFrame) || item.startFrame < 0 || item.endFrame <= item.startFrame || item.endFrame > timeline.durationFrames) {
      errors.push(`invalid frame range for ${item.itemId}`);
    }
    if (item.kind === 'asset-video' || item.kind === 'source-audio') {
      if (!Number.isSafeInteger(item.source.streamIndex) || item.source.streamIndex < 0) errors.push(`invalid streamIndex for ${item.itemId}`);
      if (!Number.isSafeInteger(item.source.sourceStartPts) || !Number.isSafeInteger(item.source.sourceEndPts) || item.source.sourceEndPts <= item.source.sourceStartPts) errors.push(`invalid native PTS range for ${item.itemId}`);
      try { normalizeCanonicalRational(item.source.sourceTimeBase); } catch (error) { errors.push(`invalid sourceTimeBase for ${item.itemId}: ${String(error)}`); }
      try { normalizeCanonicalRational(item.playbackRate); } catch (error) { errors.push(`invalid playbackRate for ${item.itemId}: ${String(error)}`); }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function isCanonicalTimelineV2(timeline: ReadableCanonicalTimeline): timeline is CanonicalTimelineV2 {
  return timeline.schemaVersion === CANONICAL_TIMELINE_V2_SCHEMA_VERSION;
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}
