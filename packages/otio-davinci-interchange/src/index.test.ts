import { describe, expect, it } from 'vitest';
import { CANONICAL_TIMELINE_V2_SCHEMA_VERSION, type CanonicalTimelineV2 } from '../../contracts/src/canonical-timeline.contract.js';
import { OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION, type OtioDavinciInterchangeManifestV1 } from '../../contracts/src/otio-davinci-interchange.contract.js';
import { buildOtioDavinciExportFixtureV1, validateOtioDavinciRelinkRoundTripV1 } from './index.js';

const SHA = 'a'.repeat(64);
const TIMELINE_SHA = 'b'.repeat(64);
const timeline = (): CanonicalTimelineV2 => ({
  schemaVersion: CANONICAL_TIMELINE_V2_SCHEMA_VERSION, timelineId: 'timeline:resolve-fixture', revisionId: 'timeline:resolve-fixture:r1', projectId: 'project:resolve-fixture',
  frameRate: { numerator: 30000, denominator: 1001 }, durationFrames: 90,
  items: [{ itemId: 'clip:001', trackId: 'v1', kind: 'asset-video', startFrame: 0, endFrame: 90, assetId: `sha256:${SHA}`, source: { streamIndex: 0, sourceStartPts: 29010, sourceEndPts: 119100, sourceTimeBase: { numerator: 1, denominator: 30000 } }, playbackRate: { numerator: 1, denominator: 1 } }],
  deliveryProfileVersion: 'resolve-test:v1', manifestSha256: TIMELINE_SHA, createdBy: 'fixture', createdAt: '2026-08-28T00:00:00.000Z',
});
const manifest = (): OtioDavinciInterchangeManifestV1 => ({
  schemaVersion: OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION, manifestId: 'interchange:resolve:r1', revisionId: 'interchange:resolve:r1',
  target: { nle: 'davinci-resolve', interchangeFormat: 'otio', profileId: 'davinci-resolve-otio-project-relative', profileVersion: '1.0.0' },
  timeline: { timelineId: 'timeline:resolve-fixture', revisionId: 'timeline:resolve-fixture:r1', manifestSha256: TIMELINE_SHA },
  mediaMappings: [{ itemId: 'clip:001', assetId: `sha256:${SHA}`, assetSha256: SHA, streamId: 'stream:clip-001:video:0', streamIndex: 0, sourceStartPts: 29010, sourceEndPts: 119100, sourceTimeBase: { numerator: 2, denominator: 60000 }, relinkPath: { kind: 'project-relative-posix', value: 'Media/Originals/clip-001.mov' } }],
  createdAt: '2026-08-28T00:01:00.000Z',
});

describe('deterministic OTIO/DaVinci export fixture', () => {
  it('exports deterministic OTIO adapter state and verifies exact relink/source lineage round trip', () => {
    const fixture = buildOtioDavinciExportFixtureV1(timeline(), manifest());
    expect(fixture.clips[0]).toMatchObject({ name: 'clip:001', media_reference: { target_url: 'Media/Originals/clip-001.mov', metadata: { assetId: `sha256:${SHA}`, streamIndex: 0, sourceTimeBase: { numerator: 1, denominator: 30000 } } }, metadata: { sourceStartPts: 29010, sourceEndPts: 119100 } });
    expect(fixture.clips[0]!.source_range.start_time).toEqual({ OTIO_SCHEMA: 'RationalTime.1', value: 29010, rate: 30000 });
    expect(fixture.clips[0]!.source_range.duration).toEqual({ OTIO_SCHEMA: 'RationalTime.1', value: 90090, rate: 30000 });
    expect(validateOtioDavinciRelinkRoundTripV1(fixture, timeline(), manifest())).toEqual({ valid: true, errors: [] });
  });

  it('fails closed when exported relink or immutable source evidence is changed', () => {
    const fixture = buildOtioDavinciExportFixtureV1(timeline(), manifest());
    const tampered = structuredClone(fixture);
    tampered.clips[0]!.media_reference.target_url = 'Media/Originals/renamed.mov';
    tampered.clips[0]!.metadata.sourceEndPts += 1;
    const result = validateOtioDavinciRelinkRoundTripV1(tampered, timeline(), manifest());
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('relink path mismatch for clip:001');
    expect(result.errors).toContain('native PTS round-trip mismatch for clip:001');
  });

  it('rejects invalid manifest evidence before exporting any fixture', () => {
    const bad = manifest();
    bad.mediaMappings[0]!.relinkPath.value = '../escape.mov';
    expect(() => buildOtioDavinciExportFixtureV1(timeline(), bad)).toThrow('Cannot export invalid interchange evidence');
  });
});
