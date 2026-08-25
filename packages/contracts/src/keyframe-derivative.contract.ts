import { normalizeCanonicalRational, type CanonicalRational } from './canonical-timeline.contract.js';

export const KEYFRAME_DERIVATIVE_SCHEMA_VERSION = '1.0' as const;

export interface KeyframeDerivativeSource {
  sceneSetId: string;
  sceneSetRevisionId: string;
  sceneId: string;
  assetId: string;
  streamId: string;
  streamIndex: number;
  timeBase: CanonicalRational;
}

export interface KeyframeDerivativeToolchain {
  name: string;
  version: string;
}

export interface KeyframeDerivativeFrame {
  frameId: string;
  sourcePts: number;
  artifactUri: string;
}

/**
 * Rebuildable keyframe-image evidence for one immutable scene/source mapping.
 * sourcePts + source.timeBase are authoritative source coordinates. Image
 * filenames, artifact URIs and any decoded/display timestamps are derivative
 * state only and must never become canonical editorial time.
 */
export interface KeyframeDerivativeRevision {
  schemaVersion: typeof KEYFRAME_DERIVATIVE_SCHEMA_VERSION;
  derivativeId: string;
  revisionId: string;
  source: KeyframeDerivativeSource;
  derivativeProfileVersion: string;
  toolchain: KeyframeDerivativeToolchain;
  createdAt: string;
  frames: KeyframeDerivativeFrame[];
}

export interface KeyframeDerivativeValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_ASSET_ID = /^sha256:[a-f0-9]{64}$/;

export function validateKeyframeDerivativeRevision(
  derivative: KeyframeDerivativeRevision,
): KeyframeDerivativeValidationResult {
  const errors: string[] = [];

  if (derivative.schemaVersion !== KEYFRAME_DERIVATIVE_SCHEMA_VERSION) {
    errors.push('unsupported keyframe-derivative schemaVersion');
  }
  if (!derivative.derivativeId.trim()) errors.push('derivativeId is required');
  if (!derivative.revisionId.trim()) errors.push('revisionId is required');
  if (!derivative.derivativeProfileVersion.trim()) errors.push('derivativeProfileVersion is required');
  if (!derivative.toolchain.name.trim()) errors.push('toolchain.name is required');
  if (!derivative.toolchain.version.trim()) errors.push('toolchain.version is required');
  if (Number.isNaN(Date.parse(derivative.createdAt))) errors.push('createdAt must be an ISO-compatible timestamp');

  const source = derivative.source;
  if (!source.sceneSetId.trim()) errors.push('source.sceneSetId is required');
  if (!source.sceneSetRevisionId.trim()) errors.push('source.sceneSetRevisionId is required');
  if (!source.sceneId.trim()) errors.push('source.sceneId is required');
  if (!SHA256_ASSET_ID.test(source.assetId)) errors.push('source.assetId must be a canonical sha256 asset identity');
  if (!source.streamId.trim()) errors.push('source.streamId is required');
  if (!Number.isSafeInteger(source.streamIndex) || source.streamIndex < 0) {
    errors.push('source.streamIndex must be a non-negative safe integer');
  }
  try {
    normalizeCanonicalRational(source.timeBase);
  } catch (error) {
    errors.push(`invalid source.timeBase: ${String(error)}`);
  }

  if (derivative.frames.length === 0) errors.push('frames must contain at least one keyframe');

  const seenFrameIds = new Set<string>();
  const seenSourcePts = new Set<number>();
  let previousSourcePts: number | undefined;
  for (const [index, frame] of derivative.frames.entries()) {
    if (!frame.frameId.trim()) errors.push(`frames[${index}].frameId is required`);
    if (seenFrameIds.has(frame.frameId)) errors.push(`duplicate frameId ${frame.frameId}`);
    seenFrameIds.add(frame.frameId);

    if (!Number.isSafeInteger(frame.sourcePts)) {
      errors.push(`frames[${index}].sourcePts must be a safe integer`);
    } else {
      if (seenSourcePts.has(frame.sourcePts)) errors.push(`duplicate sourcePts ${frame.sourcePts}`);
      seenSourcePts.add(frame.sourcePts);
      if (previousSourcePts !== undefined && frame.sourcePts <= previousSourcePts) {
        errors.push(`frames[${index}].sourcePts must be strictly increasing`);
      }
      previousSourcePts = frame.sourcePts;
    }

    if (!frame.artifactUri.trim()) errors.push(`frames[${index}].artifactUri is required`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compares only immutable scene/source authority. Derivative profile,
 * toolchain, frame selection and artifact locations are intentionally excluded.
 */
export function sameKeyframeDerivativeSource(
  left: KeyframeDerivativeSource,
  right: KeyframeDerivativeSource,
): boolean {
  try {
    const leftTimeBase = normalizeCanonicalRational(left.timeBase);
    const rightTimeBase = normalizeCanonicalRational(right.timeBase);
    return left.sceneSetId === right.sceneSetId
      && left.sceneSetRevisionId === right.sceneSetRevisionId
      && left.sceneId === right.sceneId
      && left.assetId === right.assetId
      && left.streamId === right.streamId
      && left.streamIndex === right.streamIndex
      && leftTimeBase.numerator === rightTimeBase.numerator
      && leftTimeBase.denominator === rightTimeBase.denominator;
  } catch {
    return false;
  }
}
