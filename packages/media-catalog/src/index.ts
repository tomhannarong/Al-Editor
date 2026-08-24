import { createHash } from 'node:crypto';

import {
  MEDIA_ASSET_IDENTITY_SCHEMA_VERSION,
  SHA256_ALGORITHM,
  assetIdFromSha256,
  sameImmutableAsset,
  validateMediaStorageLocation,
  validateNativeMediaStreamMetadata,
  validateStableMediaAssetIdentity,
  type MediaStorageLocation,
  type NativeMediaStreamMetadata,
  type StableMediaAssetIdentity,
} from '../../contracts/src/media-catalog.contract.js';

export interface HashedMediaContent {
  sha256Hex: string;
  byteSize: number;
}

export interface IngestLocationInput {
  locationId: string;
  uri: string;
  observedAt: string;
}

export interface IngestMediaContentInput {
  chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
  firstIngestedAt: string;
  location: IngestLocationInput;
}

export interface IngestMediaContentResult {
  asset: StableMediaAssetIdentity;
  location: MediaStorageLocation;
  assetCreated: boolean;
}

export class MediaCatalogInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaCatalogInvariantError';
  }
}

/**
 * Hashes immutable media incrementally. Chunk boundaries are deliberately not
 * part of identity, so callers can stream large local files without buffering
 * the full payload in memory.
 */
export async function hashMediaContent(
  chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<HashedMediaContent> {
  const hash = createHash('sha256');
  let byteSize = 0;

  for await (const chunk of chunks) {
    if (!(chunk instanceof Uint8Array)) throw new TypeError('media chunk must be a Uint8Array');
    byteSize += chunk.byteLength;
    if (!Number.isSafeInteger(byteSize)) throw new RangeError('media byte size exceeds safe integer range');
    hash.update(chunk);
  }

  return { sha256Hex: hash.digest('hex'), byteSize };
}

/** Deterministic persistence boundary used by ingest services and tests. */
export interface MediaCatalogPersistence {
  registerAsset(candidate: StableMediaAssetIdentity): { asset: StableMediaAssetIdentity; created: boolean };
  rebindLocation(location: MediaStorageLocation): MediaStorageLocation;
  replaceStreamMetadata(assetId: string, streams: NativeMediaStreamMetadata[]): NativeMediaStreamMetadata[];
  getAsset(assetId: string): StableMediaAssetIdentity | undefined;
  getLocation(locationId: string): MediaStorageLocation | undefined;
  getStreamMetadata(assetId: string): NativeMediaStreamMetadata[];
}

/**
 * Minimal deterministic catalog implementation. It models the required
 * idempotency/rebinding semantics without making storage URI part of identity.
 */
export class InMemoryMediaCatalog implements MediaCatalogPersistence {
  readonly #assets = new Map<string, StableMediaAssetIdentity>();
  readonly #locations = new Map<string, MediaStorageLocation>();
  readonly #streams = new Map<string, NativeMediaStreamMetadata[]>();

  registerAsset(candidate: StableMediaAssetIdentity): { asset: StableMediaAssetIdentity; created: boolean } {
    const validation = validateStableMediaAssetIdentity(candidate);
    if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));

    const existing = this.#assets.get(candidate.assetId);
    if (existing) {
      if (!sameImmutableAsset(existing, candidate)) {
        throw new MediaCatalogInvariantError('content-addressed asset identity conflicts with existing immutable bytes');
      }
      return { asset: cloneAsset(existing), created: false };
    }

    const stored = cloneAsset(candidate);
    this.#assets.set(stored.assetId, stored);
    return { asset: cloneAsset(stored), created: true };
  }

  rebindLocation(location: MediaStorageLocation): MediaStorageLocation {
    const validation = validateMediaStorageLocation(location);
    if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));
    if (!this.#assets.has(location.assetId)) {
      throw new MediaCatalogInvariantError(`cannot bind location to unknown asset ${location.assetId}`);
    }

    const stored = { ...location };
    this.#locations.set(stored.locationId, stored);
    return { ...stored };
  }

  replaceStreamMetadata(assetId: string, streams: NativeMediaStreamMetadata[]): NativeMediaStreamMetadata[] {
    if (!this.#assets.has(assetId)) throw new MediaCatalogInvariantError(`cannot persist streams for unknown asset ${assetId}`);

    const seenIndexes = new Set<number>();
    const seenIds = new Set<string>();
    const normalized = streams.map((stream) => {
      const validation = validateNativeMediaStreamMetadata(stream);
      if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));
      if (stream.assetId !== assetId) throw new MediaCatalogInvariantError('stream assetId must match persistence assetId');
      if (seenIndexes.has(stream.streamIndex)) throw new MediaCatalogInvariantError(`duplicate streamIndex ${stream.streamIndex}`);
      if (seenIds.has(stream.streamId)) throw new MediaCatalogInvariantError(`duplicate streamId ${stream.streamId}`);
      seenIndexes.add(stream.streamIndex);
      seenIds.add(stream.streamId);
      return cloneStream(stream);
    }).sort((left, right) => left.streamIndex - right.streamIndex);

    this.#streams.set(assetId, normalized);
    return normalized.map(cloneStream);
  }

  getAsset(assetId: string): StableMediaAssetIdentity | undefined {
    const asset = this.#assets.get(assetId);
    return asset ? cloneAsset(asset) : undefined;
  }

  getLocation(locationId: string): MediaStorageLocation | undefined {
    const location = this.#locations.get(locationId);
    return location ? { ...location } : undefined;
  }

  getStreamMetadata(assetId: string): NativeMediaStreamMetadata[] {
    return (this.#streams.get(assetId) ?? []).map(cloneStream);
  }
}

