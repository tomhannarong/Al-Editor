export const ASSET_PROVENANCE_SCHEMA_VERSION = '1.0' as const;

export const ASSET_PROVENANCE_SUBJECT_KINDS = [
  'original-media',
  'derived-media',
  'stock-media',
  'music',
  'sfx',
  'font',
  'template',
  'voice',
  'ai-generated-asset',
] as const;

export const ASSET_RIGHTS_BASES = [
  'owned',
  'licensed',
  'permission',
  'public-domain',
  'generated',
  'unknown',
] as const;

export const ASSET_PUBLICATION_READINESS = [
  'cleared',
  'restricted',
  'blocked',
  'unreviewed',
] as const;

export const ASSET_CONSENT_STATUSES = [
  'not-applicable',
  'not-required',
  'obtained',
  'restricted',
  'unknown',
] as const;

export type AssetProvenanceSubjectKind = (typeof ASSET_PROVENANCE_SUBJECT_KINDS)[number];
export type AssetRightsBasis = (typeof ASSET_RIGHTS_BASES)[number];
export type AssetPublicationReadiness = (typeof ASSET_PUBLICATION_READINESS)[number];
export type AssetConsentStatus = (typeof ASSET_CONSENT_STATUSES)[number];

export interface AssetProvenanceSubjectV1 {
  kind: AssetProvenanceSubjectKind;
  assetId: string;
  checksumSha256: string | null;
}

export interface AssetSourceOriginV1 {
  origin: string;
  provider: string | null;
  externalId: string | null;
  sourceUri: string | null;
  importedAt: string;
  importedBy: string;
}

export interface AssetLicenseEvidenceV1 {
  evidenceId: string;
  licenseId: string | null;
  licenseUri: string | null;
  validFrom: string | null;
  validUntil: string | null;
}

export interface AssetConsentEvidenceV1 {
  status: AssetConsentStatus;
  evidenceId: string | null;
}

export interface AssetAttributionPolicyV1 {
  required: boolean;
  text: string | null;
}

export interface AssetRightsPolicyV1 {
  basis: AssetRightsBasis;
  publicationReadiness: AssetPublicationReadiness;
  commercialUseAllowed: boolean | null;
  derivativeUseAllowed: boolean | null;
  rightsHolder: string | null;
  licenseEvidence: AssetLicenseEvidenceV1 | null;
  consent: AssetConsentEvidenceV1;
  attribution: AssetAttributionPolicyV1;
  restrictions: string[];
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface AssetProvenanceV1 {
  schemaVersion: typeof ASSET_PROVENANCE_SCHEMA_VERSION;
  provenanceId: string;
  workspaceId: string;
  subject: AssetProvenanceSubjectV1;
  source: AssetSourceOriginV1;
  rights: AssetRightsPolicyV1;
  createdAt: string;
  updatedAt: string;
}

export interface AssetProvenanceValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function validateAssetProvenanceV1(
  provenance: AssetProvenanceV1,
): AssetProvenanceValidationResult {
  const errors: string[] = [];

  if (provenance.schemaVersion !== ASSET_PROVENANCE_SCHEMA_VERSION) {
    errors.push('schemaVersion must be 1.0');
  }
  if (!provenance.provenanceId.trim() || !provenance.workspaceId.trim()) {
    errors.push('provenanceId and workspaceId are required');
  }
  if (!provenance.subject.assetId.trim()) {
    errors.push('subject assetId is required');
  }
  if (
    provenance.subject.checksumSha256 !== null &&
    !SHA256_PATTERN.test(provenance.subject.checksumSha256)
  ) {
    errors.push('subject checksumSha256 must be null or a 64-character SHA-256 hex digest');
  }
  if (!provenance.source.origin.trim() || !provenance.source.importedBy.trim()) {
    errors.push('source origin and importedBy are required');
  }

  const { rights } = provenance;
  if (rights.publicationReadiness === 'cleared') {
    if (rights.basis === 'unknown') {
      errors.push('cleared publication readiness cannot use unknown rights basis');
    }
    if (rights.reviewedAt === null || rights.reviewedBy === null || !rights.reviewedBy.trim()) {
      errors.push('cleared publication readiness requires reviewedAt and reviewedBy');
    }
  }

  if ((rights.basis === 'licensed' || rights.basis === 'permission') && rights.licenseEvidence === null) {
    errors.push('licensed or permission rights basis requires licenseEvidence');
  }

  if (rights.attribution.required && (rights.attribution.text === null || !rights.attribution.text.trim())) {
    errors.push('attribution text is required when attribution is required');
  }
  if (!rights.attribution.required && rights.attribution.text !== null) {
    errors.push('attribution text must be null when attribution is not required');
  }

  if (
    (rights.consent.status === 'obtained' || rights.consent.status === 'restricted') &&
    (rights.consent.evidenceId === null || !rights.consent.evidenceId.trim())
  ) {
    errors.push('obtained or restricted consent requires durable evidenceId');
  }

  if (
    rights.publicationReadiness === 'cleared' &&
    (rights.commercialUseAllowed !== true || rights.derivativeUseAllowed !== true)
  ) {
    errors.push('cleared publication readiness requires explicit commercial and derivative use allowance');
  }

  return { valid: errors.length === 0, errors };
}
