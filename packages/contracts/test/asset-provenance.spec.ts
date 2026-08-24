import { describe, expect, it } from 'vitest';

import {
  type AssetProvenanceV1,
  validateAssetProvenanceV1,
} from '../src/asset-provenance.contract.js';

const validOwnedAsset = (): AssetProvenanceV1 => ({
  schemaVersion: '1.0',
  provenanceId: 'prov-media-001-v1',
  workspaceId: 'workspace-001',
  subject: {
    kind: 'original-media',
    assetId: 'media-001',
    checksumSha256: 'a'.repeat(64),
  },
  source: {
    origin: 'camera-import',
    provider: null,
    externalId: null,
    sourceUri: null,
    importedAt: '2026-08-24T00:00:00.000Z',
    importedBy: 'user-001',
  },
  rights: {
    basis: 'owned',
    publicationReadiness: 'cleared',
    commercialUseAllowed: true,
    derivativeUseAllowed: true,
    rightsHolder: 'workspace-owner',
    licenseEvidence: null,
    consent: { status: 'not-applicable', evidenceId: null },
    attribution: { required: false, text: null },
    restrictions: [],
    reviewedAt: '2026-08-24T00:05:00.000Z',
    reviewedBy: 'user-001',
  },
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:05:00.000Z',
});

describe('validateAssetProvenanceV1', () => {
  it('accepts a reviewed owned asset explicitly cleared for commercial derivative publication', () => {
    expect(validateAssetProvenanceV1(validOwnedAsset())).toEqual({ valid: true, errors: [] });
  });

  it('allows unknown/unreviewed provenance without claiming publication clearance', () => {
    const provenance = validOwnedAsset();
    provenance.rights.basis = 'unknown';
    provenance.rights.publicationReadiness = 'unreviewed';
    provenance.rights.commercialUseAllowed = null;
    provenance.rights.derivativeUseAllowed = null;
    provenance.rights.reviewedAt = null;
    provenance.rights.reviewedBy = null;
    expect(validateAssetProvenanceV1(provenance)).toEqual({ valid: true, errors: [] });
  });

  it('fails closed for unknown or non-explicit cleared rights', () => {
    const provenance = validOwnedAsset();
    provenance.rights.basis = 'unknown';
    provenance.rights.commercialUseAllowed = null;
    provenance.rights.derivativeUseAllowed = false;
    provenance.rights.reviewedAt = null;
    provenance.rights.reviewedBy = null;
    const result = validateAssetProvenanceV1(provenance);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('cleared publication readiness cannot use unknown rights basis');
    expect(result.errors).toContain('cleared publication readiness requires reviewedAt and reviewedBy');
    expect(result.errors).toContain('cleared publication readiness requires explicit commercial and derivative use allowance');
  });

  it('requires license and attribution evidence when applicable', () => {
    const provenance = validOwnedAsset();
    provenance.rights.basis = 'licensed';
    provenance.rights.licenseEvidence = null;
    provenance.rights.attribution.required = true;
    provenance.rights.attribution.text = null;
    const result = validateAssetProvenanceV1(provenance);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('licensed or permission rights basis requires licenseEvidence');
    expect(result.errors).toContain('attribution text is required when attribution is required');
  });

  it('requires durable consent evidence when consent is obtained or restricted', () => {
    const provenance = validOwnedAsset();
    provenance.rights.consent.status = 'obtained';
    provenance.rights.consent.evidenceId = null;
    expect(validateAssetProvenanceV1(provenance).errors).toContain('obtained or restricted consent requires durable evidenceId');
  });

  it('rejects malformed content digests', () => {
    const provenance = validOwnedAsset();
    provenance.subject.checksumSha256 = 'not-a-sha256';
    expect(validateAssetProvenanceV1(provenance).errors).toContain('subject checksumSha256 must be null or a 64-character SHA-256 hex digest');
  });
});
