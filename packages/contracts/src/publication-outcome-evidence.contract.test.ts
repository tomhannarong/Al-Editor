import { describe, expect, it } from 'vitest';
import {
  RENDER_PUBLICATION_LINEAGE_AUTHORITY,
  RENDER_PUBLICATION_LINEAGE_SCHEMA_VERSION,
  type RenderPublicationLineageRevisionV1,
} from './render-publication-lineage.contract.js';
import {
  PUBLICATION_OUTCOME_EVIDENCE_AUTHORITY,
  PUBLICATION_OUTCOME_EVIDENCE_SCHEMA_VERSION,
  PUBLICATION_OUTCOME_EVIDENCE_SEMANTICS,
  validatePublicationOutcomeEvidenceRevisionV1,
  type PublicationOutcomeEvidenceRevisionV1,
} from './publication-outcome-evidence.contract.js';

function publication(): RenderPublicationLineageRevisionV1 {
  return {
    schemaVersion: RENDER_PUBLICATION_LINEAGE_SCHEMA_VERSION,
    authority: RENDER_PUBLICATION_LINEAGE_AUTHORITY,
    publicationRecordId: 'publication:phase14:001',
    revisionId: 'publication:phase14:001:r1',
    projectId: 'project:phase14',
    timelineId: 'timeline:phase14',
    timelineRevisionId: 'timeline:phase14:r7',
    timelineManifestSha256: 'a'.repeat(64),
    deliveryProfileVersion: 'delivery:tiktok-vertical:r3',
    renderedArtifactSha256: 'b'.repeat(64),
    provider: { providerId: 'provider:short-video', externalPublicationId: 'post:987654321' },
    publishedAt: '2026-08-28T04:05:00.000Z',
    createdBy: 'distribution-recorder',
    createdAt: '2026-08-28T04:05:01.000Z',
  };
}

function evidence(): PublicationOutcomeEvidenceRevisionV1 {
  return {
    schemaVersion: PUBLICATION_OUTCOME_EVIDENCE_SCHEMA_VERSION,
    authority: PUBLICATION_OUTCOME_EVIDENCE_AUTHORITY,
    semantics: PUBLICATION_OUTCOME_EVIDENCE_SEMANTICS,
    outcomeEvidenceId: 'outcome:publication:phase14:001',
    revisionId: 'outcome:publication:phase14:001:r1',
    publicationRecordId: 'publication:phase14:001',
    publicationRevisionId: 'publication:phase14:001:r1',
    providerId: 'provider:short-video',
    externalPublicationId: 'post:987654321',
    observations: [
      {
        metricId: 'views',
        unit: 'count',
        value: 12500,
        windowStart: '2026-08-28T04:05:00.000Z',
        windowEnd: '2026-08-28T05:05:00.000Z',
        observedAt: '2026-08-28T05:06:00.000Z',
        providerEvidenceRef: 'provider-snapshot:987654321:20260828T050600Z',
      },
      {
        metricId: 'completion_ratio',
        unit: 'ratio',
        value: 0.42,
        windowStart: '2026-08-28T04:05:00.000Z',
        windowEnd: '2026-08-28T05:05:00.000Z',
        observedAt: '2026-08-28T05:06:00.000Z',
      },
    ],
    collectedAt: '2026-08-28T05:06:01.000Z',
    createdBy: 'outcome-recorder',
    createdAt: '2026-08-28T05:06:02.000Z',
  };
}

describe('publication outcome evidence v1', () => {
  it('accepts bounded provider metric observations with explicit non-causal authority', () => {
    expect(validatePublicationOutcomeEvidenceRevisionV1(evidence(), publication())).toEqual({ valid: true, errors: [] });
  });

  it('binds every outcome revision to one exact immutable publication revision and provider identity', () => {
    const value = evidence();
    value.publicationRecordId = 'publication:other';
    value.publicationRevisionId = 'publication:phase14:001:r2';
    value.providerId = 'provider:other';
    value.externalPublicationId = 'post:other';

    const result = validatePublicationOutcomeEvidenceRevisionV1(value, publication());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('publicationRecordId must match the immutable publication record');
    expect(result.errors).toContain('publicationRevisionId must match the immutable publication revision');
    expect(result.errors).toContain('providerId must match the publication providerId');
    expect(result.errors).toContain('externalPublicationId must match the publication externalPublicationId');
  });

  it('rejects causal or editorial authority escalation and mutable revision aliases', () => {
    const value = evidence();
    (value as { authority: string }).authority = 'editorial-optimization-authority';
    (value as { semantics: string }).semantics = 'caused-by-edit';
    value.revisionId = 'latest';
    value.publicationRevisionId = 'current';

    const result = validatePublicationOutcomeEvidenceRevisionV1(value, publication());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('authority must be observation-only');
    expect(result.errors).toContain('semantics must be correlation-not-causation');
    expect(result.errors).toContain('revisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('publicationRevisionId must be pinned and must not use a mutable alias');
  });

  it('rejects invalid metric value domains, impossible windows, duplicate observations and future collection ordering', () => {
    const value = evidence();
    value.observations[0]!.value = -1;
    value.observations[0]!.windowStart = '2026-08-28T05:07:00.000Z';
    value.observations[0]!.windowEnd = '2026-08-28T05:05:00.000Z';
    value.observations.push({ ...value.observations[1]! });
    value.collectedAt = '2026-08-28T05:05:30.000Z';

    const result = validatePublicationOutcomeEvidenceRevisionV1(value, publication());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('observations[0].value is invalid for unit count');
    expect(result.errors).toContain('observations[0].windowEnd must be greater than or equal to windowStart');
    expect(result.errors).toContain('observations[1].observedAt must be less than or equal to collectedAt');
    expect(result.errors).toContain('observations[2] duplicates an earlier metric observation');
  });

  it('rejects metric windows before publication and invalid bounded metric forms', () => {
    const value = evidence();
    value.observations[0]!.windowStart = '2026-08-28T04:04:59.999Z';
    value.observations[1]!.metricId = 'bad metric id with spaces';
    value.observations[1]!.value = 1.5;
    value.observations[1]!.providerEvidenceRef = 'x'.repeat(513);

    const result = validatePublicationOutcomeEvidenceRevisionV1(value, publication());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('observations[0].windowStart must be greater than or equal to publication publishedAt');
    expect(result.errors).toContain('observations[1].metricId must be 1-128 provider-neutral identifier characters');
    expect(result.errors).toContain('observations[1].value is invalid for unit ratio');
    expect(result.errors).toContain('observations[1].providerEvidenceRef must be non-empty and at most 512 characters when present');
  });
});
