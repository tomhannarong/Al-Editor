import { constants, type Stats } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  MEDIA_ASSET_IDENTITY_SCHEMA_VERSION,
  SHA256_ALGORITHM,
  assetIdFromSha256,
  type MediaStorageLocation,
  type StableMediaAssetIdentity,
} from '../../contracts/src/media-catalog.contract.js';
import {
  MediaCatalogInvariantError,
  hashMediaContent,
  type IngestMediaContentResult,
  type MediaCatalogPersistence,
} from './index.js';

const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const MAX_CHUNK_SIZE = 16 * 1024 * 1024;

export interface IngestLocalMediaFileInput {
  filePath: string;
  allowedRoot: string;
  firstIngestedAt: string;
  locationId: string;
  observedAt: string;
  chunkSize?: number;
}

export interface LocalFileSnapshot {
  device: number;
  inode: number;
  byteSize: number;
  modifiedAtMs: number;
  changedAtMs: number;
}

/**
 * Reads a local original through a confined, no-follow file handle and only
 * publishes catalog state after the opened file remains stable for the full
 * hashing window. Storage path/URI never participates in immutable identity.
 */
export async function ingestLocalMediaFile(
  input: IngestLocalMediaFileInput,
  persistence: MediaCatalogPersistence,
): Promise<IngestMediaContentResult> {
  const chunkSize = normalizeChunkSize(input.chunkSize);
  const rootPath = await realpath(resolve(input.allowedRoot));
  const rootStats = await stat(rootPath);
  if (!rootStats.isDirectory()) throw new MediaCatalogInvariantError('allowedRoot must resolve to a directory');

  const requestedPath = resolve(input.filePath);
  const requestedStats = await lstat(requestedPath);
  if (requestedStats.isSymbolicLink()) {
    throw new MediaCatalogInvariantError('local media path must not be a symbolic link');
  }

  const resolvedPath = await realpath(requestedPath);
  assertPathWithinRoot(rootPath, resolvedPath);

  const noFollow = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0;
  const handle = await open(resolvedPath, constants.O_RDONLY | noFollow);

  try {
    const beforeStats = await handle.stat();
    if (!beforeStats.isFile()) throw new MediaCatalogInvariantError('local media path must resolve to a regular file');
    const before = snapshotFile(beforeStats);
    if (!Number.isSafeInteger(before.byteSize)) {
      throw new MediaCatalogInvariantError('local media byte size exceeds safe integer range');
    }

    const hashed = await hashMediaContent(readFileChunks(handle, chunkSize));
    const after = snapshotFile(await handle.stat());
    const resolvedAfterHash = await realpath(requestedPath);

    assertPathWithinRoot(rootPath, resolvedAfterHash);
    if (resolvedAfterHash !== resolvedPath || !sameLocalFileSnapshot(before, after) || hashed.byteSize !== before.byteSize) {
      throw new MediaCatalogInvariantError('local media changed while ingest was hashing; catalog state was not published');
    }

    const assetId = assetIdFromSha256(hashed.sha256Hex);
    const candidate: StableMediaAssetIdentity = {
      schemaVersion: MEDIA_ASSET_IDENTITY_SCHEMA_VERSION,
      assetId,
      contentDigest: { algorithm: SHA256_ALGORITHM, hex: hashed.sha256Hex },
      byteSize: hashed.byteSize,
      firstIngestedAt: input.firstIngestedAt,
    };
    const registered = persistence.registerAsset(candidate);
    const location: MediaStorageLocation = persistence.rebindLocation({
      locationId: input.locationId,
      assetId: registered.asset.assetId,
      uri: pathToFileURL(resolvedPath).href,
      state: 'available',
      observedAt: input.observedAt,
    });

    return { asset: registered.asset, location, assetCreated: registered.created };
  } finally {
    await handle.close();
  }
}

export function sameLocalFileSnapshot(left: LocalFileSnapshot, right: LocalFileSnapshot): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.byteSize === right.byteSize
    && left.modifiedAtMs === right.modifiedAtMs
    && left.changedAtMs === right.changedAtMs;
}

function normalizeChunkSize(value: number | undefined): number {
  if (value === undefined) return DEFAULT_CHUNK_SIZE;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CHUNK_SIZE) {
    throw new MediaCatalogInvariantError(`chunkSize must be a safe integer between 1 and ${MAX_CHUNK_SIZE}`);
  }
  return value;
}

function assertPathWithinRoot(rootPath: string, candidatePath: string): void {
  const rel = relative(rootPath, candidatePath);
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) return;
  throw new MediaCatalogInvariantError('local media path escapes allowedRoot');
}

function snapshotFile(stats: Stats): LocalFileSnapshot {
  return {
    device: stats.dev,
    inode: stats.ino,
    byteSize: stats.size,
    modifiedAtMs: stats.mtimeMs,
    changedAtMs: stats.ctimeMs,
  };
}

async function* readFileChunks(
  handle: Awaited<ReturnType<typeof open>>,
  chunkSize: number,
): AsyncGenerator<Uint8Array> {
  let position = 0;
  while (true) {
    const buffer = Buffer.allocUnsafe(chunkSize);
    const { bytesRead } = await handle.read(buffer, 0, chunkSize, position);
    if (bytesRead === 0) return;
    position += bytesRead;
    yield buffer.subarray(0, bytesRead);
  }
}
