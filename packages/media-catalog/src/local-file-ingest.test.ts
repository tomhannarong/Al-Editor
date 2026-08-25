import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryMediaCatalog, MediaCatalogInvariantError } from './index.js';
import { ingestLocalMediaFile, sameLocalFileSnapshot } from './local-file-ingest.js';

const cleanupRoots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ai-editor-media-ingest-'));
  cleanupRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('confined local-file immutable ingest', () => {
  it('hashes a regular file inside the allowed root and derives the location URI from its resolved path', async () => {
    const root = await tempRoot();
    const mediaDir = join(root, 'camera');
    await mkdir(mediaDir);
    const filePath = join(mediaDir, 'clip-001.mov');
    await writeFile(filePath, 'local-footage');

    const catalog = new InMemoryMediaCatalog();
    const first = await ingestLocalMediaFile({
      filePath,
      allowedRoot: root,
      firstIngestedAt: '2026-08-25T01:00:00.000Z',
      locationId: 'camera-clip-001',
      observedAt: '2026-08-25T01:00:00.000Z',
      chunkSize: 3,
    }, catalog);
    const second = await ingestLocalMediaFile({
      filePath,
      allowedRoot: root,
      firstIngestedAt: '2026-08-25T02:00:00.000Z',
      locationId: 'camera-clip-001-reingest',
      observedAt: '2026-08-25T02:00:00.000Z',
    }, catalog);

    expect(first.assetCreated).toBe(true);
    expect(second.assetCreated).toBe(false);
    expect(second.asset.assetId).toBe(first.asset.assetId);
    expect(second.asset.firstIngestedAt).toBe('2026-08-25T01:00:00.000Z');
    expect(first.location.uri).toBe(pathToFileURL(filePath).href);
  });

  it('fails closed when a requested file resolves outside the allowed root', async () => {
    const root = await tempRoot();
    const outsideRoot = await tempRoot();
    const outsideFile = join(outsideRoot, 'outside.mov');
    await writeFile(outsideFile, 'outside');

    await expect(ingestLocalMediaFile({
      filePath: outsideFile,
      allowedRoot: root,
      firstIngestedAt: '2026-08-25T01:00:00.000Z',
      locationId: 'escape',
      observedAt: '2026-08-25T01:00:00.000Z',
    }, new InMemoryMediaCatalog())).rejects.toThrow('escapes allowedRoot');
  });

  it('rejects a symbolic-link media path even when its target is inside the allowed root', async () => {
    const root = await tempRoot();
    const target = join(root, 'target.mov');
    const link = join(root, 'linked.mov');
    await writeFile(target, 'target');
    await symlink(target, link);

    await expect(ingestLocalMediaFile({
      filePath: link,
      allowedRoot: root,
      firstIngestedAt: '2026-08-25T01:00:00.000Z',
      locationId: 'symlink',
      observedAt: '2026-08-25T01:00:00.000Z',
    }, new InMemoryMediaCatalog())).rejects.toThrow('must not be a symbolic link');
  });

  it('treats inode/size/mtime/ctime changes as an unstable ingest snapshot', () => {
    const stable = { device: 1, inode: 2, byteSize: 3, modifiedAtMs: 4, changedAtMs: 5 };
    expect(sameLocalFileSnapshot(stable, { ...stable })).toBe(true);
    expect(sameLocalFileSnapshot(stable, { ...stable, inode: 9 })).toBe(false);
    expect(sameLocalFileSnapshot(stable, { ...stable, byteSize: 9 })).toBe(false);
    expect(sameLocalFileSnapshot(stable, { ...stable, modifiedAtMs: 9 })).toBe(false);
    expect(sameLocalFileSnapshot(stable, { ...stable, changedAtMs: 9 })).toBe(false);
  });

  it('rejects unsafe read chunk sizes before publishing catalog state', async () => {
    const root = await tempRoot();
    const filePath = join(root, 'clip.mov');
    await writeFile(filePath, 'clip');

    await expect(ingestLocalMediaFile({
      filePath,
      allowedRoot: root,
      firstIngestedAt: '2026-08-25T01:00:00.000Z',
      locationId: 'bad-chunk',
      observedAt: '2026-08-25T01:00:00.000Z',
      chunkSize: 0,
    }, new InMemoryMediaCatalog())).rejects.toBeInstanceOf(MediaCatalogInvariantError);
  });
});
