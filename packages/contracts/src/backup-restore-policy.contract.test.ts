import { describe, expect, it } from 'vitest';
import {
  PHASE13_BACKUP_RESTORE_POLICY_V1,
  validateBackupRestoreDrillEvidenceV1,
  validateBackupRestorePolicyV1,
  type BackupRestoreDrillEvidenceV1,
  type BackupRestorePolicyV1,
} from './backup-restore-policy.contract.js';

describe('backup/restore policy v1', () => {
  it('accepts the pinned Phase-13 policy', () => {
    expect(validateBackupRestorePolicyV1(PHASE13_BACKUP_RESTORE_POLICY_V1)).toEqual({ valid: true, errors: [] });
  });

  it('fails closed on mutable revisions, missing stores and invalid objectives', () => {
    const invalid: BackupRestorePolicyV1 = {
      ...PHASE13_BACKUP_RESTORE_POLICY_V1,
      revisionId: 'latest',
      rpoSeconds: 0,
      stores: [PHASE13_BACKUP_RESTORE_POLICY_V1.stores[0]!],
    };
    const result = validateBackupRestorePolicyV1(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('revisionId');
    expect(result.errors.join('\n')).toContain('rpoSeconds');
    expect(result.errors.join('\n')).toContain('qdrant');
  });

  it('accepts clean-target evidence within RTO for both durable stores', () => {
    const evidence: BackupRestoreDrillEvidenceV1 = {
      schemaVersion: '1.0',
      policyId: PHASE13_BACKUP_RESTORE_POLICY_V1.policyId,
      policyRevisionId: PHASE13_BACKUP_RESTORE_POLICY_V1.revisionId,
      startedAt: '2026-08-28T00:00:00.000Z',
      completedAt: '2026-08-28T00:00:01.000Z',
      restoreDurationMs: 1000,
      cleanTargetVerified: true,
      stores: [
        { store: 'postgresql', artifactSha256: 'a'.repeat(64), sourceIdentity: 'db:source', targetIdentity: 'db:target', restoredRecordCount: 1 },
        { store: 'qdrant', artifactSha256: 'b'.repeat(64), sourceIdentity: 'collection:source', targetIdentity: 'collection:target', restoredRecordCount: 1 },
      ],
    };
    expect(validateBackupRestoreDrillEvidenceV1(PHASE13_BACKUP_RESTORE_POLICY_V1, evidence)).toEqual({ valid: true, errors: [] });
  });

  it('rejects same-target, bad checksums, missing stores and RTO breaches', () => {
    const evidence: BackupRestoreDrillEvidenceV1 = {
      schemaVersion: '1.0',
      policyId: PHASE13_BACKUP_RESTORE_POLICY_V1.policyId,
      policyRevisionId: PHASE13_BACKUP_RESTORE_POLICY_V1.revisionId,
      startedAt: '2026-08-28T00:00:00.000Z',
      completedAt: '2026-08-28T01:00:00.000Z',
      restoreDurationMs: PHASE13_BACKUP_RESTORE_POLICY_V1.rtoSeconds * 1000 + 1,
      cleanTargetVerified: true,
      stores: [
        { store: 'postgresql', artifactSha256: 'bad', sourceIdentity: 'db:same', targetIdentity: 'db:same', restoredRecordCount: 0 },
      ],
    };
    const result = validateBackupRestoreDrillEvidenceV1(PHASE13_BACKUP_RESTORE_POLICY_V1, evidence);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('exceeds policy RTO');
    expect(result.errors.join('\n')).toContain('artifactSha256');
    expect(result.errors.join('\n')).toContain('distinct from source');
    expect(result.errors.join('\n')).toContain('qdrant');
  });
});
