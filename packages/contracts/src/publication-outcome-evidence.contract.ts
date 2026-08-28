import {
  validateRenderPublicationLineageRevisionV1,
  type RenderPublicationLineageRevisionV1,
} from './render-publication-lineage.contract.js';

export const PUBLICATION_OUTCOME_EVIDENCE_SCHEMA_VERSION = '1.0' as const;
export const PUBLICATION_OUTCOME_EVIDENCE_AUTHORITY = 'observation-only' as const;
export const PUBLICATION_OUTCOME_EVIDENCE_SEMANTICS = 'correlation-not-causation' as const;

export const PUBLICATION_OUTCOME_UNITS = [
  'count',
  'ratio',
  'percent',
  'milliseconds',
  'seconds',
  'currency-minor-unit',
] as const;

export type PublicationOutcomeUnitV1 = (typeof PUBLICATION_OUTCOME_UNITS)[number];

export interface PublicationOutcomeMetricObservationV1 {
  metricId: string;
  unit: PublicationOutcomeUnitV1;
  value: number;
  windowStart: string;
  windowEnd: string;
  observedAt: string;
  providerEvidenceRef?: string;
}

export interface PublicationOutcomeEvidenceRevisionV1 {
  schemaVersion: typeof PUBLICATION_OUTCOME_EVIDENCE_SCHEMA_VERSION;
  authority: typeof PUBLICATION_OUTCOME_EVIDENCE_AUTHORITY;
  semantics: typeof PUBLICATION_OUTCOME_EVIDENCE_SEMANTICS;
  outcomeEvidenceId: string;
  revisionId: string;
  publicationRecordId: string;
  publicationRevisionId: string;
  providerId: string;
  externalPublicationId: string;
  observations: PublicationOutcomeMetricObservationV1[];
  collectedAt: string;
  createdBy: string;
  createdAt: string;
}

export interface PublicationOutcomeEvidenceValidationResult {
  valid: boolean;
  errors: string[];
}

const MUTABLE_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current', 'head']);
const METRIC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_OBSERVATIONS = 256;
const MAX_REFERENCE_LENGTH = 512;
const nonEmpty = (value: string): boolean => value.trim().length > 0;
const pinned = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_ALIASES.has(normalized);
};
const validTimestamp = (value: string): number => Date.parse(value);

function validateMetricValue(unit: PublicationOutcomeUnitV1, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  switch (unit) {
    case 'count':
    case 'currency-minor-unit':
      return Number.isSafeInteger(value) && value >= 0;
    case 'ratio':
      return value >= 0 && value <= 1;
    case 'percent':
      return value >= 0 && value <= 100;
    case 'milliseconds':
    case 'seconds':
      return value >= 0;
  }
  return false;
}

function validateObservation(
  observation: PublicationOutcomeMetricObservationV1,
  index: number,
  publicationTimestamp: number | undefined,
): string[] {
  const errors: string[] = [];
  const prefix = `observations[${index}]`;

  if (!METRIC_ID_PATTERN.test(observation.metricId)) {
    errors.push(`${prefix}.metricId must be 1-128 provider-neutral identifier characters`);
  }
  if (!PUBLICATION_OUTCOME_UNITS.includes(observation.unit)) {
    errors.push(`${prefix}.unit is unsupported`);
  } else if (!validateMetricValue(observation.unit, observation.value)) {
    errors.push(`${prefix}.value is invalid for unit ${observation.unit}`);
  }

  const windowStart = validTimestamp(observation.windowStart);
  const windowEnd = validTimestamp(observation.windowEnd);
  const observedAt = validTimestamp(observation.observedAt);
  if (!Number.isFinite(windowStart)) errors.push(`${prefix}.windowStart must be a valid timestamp`);
  if (!Number.isFinite(windowEnd)) errors.push(`${prefix}.windowEnd must be a valid timestamp`);
  if (!Number.isFinite(observedAt)) errors.push(`${prefix}.observedAt must be a valid timestamp`);
  if (Number.isFinite(windowStart) && Number.isFinite(windowEnd) && windowEnd < windowStart) {
    errors.push(`${prefix}.windowEnd must be greater than or equal to windowStart`);
  }
  if (Number.isFinite(windowEnd) && Number.isFinite(observedAt) && observedAt < windowEnd) {
    errors.push(`${prefix}.observedAt must be greater than or equal to windowEnd`);
  }
  if (publicationTimestamp !== undefined && Number.isFinite(windowStart) && windowStart < publicationTimestamp) {
    errors.push(`${prefix}.windowStart must be greater than or equal to publication publishedAt`);
  }
  if (
    observation.providerEvidenceRef !== undefined &&
    (!nonEmpty(observation.providerEvidenceRef) || observation.providerEvidenceRef.length > MAX_REFERENCE_LENGTH)
  ) {
    errors.push(`${prefix}.providerEvidenceRef must be non-empty and at most ${MAX_REFERENCE_LENGTH} characters when present`);
  }

  return errors;
}

