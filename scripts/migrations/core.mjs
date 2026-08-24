import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const MIGRATION_FILENAME_RE = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

export async function discoverMigrations(directory) {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql'));
  const migrations = [];
  const seenVersions = new Set();

  for (const filename of names.sort()) {
    const match = MIGRATION_FILENAME_RE.exec(filename);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    const version = Number(match[1]);
    const name = match[2];
    if (!Number.isSafeInteger(version) || version <= 0) throw new Error(`Invalid migration version: ${filename}`);
    if (seenVersions.has(version)) throw new Error(`Duplicate migration version: ${String(version).padStart(4, '0')}`);
    seenVersions.add(version);

    const bytes = await readFile(path.join(directory, filename));
    if (bytes.length === 0) throw new Error(`Migration is empty: ${filename}`);
    const text = bytes.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) throw new Error(`Migration must not contain UTF-8 BOM: ${filename}`);
    const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
    migrations.push({ version, name, filename, checksumSha256, bytes: bytes.length });
  }

  migrations.sort((a, b) => a.version - b.version);
  for (let i = 0; i < migrations.length; i += 1) {
    const expected = i + 1;
    if (migrations[i].version !== expected) {
      throw new Error(`Migration sequence must be contiguous from 0001; expected ${String(expected).padStart(4, '0')} but found ${migrations[i].filename}`);
    }
  }
  return migrations;
}

export function planMigrations(localMigrations, appliedHistory) {
  if (!Array.isArray(appliedHistory)) throw new Error('Applied migration history must be an array.');
  const localByVersion = new Map(localMigrations.map((migration) => [migration.version, migration]));
  const seenApplied = new Set();
  let previousVersion = 0;

  for (const applied of appliedHistory) {
    if (!applied || !Number.isSafeInteger(applied.version) || applied.version <= 0) {
      throw new Error('Applied migration version must be a positive safe integer.');
    }
    if (seenApplied.has(applied.version)) throw new Error(`Applied history contains duplicate version ${applied.version}.`);
    if (applied.version <= previousVersion) throw new Error('Applied migration history must be strictly increasing.');
    seenApplied.add(applied.version);
    previousVersion = applied.version;

    const local = localByVersion.get(applied.version);
    if (!local) throw new Error(`Database contains unknown migration version ${applied.version}.`);
    if (applied.name !== local.name) throw new Error(`Migration name drift detected at version ${applied.version}.`);
    if (applied.checksumSha256 !== local.checksumSha256) throw new Error(`Migration checksum drift detected at version ${applied.version}.`);
  }

  const pending = localMigrations.filter((migration) => !seenApplied.has(migration.version));
  if (pending.length > 0 && previousVersion > pending[0].version) {
    throw new Error('Applied history has advanced past a missing local migration.');
  }
  return { appliedCount: appliedHistory.length, pending };
}

export function serializableManifest(migrations) {
  return migrations.map(({ version, name, filename, checksumSha256, bytes }) => ({ version, name, filename, checksumSha256, bytes }));
}
