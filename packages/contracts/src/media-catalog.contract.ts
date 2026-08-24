import { normalizeCanonicalRational, type CanonicalRational } from './canonical-timeline.contract.js';

export const MEDIA_ASSET_IDENTITY_SCHEMA_VERSION = '1.0' as const;
export const SHA256_ALGORITHM = 'sha256' as const;

export interface MediaContentDigest {
  algorithm: typeof SHA256_ALGORITHM;
  hex: string;
}

/** Stable identity is derived from immutable bytes, never from a path/URI. */
export interface StableMediaAssetIdentity {
  schemaVersion: typeof MEDIA_ASSET_IDENTITY_SCHEMA_VERSION;
  assetId: string;
  contentDigest: MediaContentDigest;
  byteSize: number;
  firstIngestedAt: string;
}

/** Storage location is mutable/rebindable and therefore deliberately separate from asset identity. */
export interface MediaStorageLocation {
  locationId: string;
  assetId: string;
  uri: string;
  state: 'available' | 'missing' | 'quarantined';
  observedAt: string;
}

export type MediaStreamKind = 'video' | 'audio' | 'subtitle' | 'data' | 'attachment' | 'unknown';

/** Normalized stream metadata keeps native PTS/time-base authority; derived seconds are intentionally absent. */
export interface NativeMediaStreamMetadata {
  streamId: string;
  assetId: string;
  streamIndex: number;
  kind: MediaStreamKind;
  codecName?: string;
  timeBase: CanonicalRational;
  startPts: number | null;
  durationPts: number | null;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
}

export interface MediaAssetValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function assetIdFromSha256(hex: string): string {
  const normalized = hex.trim().toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) throw new TypeError('sha256 must be exactly 64 hexadecimal characters');
  return `sha256:${normalized}`;
}

export function validateStableMediaAssetIdentity(asset: StableMediaAssetIdentity): MediaAssetValidationResult {
  const errors: string[] = [];
  let expectedAssetId: string | undefined;
  try { expectedAssetId = assetIdFromSha256(asset.contentDigest.hex); } catch (error) { errors.push(String(error)); }
  if (asset.schemaVersion !== MEDIA_ASSET_IDENTITY_SCHEMA_VERSION) errors.push('unsupported media asset identity schemaVersion');
  if (asset.contentDigest.algorithm !== SHA256_ALGORITHM) errors.push('contentDigest.algorithm must be sha256');
  if (expectedAssetId && asset.assetId !== expectedAssetId) errors.push('assetId must equal the canonical content-addressed identity');
  if (!Number.isSafeInteger(asset.byteSize) || asset.byteSize < 0) errors.push('byteSize must be a non-negative safe integer');
  if (Number.isNaN(Date.parse(asset.firstIngestedAt))) errors.push('firstIngestedAt must be an ISO-compatible timestamp');
  return { valid: errors.length === 0, errors };
}

export function validateMediaStorageLocation(location: MediaStorageLocation): MediaAssetValidationResult {
  const errors: string[] = [];
  if (!location.locationId.trim() || !location.assetId.trim()) errors.push('locationId and assetId are required');
  if (!location.uri.trim()) errors.push('uri is required');
  if (Number.isNaN(Date.parse(location.observedAt))) errors.push('observedAt must be an ISO-compatible timestamp');
  return { valid: errors.length === 0, errors };
}

export function validateNativeMediaStreamMetadata(stream: NativeMediaStreamMetadata): MediaAssetValidationResult {
  const errors: string[] = [];
  if (!stream.streamId.trim() || !stream.assetId.trim()) errors.push('streamId and assetId are required');
  if (!Number.isSafeInteger(stream.streamIndex) || stream.streamIndex < 0) errors.push('streamIndex must be a non-negative safe integer');
  try { normalizeCanonicalRational(stream.timeBase); } catch (error) { errors.push(`invalid timeBase: ${String(error)}`); }
  if (stream.startPts !== null && !Number.isSafeInteger(stream.startPts)) errors.push('startPts must be null or a safe integer');
  if (stream.durationPts !== null && (!Number.isSafeInteger(stream.durationPts) || stream.durationPts < 0)) errors.push('durationPts must be null or a non-negative safe integer');
  for (const [name, value] of [['width', stream.width], ['height', stream.height], ['sampleRate', stream.sampleRate], ['channels', stream.channels]] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) errors.push(`${name} must be a positive safe integer when present`);
  }
  return { valid: errors.length === 0, errors };
}

/** Idempotency key is byte identity only; moving/renaming media cannot produce a second asset. */
export function sameImmutableAsset(left: StableMediaAssetIdentity, right: StableMediaAssetIdentity): boolean {
  return left.assetId === right.assetId && left.contentDigest.algorithm === right.contentDigest.algorithm && left.contentDigest.hex.toLowerCase() === right.contentDigest.hex.toLowerCase() && left.byteSize === right.byteSize;
}