export function validatePublicationOutcomeEvidenceRevisionV1(
  evidence: PublicationOutcomeEvidenceRevisionV1,
  publication?: RenderPublicationLineageRevisionV1,
): PublicationOutcomeEvidenceValidationResult {
  const errors: string[] = [];

  if (evidence.schemaVersion !== PUBLICATION_OUTCOME_EVIDENCE_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (evidence.authority !== PUBLICATION_OUTCOME_EVIDENCE_AUTHORITY) errors.push('authority must be observation-only');
  if (evidence.semantics !== PUBLICATION_OUTCOME_EVIDENCE_SEMANTICS) {
    errors.push('semantics must be correlation-not-causation');
  }
  if (!nonEmpty(evidence.outcomeEvidenceId)) errors.push('outcomeEvidenceId is required');
  if (!pinned(evidence.revisionId)) errors.push('revisionId must be pinned and must not use a mutable alias');
  if (!nonEmpty(evidence.publicationRecordId)) errors.push('publicationRecordId is required');
  if (!pinned(evidence.publicationRevisionId)) {
    errors.push('publicationRevisionId must be pinned and must not use a mutable alias');
  }
  if (!nonEmpty(evidence.providerId)) errors.push('providerId is required');
  if (!nonEmpty(evidence.externalPublicationId)) errors.push('externalPublicationId is required');
  if (!Array.isArray(evidence.observations) || evidence.observations.length === 0) {
    errors.push('observations must contain at least one metric observation');
  } else if (evidence.observations.length > MAX_OBSERVATIONS) {
    errors.push(`observations must contain at most ${MAX_OBSERVATIONS} metric observations`);
  }

  const collectedAt = validTimestamp(evidence.collectedAt);
  const createdAt = validTimestamp(evidence.createdAt);
  if (!Number.isFinite(collectedAt)) errors.push('collectedAt must be a valid timestamp');
  if (!Number.isFinite(createdAt)) errors.push('createdAt must be a valid timestamp');
  if (Number.isFinite(collectedAt) && Number.isFinite(createdAt) && createdAt < collectedAt) {
    errors.push('createdAt must be greater than or equal to collectedAt');
  }
  if (!nonEmpty(evidence.createdBy)) errors.push('createdBy is required');

  let publicationTimestamp: number | undefined;
  if (publication !== undefined) {
    const publicationValidation = validateRenderPublicationLineageRevisionV1(publication);
    errors.push(...publicationValidation.errors.map((error) => `publication: ${error}`));
    if (evidence.publicationRecordId !== publication.publicationRecordId) {
      errors.push('publicationRecordId must match the immutable publication record');
    }
    if (evidence.publicationRevisionId !== publication.revisionId) {
      errors.push('publicationRevisionId must match the immutable publication revision');
    }
    if (evidence.providerId !== publication.provider.providerId) {
      errors.push('providerId must match the publication providerId');
    }
    if (evidence.externalPublicationId !== publication.provider.externalPublicationId) {
      errors.push('externalPublicationId must match the publication externalPublicationId');
    }
    const parsedPublishedAt = validTimestamp(publication.publishedAt);
    if (Number.isFinite(parsedPublishedAt)) publicationTimestamp = parsedPublishedAt;
    if (Number.isFinite(collectedAt) && Number.isFinite(parsedPublishedAt) && collectedAt < parsedPublishedAt) {
      errors.push('collectedAt must be greater than or equal to publication publishedAt');
    }
  }

  if (Array.isArray(evidence.observations)) {
    const observationKeys = new Set<string>();
    evidence.observations.forEach((observation, index) => {
      errors.push(...validateObservation(observation, index, publicationTimestamp));
      const key = `${observation.metricId}\u0000${observation.unit}\u0000${observation.windowStart}\u0000${observation.windowEnd}\u0000${observation.observedAt}`;
      if (observationKeys.has(key)) errors.push(`observations[${index}] duplicates an earlier metric observation`);
      observationKeys.add(key);
      const observedAt = validTimestamp(observation.observedAt);
      if (Number.isFinite(collectedAt) && Number.isFinite(observedAt) && observedAt > collectedAt) {
        errors.push(`observations[${index}].observedAt must be less than or equal to collectedAt`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
