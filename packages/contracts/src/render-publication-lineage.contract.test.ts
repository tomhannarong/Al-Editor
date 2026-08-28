import { describe, expect, it } from 'vitest';
import {
  CANONICAL_TIMELINE_V2_SCHEMA_VERSION,
  type CanonicalTimelineV2,
} from './canonical-timeline.contract.js';
import {
  RENDER_PUBLICATION_LINEAGE_AUTHORITY,
  RENDER_PUBLICATION_LINEAGE_SCHEMA_VERSION,
  validateRenderPublicationLineageAgainstTimelineV2,
  validateRenderPublicationLineageRevisionV1,
  type RenderPublicationLineageRevisionV1,
} from './render-publication-lineage.contract.js';

const TIMELINE_MANIFEST_SHA = 'a'.repeat(64);
const RENDER_SHA = 'b'.repeat(64);

function timeline(): CanonicalTimelineV2 {
  return {
    schemaVersion: CANONICAL_TIMELINE_V2_SCHEMA_VERSION,
    timelineId: 'timeline:phase14',
    revisionId: 'timeline:phase14:r7',
    projectId: 'project:phase14',
    frameRate: { numerator: 30000, denominator: 1001 },
    durationFrames: 300,
    items: [],
    deliveryProfileVersion: 'delivery:tiktok-vertical:r3',
    manifestSha256: TIMELINE_MANIFEST_SHA,
    createdBy: 'editorial-service',
    createdAt: '2026-08-28T04:00:00.000Z',
  };
}

function record(): RenderPublicationLineageRevisionV1 {
  return {
    schemaVersion: RENDER_PUBLICATION_LINEAGE_SCHEMA_VERSION,
    authority: RENDER_PUBLICATION_LINEAGE_AUTHORITY,
    publicationRecordId: 'publication:phase14:001',
    revisionId: 'publication:phase14:001:r1',
    projectId: 'project:phase14',
    timelineId: 'timeline:phase14',
    timelineRevisionId: 'timeline:phase14:r7',
    timelineManifestSha256: TIMELINE_MANIFEST_SHA,
    deliveryProfileVersion: 'delivery:tiktok-vertical:r3',
    renderedArtifactSha256: RENDER_SHA,
    provider: {
      providerId: 'provider:short-video',
      externalPublicationId: 'post:987654321',
    },
    publishedAt: '2026-08-28T04:05:00.000Z',
    createdBy: 'distribution-recorder',
    createdAt: '2026-08-28T04:05:01.000Z',
  };
}

describe('render-to-publication lineage v1', () => {
  it('accepts an immutable provider-neutral publication lineage record', () => {
    expect(validateRenderPublicationLineageRevisionV1(record())).toEqual({ valid: true, errors: [] });
  });

  it('binds exactly to canonical timeline project/revision/manifest/delivery identity', () => {
    expect(validateRenderPublicationLineageAgainstTimelineV2(record(), timeline())).toEqual({ valid: true, errors: [] });
  });

  it('rejects authority escalation, mutable revisions and invalid checksums', () => {
    const value = record();
    (value as { authority: string }).authority = 'posting-authority';
    value.revisionId = 'latest';
    value.timelineRevisionId = 'current';
    value.deliveryProfileVersion = 'main';
    value.timelineManifestSha256 = 'not-a-digest';
    value.renderedArtifactSha256 = 'also-not-a-digest';

    const result = validateRenderPublicationLineageRevisionV1(value);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('authority must be lineage-only');
    expect(result.errors).toContain('revisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('timelineRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('deliveryProfileVersion must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('timelineManifestSha256 must be a SHA-256 hex digest');
    expect(result.errors).toContain('renderedArtifactSha256 must be a SHA-256 hex digest');
  });

  it('rejects missing provider identity and impossible publication record timestamps', () => {
    const value = record();
    value.provider.providerId = '';
    value.provider.externalPublicationId = '';
    value.publishedAt = '2026-08-28T04:05:02.000Z';
    value.createdAt = '2026-08-28T04:05:01.000Z';

    const result = validateRenderPublicationLineageRevisionV1(value);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('provider.providerId is required');
    expect(result.errors).toContain('provider.externalPublicationId is required');
    expect(result.errors).toContain('createdAt must be greater than or equal to publishedAt');
  });

  it('fails closed when publication lineage drifts from the canonical timeline', () => {
    const value = record();
    value.projectId = 'project:other';
    value.timelineId = 'timeline:other';
    value.timelineRevisionId = 'timeline:phase14:r8';
    value.timelineManifestSha256 = 'c'.repeat(64);
    value.deliveryProfileVersion = 'delivery:other:r1';

    const result = validateRenderPublicationLineageAgainstTimelineV2(value, timeline());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('projectId must match the canonical timeline projectId');
    expect(result.errors).toContain('timelineId must match the canonical timeline timelineId');
    expect(result.errors).toContain('timelineRevisionId must match the canonical timeline revisionId');
    expect(result.errors).toContain('timelineManifestSha256 must match the canonical timeline manifestSha256');
    expect(result.errors).toContain('deliveryProfileVersion must match the canonical timeline deliveryProfileVersion');
  });
});
