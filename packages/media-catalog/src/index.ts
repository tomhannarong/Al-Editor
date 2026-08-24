import { createHash } from 'node:crypto';

import {
  MEDIA_ASSET_IDENTITY_SCHEMA_VERSION,
  SHA256_ALGORITHM,
  assetIdFromSha256,
  sameImmutableAsset,
  validateMediaStorageLocation,
  validateStableMediaAssetIdentity,
  type MediaStorageLocation,
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
  getAsset(assetId: string): StableMediaAssetIdentity | undefined;
  getLocation(locationId: string): MediaStorageLocation | undefined;
}

/**
 * Minimal deterministic catalog implementation. It models the required
 * idempotency/rebinding semantics without making storage URI part of identity.
 */
export class InMemoryMediaCatalog implements MediaCatalogPersistence {
  readonly #assets = new Map<string, StableMediaAssetIdentity>();
  readonly #locations = new Map<string, MediaStorageLocation>();

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

  getAsset(assetId: string): StableMediaAssetIdentity | undefined {
    const asset = this.#assets.get(assetId);
    return asset ? cloneAsset(asset) : undefined;
  }

  getLocation(locationId: string): MediaStorageLocation | undefined {
    const location = this.#locations.get(locationId);
    return location ? { ...location } : undefined;
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

function cloneAsset(asset: StableMediaAssetIdentity): StableMediaAssetIdentity {
  return { ...asset, contentDigest: { ...asset.contentDigest } };
}