/**
 * Content-addressed ingest: hash first, idempotently register immutable asset,
 * then bind mutable location. Re-ingest of identical bytes never creates a
 * second logical asset; a location may later be rebound after move/overwrite.
 */
export async function ingestMediaContent(
  input: IngestMediaContentInput,
  persistence: MediaCatalogPersistence,
): Promise<IngestMediaContentResult> {
  const hashed = await hashMediaContent(input.chunks);
  const assetId = assetIdFromSha256(hashed.sha256Hex);
  const candidate: StableMediaAssetIdentity = {
    schemaVersion: MEDIA_ASSET_IDENTITY_SCHEMA_VERSION,
    assetId,
    contentDigest: { algorithm: SHA256_ALGORITHM, hex: hashed.sha256Hex },
    byteSize: hashed.byteSize,
    firstIngestedAt: input.firstIngestedAt,
  };

  const registered = persistence.registerAsset(candidate);
  const location = persistence.rebindLocation({
    locationId: input.location.locationId,
    assetId: registered.asset.assetId,
    uri: input.location.uri,
    state: 'available',
    observedAt: input.location.observedAt,
  });

  return { asset: registered.asset, location, assetCreated: registered.created };
}

/**
 * Normalizes the authoritative native timing fields emitted by ffprobe.
 * Decimal seconds such as start_time/duration are deliberately ignored.
 */
export function parseNormalizedFfprobeStreams(assetId: string, ffprobe: unknown): NativeMediaStreamMetadata[] {
  if (!assetId.trim()) throw new MediaCatalogInvariantError('assetId is required for ffprobe normalization');
  const root = asRecord(ffprobe, 'ffprobe result');
  if (!Array.isArray(root.streams)) throw new MediaCatalogInvariantError('ffprobe result.streams must be an array');

  const seenIndexes = new Set<number>();
  const streams = root.streams.map((rawStream, position) => {
    const stream = asRecord(rawStream, `ffprobe stream ${position}`);
    const streamIndex = parseRequiredSafeInteger(stream.index, `stream ${position} index`, 0);
    if (seenIndexes.has(streamIndex)) throw new MediaCatalogInvariantError(`duplicate ffprobe stream index ${streamIndex}`);
    seenIndexes.add(streamIndex);

    const timeBase = parseTimeBase(stream.time_base, `stream ${streamIndex} time_base`);
    const startPts = parseNullableSafeInteger(stream.start_pts, `stream ${streamIndex} start_pts`, undefined);
    const durationPts = parseNullableSafeInteger(stream.duration_ts, `stream ${streamIndex} duration_ts`, 0);
    const codecName = parseOptionalString(stream.codec_name, `stream ${streamIndex} codec_name`);
    const kind = normalizeStreamKind(stream.codec_type, streamIndex);

    const normalized: NativeMediaStreamMetadata = {
      streamId: `${assetId}:stream:${streamIndex}`,
      assetId,
      streamIndex,
      kind,
      timeBase,
      startPts,
      durationPts,
    };

    if (codecName !== undefined) normalized.codecName = codecName;
    assignOptionalPositiveInteger(normalized, 'width', stream.width, streamIndex);
    assignOptionalPositiveInteger(normalized, 'height', stream.height, streamIndex);
    assignOptionalPositiveInteger(normalized, 'sampleRate', stream.sample_rate, streamIndex);
    assignOptionalPositiveInteger(normalized, 'channels', stream.channels, streamIndex);

    const validation = validateNativeMediaStreamMetadata(normalized);
    if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));
    return normalized;
  });

  return streams.sort((left, right) => left.streamIndex - right.streamIndex);
}

