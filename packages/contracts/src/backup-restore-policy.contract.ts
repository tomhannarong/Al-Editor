export const BACKUP_RESTORE_POLICY_SCHEMA_VERSION = '1.0' as const;
export const BACKUP_RESTORE_DRILL_SCHEMA_VERSION = '1.0' as const;

export type DurableStoreV1 = 'postgresql' | 'qdrant';
export type BackupMethodV1 = 'pg-custom-dump' | 'qdrant-collection-snapshot';

export interface BackupRestoreStorePolicyV1 {
  store: DurableStoreV1;
  backupMethod: BackupMethodV1;
  integrityAlgorithm: 'sha256';
  cleanTargetRestoreRequired: true;
}

export interface BackupRestorePolicyV1 {
  schemaVersion: typeof BACKUP_RESTORE_POLICY_SCHEMA_VERSION;
  policyId: string;
  revisionId: string;
  restoreOwner: string;
  rpoSeconds: number;
  rtoSeconds: number;
  stores: readonly BackupRestoreStorePolicyV1[];
}

export interface BackupRestoreStoreDrillEvidenceV1 {
  store: DurableStoreV1;
  artifactSha256: string;
  sourceIdentity: string;
  targetIdentity: string;
  restoredRecordCount: number;
}

export interface BackupRestoreDrillEvidenceV1 {
  schemaVersion: typeof BACKUP_RESTORE_DRILL_SCHEMA_VERSION;
  policyId: string;
  policyRevisionId: string;
  startedAt: string;
  completedAt: string;
  restoreDurationMs: number;
  cleanTargetVerified: true;
  stores: readonly BackupRestoreStoreDrillEvidenceV1[];
}

export interface BackupRestoreValidationResult {
  valid: boolean;
  errors: string[];
}

const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const SHA256 = /^[a-f0-9]{64}$/;
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};
const positiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

export function validateBackupRestorePolicyV1(policy: BackupRestorePolicyV1): BackupRestoreValidationResult {
  const errors: string[] = [];
  if (policy.schemaVersion !== BACKUP_RESTORE_POLICY_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (!nonEmpty(policy.policyId)) errors.push('policyId is required');
  if (!pinned(policy.revisionId)) errors.push('revisionId must be pinned and must not use a mutable alias');
  if (!nonEmpty(policy.restoreOwner)) errors.push('restoreOwner is required');
  if (!positiveSafeInteger(policy.rpoSeconds)) errors.push('rpoSeconds must be a positive safe integer');
  if (!positiveSafeInteger(policy.rtoSeconds)) errors.push('rtoSeconds must be a positive safe integer');

  const seen = new Set<DurableStoreV1>();
  for (const [index, store] of policy.stores.entries()) {
    const prefix = `stores[${index}]`;
    if (seen.has(store.store)) errors.push(`${prefix}.store must be unique`);
    seen.add(store.store);
    if (store.integrityAlgorithm !== 'sha256') errors.push(`${prefix}.integrityAlgorithm must be sha256`);
    if (store.cleanTargetRestoreRequired !== true) errors.push(`${prefix}.cleanTargetRestoreRequired must be true`);
    if (store.store === 'postgresql' && store.backupMethod !== 'pg-custom-dump') {
      errors.push(`${prefix}.backupMethod must be pg-custom-dump for postgresql`);
    }
    if (store.store === 'qdrant' && store.backupMethod !== 'qdrant-collection-snapshot') {
      errors.push(`${prefix}.backupMethod must be qdrant-collection-snapshot for qdrant`);
    }
  }
  if (!seen.has('postgresql')) errors.push('stores must include postgresql');
  if (!seen.has('qdrant')) errors.push('stores must include qdrant');
  if (policy.stores.length !== 2) errors.push('stores must contain exactly postgresql and qdrant');
  return { valid: errors.length === 0, errors };
}

export function validateBackupRestoreDrillEvidenceV1(
  policy: BackupRestorePolicyV1,
  evidence: BackupRestoreDrillEvidenceV1,
): BackupRestoreValidationResult {
  const errors = validateBackupRestorePolicyV1(policy).errors.slice();
  if (evidence.schemaVersion !== BACKUP_RESTORE_DRILL_SCHEMA_VERSION) errors.push('evidence.schemaVersion must be 1.0');
  if (evidence.policyId !== policy.policyId) errors.push('evidence.policyId must match policy');
  if (evidence.policyRevisionId !== policy.revisionId) errors.push('evidence.policyRevisionId must match policy revision');
  const started = Date.parse(evidence.startedAt);
  const completed = Date.parse(evidence.completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    errors.push('evidence timestamps must be valid and ordered');
  }
  if (!Number.isSafeInteger(evidence.restoreDurationMs) || evidence.restoreDurationMs < 0) {
    errors.push('evidence.restoreDurationMs must be a non-negative safe integer');
  } else if (evidence.restoreDurationMs > policy.rtoSeconds * 1000) {
    errors.push('evidence.restoreDurationMs exceeds policy RTO');
  }
  if (evidence.cleanTargetVerified !== true) errors.push('evidence.cleanTargetVerified must be true');

  const expectedStores = new Set(policy.stores.map((entry) => entry.store));
  const seen = new Set<DurableStoreV1>();
  for (const [index, store] of evidence.stores.entries()) {
    const prefix = `evidence.stores[${index}]`;
    if (!expectedStores.has(store.store)) errors.push(`${prefix}.store is not covered by policy`);
    if (seen.has(store.store)) errors.push(`${prefix}.store must be unique`);
    seen.add(store.store);
    if (!SHA256.test(store.artifactSha256)) errors.push(`${prefix}.artifactSha256 must be lowercase SHA-256 hex`);
    if (!nonEmpty(store.sourceIdentity) || !nonEmpty(store.targetIdentity)) errors.push(`${prefix} source/target identity is required`);
    if (store.sourceIdentity === store.targetIdentity) errors.push(`${prefix} target must be distinct from source for clean-target proof`);
    if (!Number.isSafeInteger(store.restoredRecordCount) || store.restoredRecordCount <= 0) {
      errors.push(`${prefix}.restoredRecordCount must be a positive safe integer`);
    }
  }
  for (const store of expectedStores) if (!seen.has(store)) errors.push(`evidence is missing ${store}`);
  if (evidence.stores.length !== expectedStores.size) errors.push('evidence stores must exactly match policy stores');
  return { valid: errors.length === 0, errors };
}

export const PHASE13_BACKUP_RESTORE_POLICY_V1: BackupRestorePolicyV1 = Object.freeze({
  schemaVersion: BACKUP_RESTORE_POLICY_SCHEMA_VERSION,
  policyId: 'backup-restore:phase13',
  revisionId: 'backup-restore:phase13:r1',
  restoreOwner: 'platform-operations',
  rpoSeconds: 3600,
  rtoSeconds: 900,
  stores: Object.freeze([
    Object.freeze({ store: 'postgresql', backupMethod: 'pg-custom-dump', integrityAlgorithm: 'sha256', cleanTargetRestoreRequired: true }),
    Object.freeze({ store: 'qdrant', backupMethod: 'qdrant-collection-snapshot', integrityAlgorithm: 'sha256', cleanTargetRestoreRequired: true }),
  ]),
});
