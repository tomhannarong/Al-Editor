import {
  normalizeCanonicalRational,
  validateCanonicalTimelineV2,
  type CanonicalRational,
  type CanonicalTimelineV2,
} from './canonical-timeline.contract.js';

export const OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION = '1.0' as const;
export const OTIO_DAVINCI_TARGET_NLE = 'davinci-resolve' as const;
export const OTIO_INTERCHANGE_FORMAT = 'otio' as const;

export interface OtioDavinciTargetProfileV1 {
  nle: typeof OTIO_DAVINCI_TARGET_NLE;
  interchangeFormat: typeof OTIO_INTERCHANGE_FORMAT;
  profileId: string;
  profileVersion: string;
}

export interface OtioDavinciTimelineRefV1 {
  timelineId: string;
  revisionId: string;
  manifestSha256: string;
}

export interface OtioDavinciRelinkPathV1 {
  kind: 'project-relative-posix';
  value: string;
}

/**
 * Immutable interchange evidence copied from the canonical item only for exact
 * adapter/relink verification. Canonical timeline v2 remains the timing/source authority.
 */
export interface OtioDavinciMediaMappingV1 {
  itemId: string;
  assetId: string;
  assetSha256: string;
  streamId: string;
  streamIndex: number;
  sourceStartPts: number;
  sourceEndPts: number;
  sourceTimeBase: CanonicalRational;
  relinkPath: OtioDavinciRelinkPathV1;
}

export interface OtioDavinciInterchangeManifestV1 {
  schemaVersion: typeof OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION;
  manifestId: string;
  revisionId: string;
  target: OtioDavinciTargetProfileV1;
  timeline: OtioDavinciTimelineRefV1;
  mediaMappings: readonly OtioDavinciMediaMappingV1[];
  createdAt: string;
}

export interface OtioDavinciInterchangeValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256 = /^[a-f0-9]{64}$/i;
const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};