/** Parse ffprobe output and atomically replace the normalized stream projection for one immutable asset. */
export function ingestFfprobeStreamMetadata(
  assetId: string,
  ffprobe: unknown,
  persistence: MediaCatalogPersistence,
): NativeMediaStreamMetadata[] {
  const streams = parseNormalizedFfprobeStreams(assetId, ffprobe);
  return persistence.replaceStreamMetadata(assetId, streams);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MediaCatalogInvariantError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function parseTimeBase(value: unknown, label: string): NativeMediaStreamMetadata['timeBase'] {
  if (typeof value !== 'string') throw new MediaCatalogInvariantError(`${label} must be a rational string`);
  const match = /^([+]?[0-9]+)\/([+]?[0-9]+)$/.exec(value.trim());
  if (!match) throw new MediaCatalogInvariantError(`${label} must be numerator/denominator`);
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isSafeInteger(numerator) || numerator <= 0 || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new MediaCatalogInvariantError(`${label} must contain positive safe integers`);
  }
  return { numerator, denominator };
}

function parseRequiredSafeInteger(value: unknown, label: string, minimum?: number): number {
  const parsed = parseStrictInteger(value, label);
  if (parsed === null) throw new MediaCatalogInvariantError(`${label} is required`);
  if (minimum !== undefined && parsed < minimum) throw new MediaCatalogInvariantError(`${label} must be >= ${minimum}`);
  return parsed;
}

function parseNullableSafeInteger(value: unknown, label: string, minimum?: number): number | null {
  const parsed = parseStrictInteger(value, label);
  if (parsed === null) return null;
  if (minimum !== undefined && parsed < minimum) throw new MediaCatalogInvariantError(`${label} must be >= ${minimum}`);
  return parsed;
}

function parseStrictInteger(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === 'N/A') return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new MediaCatalogInvariantError(`${label} must be a safe integer`);
    return value;
  }
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (!Number.isSafeInteger(parsed)) throw new MediaCatalogInvariantError(`${label} must be a safe integer`);
    return parsed;
  }
  throw new MediaCatalogInvariantError(`${label} must be an integer, integer string, null, or N/A`);
}

function parseOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === 'N/A') return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new MediaCatalogInvariantError(`${label} must be a non-empty string when present`);
  return value.trim();
}

function normalizeStreamKind(value: unknown, streamIndex: number): NativeMediaStreamMetadata['kind'] {
  if (value === undefined || value === null || value === 'N/A') return 'unknown';
  if (typeof value !== 'string') throw new MediaCatalogInvariantError(`stream ${streamIndex} codec_type must be a string when present`);
  switch (value) {
    case 'video':
    case 'audio':
    case 'subtitle':
    case 'data':
    case 'attachment':
      return value;
    default:
      return 'unknown';
  }
}

function assignOptionalPositiveInteger<K extends 'width' | 'height' | 'sampleRate' | 'channels'>(
  target: NativeMediaStreamMetadata,
  key: K,
  value: unknown,
  streamIndex: number,
): void {
  if (value === undefined || value === null || value === 'N/A') return;
  const parsed = parseRequiredSafeInteger(value, `stream ${streamIndex} ${key}`, 1);
  target[key] = parsed;
}

function cloneAsset(asset: StableMediaAssetIdentity): StableMediaAssetIdentity {
  return { ...asset, contentDigest: { ...asset.contentDigest } };
}

function cloneStream(stream: NativeMediaStreamMetadata): NativeMediaStreamMetadata {
  return { ...stream, timeBase: { ...stream.timeBase } };
}
