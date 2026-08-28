import {
  validateCanonicalTimelineV2,
  type CanonicalTimelineV2,
} from './canonical-timeline.contract.js';

export const RENDER_PUBLICATION_LINEAGE_SCHEMA_VERSION = '1.0' as const;
export const RENDER_PUBLICATION_LINEAGE_AUTHORITY = 'lineage-only' as const;

export interface RenderPublicationProviderRefV1 {
  providerId: string;
  externalPublicationId: string;
}

export interface RenderPublicationLineageRevisionV1 {
  schemaVersion: typeof RENDER_PUBLICATION_LINEAGE_SCHEMA_VERSION;
  authority: typeof RENDER_PUBLICATION_LINEAGE_AUTHORITY;
  publicationRecordId: string;
  revisionId: string;
  projectId: string;
  timelineId: string;
  timelineRevisionId: string;
  timelineManifestSha256: string;
  deliveryProfileVersion: string;
  renderedArtifactSha256: string;
  provider: RenderPublicationProviderRefV1;
  publishedAt: string;
  createdBy: string;
  createdAt: string;
}

export interface RenderPublicationLineageValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};

export function validateRenderPublicationLineageRevisionV1(
  record: RenderPublicationLineageRevisionV1,
): RenderPublicationLineageValidationResult {
  const errors: string[] = [];

  if (record.schemaVersion !== RENDER_PUBLICATION_LINEAGE_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (record.authority !== RENDER_PUBLICATION_LINEAGE_AUTHORITY) errors.push('authority must be lineage-only');
  if (!nonEmpty(record.publicationRecordId)) errors.push('publicationRecordId is required');
  if (!pinned(record.revisionId)) errors.push('revisionId must be pinned and must not use a mutable alias');
  if (!nonEmpty(record.projectId)) errors.push('projectId is required');
  if (!nonEmpty(record.timelineId)) errors.push('timelineId is required');
  if (!pinned(record.timelineRevisionId)) errors.push('timelineRevisionId must be pinned and must not use a mutable alias');
  if (!SHA256_PATTERN.test(record.timelineManifestSha256)) errors.push('timelineManifestSha256 must be a SHA-256 hex digest');
  if (!pinned(record.deliveryProfileVersion)) errors.push('deliveryProfileVersion must be pinned and must not use a mutable alias');
  if (!SHA256_PATTERN.test(record.renderedArtifactSha256)) errors.push('renderedArtifactSha256 must be a SHA-256 hex digest');
  if (!nonEmpty(record.provider.providerId)) errors.push('provider.providerId is required');
  if (!nonEmpty(record.provider.externalPublicationId)) errors.push('provider.externalPublicationId is required');

  const publishedAt = Date.parse(record.publishedAt);
  const createdAt = Date.parse(record.createdAt);
  if (!Number.isFinite(publishedAt)) errors.push('publishedAt must be a valid timestamp');
  if (!Number.isFinite(createdAt)) errors.push('createdAt must be a valid timestamp');
  if (Number.isFinite(publishedAt) && Number.isFinite(createdAt) && createdAt < publishedAt) {
    errors.push('createdAt must be greater than or equal to publishedAt');
  }
  if (!nonEmpty(record.createdBy)) errors.push('createdBy is required');

  return { valid: errors.length === 0, errors };
}

export function validateRenderPublicationLineageAgainstTimelineV2(
  record: RenderPublicationLineageRevisionV1,
  timeline: CanonicalTimelineV2,
): RenderPublicationLineageValidationResult {
  const recordValidation = validateRenderPublicationLineageRevisionV1(record);
  const timelineValidation = validateCanonicalTimelineV2(timeline);
  const errors = [...recordValidation.errors];

  if (!timelineValidation.valid) errors.push(...timelineValidation.errors.map((error) => `timeline: ${error}`));
  if (record.projectId !== timeline.projectId) errors.push('projectId must match the canonical timeline projectId');
  if (record.timelineId !== timeline.timelineId) errors.push('timelineId must match the canonical timeline timelineId');
  if (record.timelineRevisionId !== timeline.revisionId) errors.push('timelineRevisionId must match the canonical timeline revisionId');
  if (record.timelineManifestSha256.toLowerCase() !== timeline.manifestSha256.toLowerCase()) {
    errors.push('timelineManifestSha256 must match the canonical timeline manifestSha256');
  }
  if (record.deliveryProfileVersion !== timeline.deliveryProfileVersion) {
    errors.push('deliveryProfileVersion must match the canonical timeline deliveryProfileVersion');
  }

  return { valid: errors.length === 0, errors };
}
