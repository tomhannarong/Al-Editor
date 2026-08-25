import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryMediaCatalog, MediaCatalogInvariantError } from './index.js';
import { ingestLocalMediaFile } from './local-file-ingest.js';
import { materializeManagedOriginal } from './managed-original.js';

const cleanupRoots: string[] = [];

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  cleanupRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function registerSource(bytes = 'managed-original-bytes') {
  const sourceRoot = await tempRoot('ai-editor-source-');
  const managedRoot = await tempRoot('ai-editor-managed-');
  const sourcePath = join(sourceRoot, 'camera.mov');
  await writeFile(sourcePath, bytes);

  const catalog = new InMemoryMediaCatalog();
  const ingested = await ingestLocalMediaFile({
    filePath: sourcePath,
    allowedRoot: sourceRoot,
    firstIngestedAt: '2026-08-25T03:00:00.000Z',
    locationId: 'source-camera',
    observedAt: '2026-08-25T03:00:00.000Z',
    chunkSize: 4,
  }, catalog);

  return { sourceRoot, managedRoot, sourcePath, catalog, ingested };
}

describe('managed content-addressed original materialization', () => {
  it('copies a registered asset into a SHA-256-derived path and publishes location only after byte verification', async () => {
    const fixture = await registerSource();
    const result = await materializeManagedOriginal({
      sourceFilePath: fixture.sourcePath,
      allowedSourceRoot: fixture.sourceRoot,
      managedRoot: fixture.managedRoot,
      asset: fixture.ingested.asset,
      locationId: 'managed-original',
      observedAt: '2026-08-25T03:05:00.000Z',
      chunkSize: 3,
    }, fixture.catalog);

    const digest = fixture.ingested.asset.contentDigest.hex;
    const expectedPath = join(fixture.managedRoot, 'sha256', digest.slice(0, 2), digest);
    expect(result.created).toBe(true);
    expect(result.destinationPath).toBe(expectedPath);
    expect(result.location.uri).toBe(pathToFileURL(expectedPath).href);
    expect(await readFile(expectedPath, 'utf8')).toBe('managed-original-bytes');
    expect((await stat(expectedPath)).mode & 0o777).toBe(0o444);
  });

  it('is idempotent for an existing verified managed original and never creates a second content path', async () => {
    const fixture = await registerSource();
    const first = await materializeManagedOriginal({
      sourceFilePath: fixture.sourcePath,
      allowedSourceRoot: fixture.sourceRoot,
      managedRoot: fixture.managedRoot,
      asset: fixture.ingested.asset,
      locationId: 'managed-original-a',
      observedAt: '2026-08-25T03:05:00.000Z',
    }, fixture.catalog);
    const second = await materializeManagedOriginal({
      sourceFilePath: fixture.sourcePath,
      allowedSourceRoot: fixture.sourceRoot,
      managedRoot: fixture.managedRoot,
      asset: fixture.ingested.asset,
      locationId: 'managed-original-b',
      observedAt: '2026-08-25T03:06:00.000Z',
    }, fixture.catalog);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.destinationPath).toBe(first.destinationPath);
    expect(second.asset.assetId).toBe(first.asset.assetId);
  });

  it('fails closed on a corrupted pre-existing content path and does not publish managed location state', async () => {
    const fixture = await registerSource();
    const digest = fixture.ingested.asset.contentDigest.hex;
    const shard = join(fixture.managedRoot, 'sha256', digest.slice(0, 2));
    await mkdir(shard, { recursive: true });
    const destination = join(shard, digest);
    await writeFile(destination, 'corrupted-managed-original');

    await expect(materializeManagedOriginal({
      sourceFilePath: fixture.sourcePath,
      allowedSourceRoot: fixture.sourceRoot,
      managedRoot: fixture.managedRoot,
      asset: fixture.ingested.asset,
      locationId: 'managed-corrupt',
      observedAt: '2026-08-25T03:05:00.000Z',
    }, fixture.catalog)).rejects.toThrow('does not match immutable asset');

    expect(fixture.catalog.getLocation('managed-corrupt')).toBeUndefined();
  });

  it('rejects source bytes that no longer match the registered immutable asset before publishing managed state', async () => {
    const fixture = await registerSource();
    await writeFile(fixture.sourcePath, 'different-bytes-after-registration');

    await expect(materializeManagedOriginal({
      sourceFilePath: fixture.sourcePath,
      allowedSourceRoot: fixture.sourceRoot,
      managedRoot: fixture.managedRoot,
      asset: fixture.ingested.asset,
      locationId: 'managed-mismatch',
      observedAt: '2026-08-25T03:05:00.000Z',
      chunkSize: 2,
    }, fixture.catalog)).rejects.toThrow('do not match immutable asset identity');

    expect(fixture.catalog.getLocation('managed-mismatch')).toBeUndefined();
  });

  it('requires the exact immutable asset to already exist in catalog persistence', async () => {
    const sourceRoot = await tempRoot('ai-editor-source-');
    const managedRoot = await tempRoot('ai-editor-managed-');
    const sourcePath = join(sourceRoot, 'unknown.mov');
    const bytes = Buffer.from('unknown');
    await writeFile(sourcePath, bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');

    await expect(materializeManagedOriginal({
      sourceFilePath: sourcePath,
      allowedSourceRoot: sourceRoot,
      managedRoot,
      asset: {
        schemaVersion: 'media-asset-identity/v1',
        assetId: `sha256:${digest}`,
        contentDigest: { algorithm: 'sha256', hex: digest },
        byteSize: bytes.byteLength,
        firstIngestedAt: '2026-08-25T03:00:00.000Z',
      },
      locationId: 'unknown-managed',
      observedAt: '2026-08-25T03:05:00.000Z',
    }, new InMemoryMediaCatalog())).rejects.toBeInstanceOf(MediaCatalogInvariantError);
  });
});
