import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverMigrations, planMigrations } from './migrations/core.mjs';

async function withTempMigrations(files, fn) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai-editor-migrations-'));
  try {
    for (const [name, content] of Object.entries(files)) await writeFile(path.join(directory, name), content);
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const valid = await withTempMigrations({
  '0001_bootstrap.sql': 'select 1;\n',
  '0002_assets.sql': 'select 2;\n',
}, discoverMigrations);
assert.deepEqual(valid.map((m) => m.version), [1, 2]);
assert.match(valid[0].checksumSha256, /^[0-9a-f]{64}$/);
assert.equal(planMigrations(valid, []).pending.length, 2);
assert.equal(planMigrations(valid, [valid[0]]).pending[0].version, 2);
assert.throws(() => planMigrations(valid, [{ ...valid[0], checksumSha256: '0'.repeat(64) }]), /checksum drift/);
assert.throws(() => planMigrations(valid, [{ version: 3, name: 'ghost', checksumSha256: '0'.repeat(64) }]), /unknown migration/);
await withTempMigrations({ '0002_gap.sql': 'select 2;\n' }, async (dir) => assert.rejects(discoverMigrations(dir), /sequence must be contiguous/));
await withTempMigrations({ '0001_bad-name.sql': 'select 1;\n' }, async (dir) => assert.rejects(discoverMigrations(dir), /Invalid migration filename/));
await withTempMigrations({ '0001_empty.sql': '' }, async (dir) => assert.rejects(discoverMigrations(dir), /Migration is empty/));
console.log('PASS: migration framework deterministic self-test succeeded (8 assertions/groups)');