function sameRational(left: CanonicalRational, right: CanonicalRational): boolean {
  const a = normalizeCanonicalRational(left);
  const b = normalizeCanonicalRational(right);
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

function validProjectRelativePosixPath(value: string): boolean {
  if (!value.trim() || value.includes('\\') || value.includes('\0') || value.startsWith('/')) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export function validateOtioDavinciInterchangeManifestV1(
  manifest: OtioDavinciInterchangeManifestV1,
): OtioDavinciInterchangeValidationResult {
  const errors: string[] = [];

  if (manifest.schemaVersion !== OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION) {
    errors.push('schemaVersion must be 1.0');
  }
  if (!nonEmpty(manifest.manifestId)) errors.push('manifestId is required');
  if (!pinned(manifest.revisionId)) errors.push('revisionId must be pinned and must not use a mutable alias');

  if (manifest.target.nle !== OTIO_DAVINCI_TARGET_NLE) errors.push('target.nle must be davinci-resolve');
  if (manifest.target.interchangeFormat !== OTIO_INTERCHANGE_FORMAT) errors.push('target.interchangeFormat must be otio');
  if (!nonEmpty(manifest.target.profileId)) errors.push('target.profileId is required');
  if (!pinned(manifest.target.profileVersion)) {
    errors.push('target.profileVersion must be pinned and must not use a mutable alias');
  }

  if (!nonEmpty(manifest.timeline.timelineId)) errors.push('timeline.timelineId is required');
  if (!pinned(manifest.timeline.revisionId)) {
    errors.push('timeline.revisionId must be pinned and must not use a mutable alias');
  }
  if (!SHA256.test(manifest.timeline.manifestSha256)) {
    errors.push('timeline.manifestSha256 must be a SHA-256 hex digest');
  }
  if (!Number.isFinite(Date.parse(manifest.createdAt))) errors.push('createdAt must be a valid timestamp');

  const seenItems = new Set<string>();
  for (const mapping of manifest.mediaMappings) {
    if (!nonEmpty(mapping.itemId)) errors.push('mediaMappings.itemId is required');
    if (seenItems.has(mapping.itemId)) errors.push(`duplicate media mapping itemId ${mapping.itemId}`);
    seenItems.add(mapping.itemId);

    if (!SHA256.test(mapping.assetSha256)) errors.push(`invalid assetSha256 for ${mapping.itemId}`);
    if (SHA256.test(mapping.assetSha256) && mapping.assetId !== `sha256:${mapping.assetSha256.toLowerCase()}`) {
      errors.push(`assetId must equal content-addressed SHA-256 identity for ${mapping.itemId}`);
    }
    if (!nonEmpty(mapping.streamId)) errors.push(`streamId is required for ${mapping.itemId}`);
    if (!Number.isSafeInteger(mapping.streamIndex) || mapping.streamIndex < 0) {
      errors.push(`invalid streamIndex for ${mapping.itemId}`);
    }
    if (!Number.isSafeInteger(mapping.sourceStartPts) || !Number.isSafeInteger(mapping.sourceEndPts) || mapping.sourceEndPts <= mapping.sourceStartPts) {
      errors.push(`invalid native PTS range for ${mapping.itemId}`);
    }
    try {
      normalizeCanonicalRational(mapping.sourceTimeBase);
    } catch (error) {
      errors.push(`invalid sourceTimeBase for ${mapping.itemId}: ${String(error)}`);
    }
    if (mapping.relinkPath.kind !== 'project-relative-posix' || !validProjectRelativePosixPath(mapping.relinkPath.value)) {
      errors.push(`invalid confined relinkPath for ${mapping.itemId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateOtioDavinciManifestAgainstCanonicalTimelineV2(
  manifest: OtioDavinciInterchangeManifestV1,
  timeline: CanonicalTimelineV2,
): OtioDavinciInterchangeValidationResult {
  const errors = [...validateOtioDavinciInterchangeManifestV1(manifest).errors];
  const timelineValidation = validateCanonicalTimelineV2(timeline);
  if (!timelineValidation.valid) errors.push(...timelineValidation.errors.map((error) => `canonical timeline: ${error}`));

  if (manifest.timeline.timelineId !== timeline.timelineId) errors.push('manifest timelineId must match canonical timeline');
  if (manifest.timeline.revisionId !== timeline.revisionId) errors.push('manifest revisionId must match canonical timeline revision');
  if (manifest.timeline.manifestSha256.toLowerCase() !== timeline.manifestSha256.toLowerCase()) {
    errors.push('manifest timeline SHA-256 must match canonical timeline manifest evidence');
  }

  const canonicalMediaItems = timeline.items.filter(
    (item) => item.kind === 'asset-video' || item.kind === 'source-audio',
  );
  const mappingByItemId = new Map(manifest.mediaMappings.map((mapping) => [mapping.itemId, mapping]));

  for (const item of canonicalMediaItems) {
    const mapping = mappingByItemId.get(item.itemId);
    if (!mapping) {
      errors.push(`missing media mapping for canonical item ${item.itemId}`);
      continue;
    }
    if (mapping.assetId !== item.assetId) errors.push(`assetId mismatch for ${item.itemId}`);
    if (mapping.streamIndex !== item.source.streamIndex) errors.push(`streamIndex mismatch for ${item.itemId}`);
    if (mapping.sourceStartPts !== item.source.sourceStartPts || mapping.sourceEndPts !== item.source.sourceEndPts) {
      errors.push(`native PTS mismatch for ${item.itemId}`);
    }
    try {
      if (!sameRational(mapping.sourceTimeBase, item.source.sourceTimeBase)) {
        errors.push(`sourceTimeBase mismatch for ${item.itemId}`);
      }
    } catch {
      // Individual validators already report malformed rationals.
    }
  }

  for (const mapping of manifest.mediaMappings) {
    if (!canonicalMediaItems.some((item) => item.itemId === mapping.itemId)) {
      errors.push(`media mapping ${mapping.itemId} does not exist in canonical timeline revision`);
    }
  }

  return { valid: errors.length === 0, errors };
}
