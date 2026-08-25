import { createHash, randomUUID } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import { chmod, link, lstat, mkdir, open, realpath, stat, unlink } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  sameImmutableAsset,
  validateStableMediaAssetIdentity,
  type MediaStorageLocation,
  type StableMediaAssetIdentity,
} from '../../contracts/src/media-catalog.contract.js';
import {
  MediaCatalogInvariantError,
  type MediaCatalogPersistence,
} from './index.js';
import { sameLocalFileSnapshot, type LocalFileSnapshot } from './local-file-ingest.js';

const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const MAX_CHUNK_SIZE = 16 * 1024 * 1024;

export interface MaterializeManagedOriginalInput {
  sourceFilePath: string;
  allowedSourceRoot: string;
  managedRoot: string;
  asset: StableMediaAssetIdentity;
  locationId: string;
  observedAt: string;
  chunkSize?: number;
}

export interface ManagedOriginalMaterializationResult {
  asset: StableMediaAssetIdentity;
  location: MediaStorageLocation;
  destinationPath: string;
  created: boolean;
}

/**
 * Materializes an already-registered immutable asset into managed,
 * content-addressed storage. The final path is derived only from SHA-256,
 * never from caller filenames. Catalog location state is published only after
 * the final managed file has been byte-verified and restored to read-only mode.
 */
export async function materializeManagedOriginal(
  input: MaterializeManagedOriginalInput,
  persistence: MediaCatalogPersistence,
): Promise<ManagedOriginalMaterializationResult> {
  const validation = validateStableMediaAssetIdentity(input.asset);
  if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));

  const registered = persistence.getAsset(input.asset.assetId);
  if (!registered || !sameImmutableAsset(registered, input.asset)) {
    throw new MediaCatalogInvariantError('managed original requires the exact registered immutable asset');
  }

  const chunkSize = normalizeChunkSize(input.chunkSize);
  const sourceRoot = await realpath(resolve(input.allowedSourceRoot));
  if (!(await stat(sourceRoot)).isDirectory()) {
    throw new MediaCatalogInvariantError('allowedSourceRoot must resolve to a directory');
  }

  const requestedSource = resolve(input.sourceFilePath);
  if ((await lstat(requestedSource)).isSymbolicLink()) {
    throw new MediaCatalogInvariantError('managed original source must not be a symbolic link');
  }
  const sourcePath = await realpath(requestedSource);
  assertPathWithinRoot(sourceRoot, sourcePath, 'managed original source escapes allowedSourceRoot');

  await mkdir(resolve(input.managedRoot), { recursive: true });
  const managedRoot = await realpath(resolve(input.managedRoot));
  if (!(await stat(managedRoot)).isDirectory()) {
    throw new MediaCatalogInvariantError('managedRoot must resolve to a directory');
  }

  const digest = input.asset.contentDigest.hex;
  const algorithmDir = await ensureOwnedDirectory(managedRoot, 'sha256');
  const shardDir = await ensureOwnedDirectory(algorithmDir, digest.slice(0, 2));
  const destinationPath = join(shardDir, digest);
  assertPathWithinRoot(managedRoot, destinationPath, 'managed original destination escapes managedRoot');

  const existing = await verifyManagedOriginalIfPresent(destinationPath, input.asset, chunkSize);
  let created = false;
  if (!existing) {
    created = await copyVerifiedOriginal({
      sourcePath,
      shardDir,
      destinationPath,
      asset: input.asset,
      chunkSize,
    });
  }

  await verifyManagedOriginal(destinationPath, input.asset, chunkSize);
  await chmod(destinationPath, 0o444);
  const location = persistence.rebindLocation({
    locationId: input.locationId,
    assetId: input.asset.assetId,
    uri: pathToFileURL(destinationPath).href,
    state: 'available',
    observedAt: input.observedAt,
  });

  return { asset: registered, location, destinationPath, created };
}

