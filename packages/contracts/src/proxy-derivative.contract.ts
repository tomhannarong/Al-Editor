import { normalizeCanonicalRational, type CanonicalRational } from './canonical-timeline.contract.js';

export const PROXY_DERIVATIVE_SCHEMA_VERSION = '1.0' as const;

export interface ProxyDerivativeSource {
  sceneSetId: string;
  sceneSetRevisionId: string;
  assetId: string;
  streamId: string;
  streamIndex: number;
  timeBase: CanonicalRational;
}

export interface ProxyDerivativeToolchain {
  name: string;
  version: string;
}

/**
 * Rebuildable proxy metadata. The artifact location and presentation metadata
 * are derivative state only; exact source authority remains the immutable
 * scene-set revision plus asset/stream/native rational mapping.
 */
export interface ProxyDerivativeRevision {
  schemaVersion: typeof PROXY_DERIVATIVE_SCHEMA_VERSION;
  derivativeId: string;
  revisionId: string;
  source: ProxyDerivativeSource;
  derivativeProfileVersion: string;
  toolchain: ProxyDerivativeToolchain;
  artifactUri: string;
  createdAt: string;
}

export interface ProxyDerivativeValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_ASSET_ID = /^sha256:[a-f0-9]{64}$/;

export function validateProxyDerivativeRevision(
  derivative: ProxyDerivativeRevision,
): ProxyDerivativeValidationResult {
  const errors: string[] = [];

  if (derivative.schemaVersion !== PROXY_DERIVATIVE_SCHEMA_VERSION) {
    errors.push('unsupported proxy-derivative schemaVersion');
  }
  if (!derivative.derivativeId.trim()) errors.push('derivativeId is required');
  if (!derivative.revisionId.trim()) errors.push('revisionId is required');
  if (!derivative.derivativeProfileVersion.trim()) errors.push('derivativeProfileVersion is required');
  if (!derivative.toolchain.name.trim()) errors.push('toolchain.name is required');
  if (!derivative.toolchain.version.trim()) errors.push('toolchain.version is required');
  if (!derivative.artifactUri.trim()) errors.push('artifactUri is required');
  if (Number.isNaN(Date.parse(derivative.createdAt))) errors.push('createdAt must be an ISO-compatible timestamp');

  const source = derivative.source;
  if (!source.sceneSetId.trim()) errors.push('source.sceneSetId is required');
  if (!source.sceneSetRevisionId.trim()) errors.push('source.sceneSetRevisionId is required');
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

  return { valid: errors.length === 0, errors };
}

/**
 * Compares only canonical source authority. Artifact URI, profile and toolchain
 * versions deliberately do not participate in source identity.
 */
export function sameProxyDerivativeSource(
  left: ProxyDerivativeSource,
  right: ProxyDerivativeSource,
): boolean {
  try {
    const leftTimeBase = normalizeCanonicalRational(left.timeBase);
    const rightTimeBase = normalizeCanonicalRational(right.timeBase);
    return left.sceneSetId === right.sceneSetId
      && left.sceneSetRevisionId === right.sceneSetRevisionId
      && left.assetId === right.assetId
      && left.streamId === right.streamId
      && left.streamIndex === right.streamIndex
      && leftTimeBase.numerator === rightTimeBase.numerator
      && leftTimeBase.denominator === rightTimeBase.denominator;
  } catch {
    return false;
  }
}
