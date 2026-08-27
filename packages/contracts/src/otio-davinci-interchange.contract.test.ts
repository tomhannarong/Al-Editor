import { describe, expect, it } from 'vitest';

import {
  CANONICAL_TIMELINE_V2_SCHEMA_VERSION,
  type CanonicalTimelineV2,
} from './canonical-timeline.contract.js';
import {
  OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION,
  OTIO_DAVINCI_TARGET_NLE,
  OTIO_INTERCHANGE_FORMAT,
  validateOtioDavinciInterchangeManifestV1,
  validateOtioDavinciManifestAgainstCanonicalTimelineV2,
  type OtioDavinciInterchangeManifestV1,
} from './otio-davinci-interchange.contract.js';

const ASSET_SHA = 'a'.repeat(64);
const TIMELINE_SHA = 'b'.repeat(64);

function canonicalTimeline(): CanonicalTimelineV2 {
  return {
    schemaVersion: CANONICAL_TIMELINE_V2_SCHEMA_VERSION,
    timelineId: 'timeline:travel-cut',
    revisionId: 'timeline:travel-cut:r7',
    projectId: 'project:nan-trip',
    frameRate: { numerator: 30000, denominator: 1001 },
    durationFrames: 180,
    items: [
      {
        itemId: 'clip:001',
        trackId: 'v1',
        kind: 'asset-video',
        startFrame: 0,
        endFrame: 90,
        assetId: `sha256:${ASSET_SHA}`,
        source: {
          streamIndex: 0,
          sourceStartPts: 29010,
          sourceEndPts: 119100,
          sourceTimeBase: { numerator: 1, denominator: 30000 },
        },
        playbackRate: { numerator: 1, denominator: 1 },
      },
    ],
    deliveryProfileVersion: 'tiktok-1080x1920:v1',
    manifestSha256: TIMELINE_SHA,
    createdBy: 'editorial-brain:travel-soft:v1',
    createdAt: '2026-08-27T15:00:00.000Z',
  };
}

function manifest(): OtioDavinciInterchangeManifestV1 {
  return {
    schemaVersion: OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION,
    manifestId: 'interchange:timeline:travel-cut:r7',
    revisionId: 'interchange:timeline:travel-cut:r7:resolve-profile-v1',
    target: {
      nle: OTIO_DAVINCI_TARGET_NLE,
      interchangeFormat: OTIO_INTERCHANGE_FORMAT,
      profileId: 'davinci-resolve-otio-project-relative',
      profileVersion: '1.0.0',
    },
    timeline: {
      timelineId: 'timeline:travel-cut',
      revisionId: 'timeline:travel-cut:r7',
      manifestSha256: TIMELINE_SHA,
    },
    mediaMappings: [
      {
        itemId: 'clip:001',
        assetId: `sha256:${ASSET_SHA}`,
        assetSha256: ASSET_SHA,
        streamId: 'stream:clip-001:video:0',
        streamIndex: 0,
        sourceStartPts: 29010,
        sourceEndPts: 119100,
        sourceTimeBase: { numerator: 2, denominator: 60000 },
        relinkPath: {
          kind: 'project-relative-posix',
          value: 'Media/Originals/clip-001.mov',
        },
      },
    ],
    createdAt: '2026-08-27T15:01:00.000Z',
  };
}

describe('OTIO / DaVinci interchange manifest contract', () => {
  it('accepts a pinned target profile and exact canonical source/relink evidence', () => {
    expect(validateOtioDavinciInterchangeManifestV1(manifest())).toEqual({ valid: true, errors: [] });
    expect(validateOtioDavinciManifestAgainstCanonicalTimelineV2(manifest(), canonicalTimeline())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects mutable target/timeline revisions and unsafe relink paths', () => {
    const candidate = manifest();
    candidate.target.profileVersion = 'latest';
    candidate.timeline.revisionId = 'main';
    candidate.mediaMappings[0]!.relinkPath.value = '../outside.mov';

    const result = validateOtioDavinciInterchangeManifestV1(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('target.profileVersion must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('timeline.revisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('invalid confined relinkPath for clip:001');
  });

  it('fails closed when interchange source timing or asset lineage diverges from canonical v2', () => {
    const candidate = manifest();
    candidate.mediaMappings[0]!.assetId = `sha256:${'c'.repeat(64)}`;
    candidate.mediaMappings[0]!.sourceEndPts = 119101;

    const result = validateOtioDavinciManifestAgainstCanonicalTimelineV2(candidate, canonicalTimeline());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('assetId mismatch for clip:001');
    expect(result.errors).toContain('native PTS mismatch for clip:001');
  });

  it('requires one mapping for every canonical media item and rejects extra mappings', () => {
    const missing = manifest();
    missing.mediaMappings = [];
    expect(validateOtioDavinciManifestAgainstCanonicalTimelineV2(missing, canonicalTimeline()).errors).toContain(
      'missing media mapping for canonical item clip:001',
    );

    const extra = manifest();
    extra.mediaMappings = [
      ...extra.mediaMappings,
      {
        ...extra.mediaMappings[0]!,
        itemId: 'clip:not-in-timeline',
        relinkPath: { kind: 'project-relative-posix', value: 'Media/Originals/other.mov' },
      },
    ];
    expect(validateOtioDavinciManifestAgainstCanonicalTimelineV2(extra, canonicalTimeline()).errors).toContain(
      'media mapping clip:not-in-timeline does not exist in canonical timeline revision',
    );
  });

  it('keeps project-frame timing and NLE-generated state outside the interchange manifest', () => {
    const candidate = manifest();
    const mapping = candidate.mediaMappings[0]!;

    expect('startFrame' in mapping).toBe(false);
    expect('endFrame' in mapping).toBe(false);
    expect('sourceSeconds' in mapping).toBe(false);
    expect('nleTimelineId' in candidate).toBe(false);
    expect('resolveProjectState' in candidate).toBe(false);
  });
});
