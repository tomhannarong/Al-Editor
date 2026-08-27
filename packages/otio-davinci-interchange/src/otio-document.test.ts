import { describe, expect, it } from 'vitest';
import { CANONICAL_TIMELINE_V2_SCHEMA_VERSION, type CanonicalTimelineV2 } from '../../contracts/src/canonical-timeline.contract.js';
import { OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION, type OtioDavinciInterchangeManifestV1 } from '../../contracts/src/otio-davinci-interchange.contract.js';
import { buildOtioDavinciTimelineDocumentV1, serializeOtioDavinciTimelineDocumentV1 } from './otio-document.js';

const SHA = 'a'.repeat(64);
const TIMELINE_SHA = 'b'.repeat(64);

function timeline(): CanonicalTimelineV2 {
  return {
    schemaVersion: CANONICAL_TIMELINE_V2_SCHEMA_VERSION,
    timelineId: 'timeline:resolve-import-fixture', revisionId: 'timeline:resolve-import-fixture:r1', projectId: 'project:resolve-import-fixture',
    frameRate: { numerator: 30000, denominator: 1001 }, durationFrames: 120,
    items: [
      { itemId: 'clip:001', trackId: 'v1', kind: 'asset-video', startFrame: 0, endFrame: 90, assetId: `sha256:${SHA}`, source: { streamIndex: 0, sourceStartPts: 29010, sourceEndPts: 119100, sourceTimeBase: { numerator: 1, denominator: 30000 } }, playbackRate: { numerator: 1, denominator: 1 } },
    ],
    deliveryProfileVersion: 'resolve-test:v1', manifestSha256: TIMELINE_SHA, createdBy: 'fixture', createdAt: '2026-08-28T00:00:00.000Z',
  };
}

function manifest(): OtioDavinciInterchangeManifestV1 {
  return {
    schemaVersion: OTIO_DAVINCI_INTERCHANGE_MANIFEST_SCHEMA_VERSION,
    manifestId: 'interchange:resolve-import:r1', revisionId: 'interchange:resolve-import:r1',
    target: { nle: 'davinci-resolve', interchangeFormat: 'otio', profileId: 'davinci-resolve-otio-project-relative', profileVersion: '1.0.0' },
    timeline: { timelineId: 'timeline:resolve-import-fixture', revisionId: 'timeline:resolve-import-fixture:r1', manifestSha256: TIMELINE_SHA },
    mediaMappings: [{ itemId: 'clip:001', assetId: `sha256:${SHA}`, assetSha256: SHA, streamId: 'stream:clip-001:video:0', streamIndex: 0, sourceStartPts: 29010, sourceEndPts: 119100, sourceTimeBase: { numerator: 1, denominator: 30000 }, relinkPath: { kind: 'project-relative-posix', value: 'Media/Originals/clip-001.mov' } }],
    createdAt: '2026-08-28T00:01:00.000Z',
  };
}

describe('OTIO DaVinci timeline document serializer', () => {
  it('serializes a Timeline/Stack/Track/Clip document with exact relink and native source evidence', () => {
    const doc = buildOtioDavinciTimelineDocumentV1(timeline(), manifest());
    expect(doc.OTIO_SCHEMA).toBe('Timeline.1');
    expect(doc.tracks.children).toHaveLength(1);
    const track = doc.tracks.children[0]!;
    expect(track.kind).toBe('Video');
    expect(track.children).toHaveLength(2);
    const clip = track.children[0]!;
    expect(clip.OTIO_SCHEMA).toBe('Clip.2');
    if (clip.OTIO_SCHEMA !== 'Clip.2') throw new Error('expected clip');
    expect(clip.media_references.DEFAULT_MEDIA.target_url).toBe('Media/Originals/clip-001.mov');
    expect(clip.source_range.start_time).toEqual({ OTIO_SCHEMA: 'RationalTime.1', value: 29010, rate: 30000 });
    expect(clip.source_range.duration).toEqual({ OTIO_SCHEMA: 'RationalTime.1', value: 90090, rate: 30000 });
    expect(clip.metadata.ai_editor).toMatchObject({ projectStartFrame: 0, projectEndFrame: 90, sourceStartPts: 29010, sourceEndPts: 119100 });
    expect(track.children[1]).toMatchObject({ OTIO_SCHEMA: 'Gap.1', metadata: { ai_editor: { durationFrames: 30 } } });
    expect(JSON.parse(serializeOtioDavinciTimelineDocumentV1(timeline(), manifest()))).toEqual(doc);
  });

  it('fails closed instead of silently approximating retimes', () => {
    const candidate = timeline();
    const item = candidate.items[0]!;
    if (item.kind !== 'asset-video') throw new Error('fixture drift');
    item.playbackRate = { numerator: 2, denominator: 1 };
    expect(() => buildOtioDavinciTimelineDocumentV1(candidate, manifest())).toThrow('does not support retimed item clip:001');
  });

  it('fails closed when native source duration does not exactly equal project-frame duration', () => {
    const candidate = timeline();
    const item = candidate.items[0]!;
    if (item.kind !== 'asset-video') throw new Error('fixture drift');
    item.endFrame = 89;
    expect(() => buildOtioDavinciTimelineDocumentV1(candidate, manifest())).toThrow('requires exact source/project duration equivalence');
  });

  it('fails closed on overlapping canonical items in the same target track', () => {
    const candidate = timeline();
    const first = candidate.items[0]!;
    if (first.kind !== 'asset-video') throw new Error('fixture drift');
    candidate.items = [first, { ...first, itemId: 'clip:002', startFrame: 30, endFrame: 120 }];
    const m = manifest();
    m.mediaMappings = [...m.mediaMappings, { ...m.mediaMappings[0]!, itemId: 'clip:002', relinkPath: { kind: 'project-relative-posix', value: 'Media/Originals/clip-002.mov' } }];
    expect(() => buildOtioDavinciTimelineDocumentV1(candidate, m)).toThrow('does not allow overlapping items on track v1');
  });
});
