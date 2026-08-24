import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverMigrations, planMigrations, serializableManifest } from './migrations/core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(repoRoot, 'db', 'migrations');
const args = process.argv.slice(2);
const historyFlag = args.indexOf('--applied-history');
let appliedHistory = [];
if (historyFlag !== -1) {
  const historyPath = args[historyFlag + 1];
  if (!historyPath) throw new Error('--applied-history requires a JSON file path.');
  appliedHistory = JSON.parse(await readFile(path.resolve(process.cwd(), historyPath), 'utf8'));
}

const migrations = await discoverMigrations(migrationsDir);
if (migrations.length === 0) throw new Error('At least one migration is required.');
const plan = planMigrations(migrations, appliedHistory);
console.log(JSON.stringify({
  valid: true,
  migrationCount: migrations.length,
  appliedCount: plan.appliedCount,
  pendingCount: plan.pending.length,
  migrations: serializableManifest(migrations),
  pendingVersions: plan.pending.map((migration) => migration.version),
}, null, 2));