async function copyVerifiedOriginal(input: {
  sourcePath: string;
  shardDir: string;
  destinationPath: string;
  asset: StableMediaAssetIdentity;
  chunkSize: number;
}): Promise<boolean> {
  const noFollow = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0;
  const sourceHandle = await open(input.sourcePath, constants.O_RDONLY | noFollow);
  const tempPath = join(input.shardDir, `.${input.asset.contentDigest.hex}.${randomUUID()}.tmp`);
  let tempHandle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    const beforeStats = await sourceHandle.stat();
    if (!beforeStats.isFile()) throw new MediaCatalogInvariantError('managed original source must be a regular file');
    const before = snapshotFile(beforeStats);

    tempHandle = await open(
      tempPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | noFollow,
      0o600,
    );

    const hash = createHash('sha256');
    let position = 0;
    while (true) {
      const buffer = Buffer.allocUnsafe(input.chunkSize);
      const { bytesRead } = await sourceHandle.read(buffer, 0, input.chunkSize, position);
      if (bytesRead === 0) break;
      const chunk = buffer.subarray(0, bytesRead);
      await writeAll(tempHandle, chunk);
      hash.update(chunk);
      position += bytesRead;
      if (!Number.isSafeInteger(position)) {
        throw new MediaCatalogInvariantError('managed original byte size exceeds safe integer range');
      }
    }

    const after = snapshotFile(await sourceHandle.stat());
    if (!sameLocalFileSnapshot(before, after)) {
      throw new MediaCatalogInvariantError('managed original source changed while copying');
    }

    const copiedDigest = hash.digest('hex');
    if (position !== input.asset.byteSize || copiedDigest !== input.asset.contentDigest.hex) {
      throw new MediaCatalogInvariantError('managed original source bytes do not match immutable asset identity');
    }

    await tempHandle.sync();
    await tempHandle.close();
    tempHandle = undefined;

    try {
      await link(tempPath, input.destinationPath);
      await chmod(input.destinationPath, 0o444);
      return true;
    } catch (error) {
      if (!isNodeErrorCode(error, 'EEXIST')) throw error;
      await verifyManagedOriginal(input.destinationPath, input.asset, input.chunkSize);
      return false;
    }
  } finally {
    if (tempHandle) await tempHandle.close().catch(() => undefined);
    await sourceHandle.close().catch(() => undefined);
    await unlink(tempPath).catch((error: unknown) => {
      if (!isNodeErrorCode(error, 'ENOENT')) throw error;
    });
  }
}

async function verifyManagedOriginalIfPresent(
  destinationPath: string,
  asset: StableMediaAssetIdentity,
  chunkSize: number,
): Promise<boolean> {
  try {
    await lstat(destinationPath);
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return false;
    throw error;
  }
  await verifyManagedOriginal(destinationPath, asset, chunkSize);
  return true;
}

async function verifyManagedOriginal(
  destinationPath: string,
  asset: StableMediaAssetIdentity,
  chunkSize: number,
): Promise<void> {
  const directStats = await lstat(destinationPath);
  if (directStats.isSymbolicLink()) {
    throw new MediaCatalogInvariantError('managed original destination must not be a symbolic link');
  }

  const noFollow = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0;
  const handle = await open(destinationPath, constants.O_RDONLY | noFollow);
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new MediaCatalogInvariantError('managed original destination must be a regular file');
    if (stats.size !== asset.byteSize) {
      throw new MediaCatalogInvariantError('managed original destination size does not match immutable asset');
    }

    const hash = createHash('sha256');
    let position = 0;
    while (true) {
      const buffer = Buffer.allocUnsafe(chunkSize);
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, position);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }

    if (position !== asset.byteSize || hash.digest('hex') !== asset.contentDigest.hex) {
      throw new MediaCatalogInvariantError('managed original destination digest does not match immutable asset');
    }
  } finally {
    await handle.close();
  }
}

async function ensureOwnedDirectory(parent: string, child: string): Promise<string> {
  const requested = join(parent, child);
  await mkdir(requested, { recursive: true });
  const direct = await lstat(requested);
  if (direct.isSymbolicLink()) throw new MediaCatalogInvariantError('managed storage directory must not be a symbolic link');
  if (!direct.isDirectory()) throw new MediaCatalogInvariantError('managed storage path component must be a directory');
  const resolved = await realpath(requested);
  if (resolved !== requested) throw new MediaCatalogInvariantError('managed storage directory must resolve without indirection');
  return resolved;
}

function assertPathWithinRoot(rootPath: string, candidatePath: string, message: string): void {
  const rel = relative(rootPath, candidatePath);
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) return;
  throw new MediaCatalogInvariantError(message);
}

function normalizeChunkSize(value: number | undefined): number {
  if (value === undefined) return DEFAULT_CHUNK_SIZE;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CHUNK_SIZE) {
    throw new MediaCatalogInvariantError(`chunkSize must be a safe integer between 1 and ${MAX_CHUNK_SIZE}`);
  }
  return value;
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

async function writeAll(handle: Awaited<ReturnType<typeof open>>, chunk: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < chunk.byteLength) {
    const { bytesWritten } = await handle.write(chunk, offset, chunk.byteLength - offset);
    if (bytesWritten <= 0) throw new MediaCatalogInvariantError('managed original write made no progress');
    offset += bytesWritten;
  }
}

function isNodeErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === code;
}
