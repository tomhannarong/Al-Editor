import { chmod, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryMediaCatalog } from './index.js';
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

describe('managed original immutability enforcement', () => {
  it('restores a verified reused managed original to read-only mode before returning it', async () => {
    const sourceRoot = await tempRoot('ai-editor-source-mode-');
    const managedRoot = await tempRoot('ai-editor-managed-mode-');
    const sourcePath = join(sourceRoot, 'camera.mov');
    await writeFile(sourcePath, 'managed-original-mode-guard');

    const catalog = new InMemoryMediaCatalog();
    const source = await ingestLocalMediaFile({
      filePath: sourcePath,
      allowedRoot: sourceRoot,
      firstIngestedAt: '2026-08-25T08:00:00.000Z',
      locationId: 'source-mode-guard',
      observedAt: '2026-08-25T08:00:00.000Z',
    }, catalog);

    const first = await materializeManagedOriginal({
      sourceFilePath: sourcePath,
      allowedSourceRoot: sourceRoot,
      managedRoot,
      asset: source.asset,
      locationId: 'managed-mode-guard',
      observedAt: '2026-08-25T08:01:00.000Z',
    }, catalog);

    await chmod(first.destinationPath, 0o644);
    expect((await stat(first.destinationPath)).mode & 0o777).toBe(0o644);

    const reused = await materializeManagedOriginal({
      sourceFilePath: sourcePath,
      allowedSourceRoot: sourceRoot,
      managedRoot,
      asset: source.asset,
      locationId: 'managed-mode-guard',
      observedAt: '2026-08-25T08:02:00.000Z',
    }, catalog);

    expect(reused.created).toBe(false);
    expect(reused.destinationPath).toBe(first.destinationPath);
    expect((await stat(reused.destinationPath)).mode & 0o777).toBe(0o444);
  });
});
