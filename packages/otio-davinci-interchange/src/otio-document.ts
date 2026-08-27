import {
  normalizeCanonicalRational,
  type CanonicalRational,
  type CanonicalTimelineAssetItemV2,
  type CanonicalTimelineV2,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateOtioDavinciManifestAgainstCanonicalTimelineV2,
  type OtioDavinciInterchangeManifestV1,
  type OtioDavinciMediaMappingV1,
} from '../../contracts/src/otio-davinci-interchange.contract.js';

export interface OtioRationalTimeJsonV1 {
  OTIO_SCHEMA: 'RationalTime.1';
  value: number;
  rate: number;
}

export interface OtioTimeRangeJsonV1 {
  OTIO_SCHEMA: 'TimeRange.1';
  start_time: OtioRationalTimeJsonV1;
  duration: OtioRationalTimeJsonV1;
}

export interface OtioExternalReferenceJsonV1 {
  OTIO_SCHEMA: 'ExternalReference.1';
  name: string;
  metadata: { ai_editor: Record<string, unknown> };
  target_url: string;
  available_range: null;
  available_image_bounds: null;
}

export interface OtioClipJsonV2 {
  OTIO_SCHEMA: 'Clip.2';
  name: string;
  metadata: { ai_editor: Record<string, unknown> };
  source_range: OtioTimeRangeJsonV1;
  effects: readonly [];
  markers: readonly [];
  enabled: true;
  media_references: { DEFAULT_MEDIA: OtioExternalReferenceJsonV1 };
  active_media_reference_key: 'DEFAULT_MEDIA';
}

export interface OtioGapJsonV1 {
  OTIO_SCHEMA: 'Gap.1';
  name: string;
  metadata: { ai_editor: { durationFrames: number } };
  source_range: OtioTimeRangeJsonV1;
  effects: readonly [];
  markers: readonly [];
  enabled: true;
}

export type OtioTrackChildJsonV1 = OtioClipJsonV2 | OtioGapJsonV1;

export interface OtioTrackJsonV1 {
  OTIO_SCHEMA: 'Track.1';
  name: string;
  metadata: { ai_editor: { canonicalTrackId: string } };
  source_range: null;
  effects: readonly [];
  markers: readonly [];
  enabled: true;
  children: readonly OtioTrackChildJsonV1[];
  kind: 'Video' | 'Audio';
}

export interface OtioTimelineDocumentV1 {
  OTIO_SCHEMA: 'Timeline.1';
  name: string;
  metadata: {
    ai_editor: {
      canonicalTimelineId: string;
      canonicalRevisionId: string;
      canonicalManifestSha256: string;
      interchangeManifestRevisionId: string;
      targetProfileId: string;
      targetProfileVersion: string;
      projectFrameRate: CanonicalRational;
    };
  };
  global_start_time: null;
  tracks: {
    OTIO_SCHEMA: 'Stack.1';
    name: 'tracks';
    metadata: Record<string, never>;
    source_range: null;
    effects: readonly [];
    markers: readonly [];
    enabled: true;
    children: readonly OtioTrackJsonV1[];
  };
}

function mediaItems(timeline: CanonicalTimelineV2): CanonicalTimelineAssetItemV2[] {
  return timeline.items.filter(
    (item): item is CanonicalTimelineAssetItemV2 => item.kind === 'asset-video' || item.kind === 'source-audio',
  );
}

function isOneToOnePlayback(item: CanonicalTimelineAssetItemV2): boolean {
  const rate = normalizeCanonicalRational(item.playbackRate);
  return rate.numerator === 1 && rate.denominator === 1;
}

function sourceDurationMatchesProjectDuration(item: CanonicalTimelineAssetItemV2, timeline: CanonicalTimelineV2): boolean {
  const sourceTimeBase = normalizeCanonicalRational(item.source.sourceTimeBase);
  const frameRate = normalizeCanonicalRational(timeline.frameRate);
  const ptsDuration = BigInt(item.source.sourceEndPts - item.source.sourceStartPts);
  const frameDuration = BigInt(item.endFrame - item.startFrame);
  const left = ptsDuration * BigInt(sourceTimeBase.numerator) * BigInt(frameRate.numerator);
  const right = frameDuration * BigInt(frameRate.denominator) * BigInt(sourceTimeBase.denominator);
  return left === right;
}

function sourceRationalTime(pts: number, timeBase: CanonicalRational): OtioRationalTimeJsonV1 {
  const normalized = normalizeCanonicalRational(timeBase);
  return {
    OTIO_SCHEMA: 'RationalTime.1',
    value: pts * normalized.numerator,
    rate: normalized.denominator,
  };
}

function projectRationalTime(frames: number, frameRate: CanonicalRational): OtioRationalTimeJsonV1 {
  const normalized = normalizeCanonicalRational(frameRate);
  return {
    OTIO_SCHEMA: 'RationalTime.1',
    value: frames,
    rate: normalized.numerator / normalized.denominator,
  };
}

function sourceRange(item: CanonicalTimelineAssetItemV2): OtioTimeRangeJsonV1 {
  const start = sourceRationalTime(item.source.sourceStartPts, item.source.sourceTimeBase);
  const end = sourceRationalTime(item.source.sourceEndPts, item.source.sourceTimeBase);
  return {
    OTIO_SCHEMA: 'TimeRange.1',
    start_time: start,
    duration: { OTIO_SCHEMA: 'RationalTime.1', value: end.value - start.value, rate: start.rate },
  };
}

function gap(durationFrames: number, frameRate: CanonicalRational): OtioGapJsonV1 {
  return {
    OTIO_SCHEMA: 'Gap.1',
    name: `gap:${durationFrames}`,
    metadata: { ai_editor: { durationFrames } },
    source_range: {
      OTIO_SCHEMA: 'TimeRange.1',
      start_time: projectRationalTime(0, frameRate),
      duration: projectRationalTime(durationFrames, frameRate),
    },
    effects: [],
    markers: [],
    enabled: true,
  };
}

function clip(item: CanonicalTimelineAssetItemV2, mapping: OtioDavinciMediaMappingV1): OtioClipJsonV2 {
  const normalizedTimeBase = normalizeCanonicalRational(item.source.sourceTimeBase);
  const evidence = {
    canonicalItemId: item.itemId,
    canonicalTrackId: item.trackId,
    projectStartFrame: item.startFrame,
    projectEndFrame: item.endFrame,
    assetId: mapping.assetId,
    assetSha256: mapping.assetSha256.toLowerCase(),
    streamId: mapping.streamId,
    streamIndex: mapping.streamIndex,
    sourceStartPts: item.source.sourceStartPts,
    sourceEndPts: item.source.sourceEndPts,
    sourceTimeBase: normalizedTimeBase,
  };
  return {
    OTIO_SCHEMA: 'Clip.2',
    name: item.itemId,
    metadata: { ai_editor: evidence },
    source_range: sourceRange(item),
    effects: [],
    markers: [],
    enabled: true,
    media_references: {
      DEFAULT_MEDIA: {
        OTIO_SCHEMA: 'ExternalReference.1',
        name: item.itemId,
        metadata: { ai_editor: evidence },
        target_url: mapping.relinkPath.value,
        available_range: null,
        available_image_bounds: null,
      },
    },
    active_media_reference_key: 'DEFAULT_MEDIA',
  };
}

function buildTrack(
  trackId: string,
  items: readonly CanonicalTimelineAssetItemV2[],
  mappingByItemId: ReadonlyMap<string, OtioDavinciMediaMappingV1>,
  timeline: CanonicalTimelineV2,
): OtioTrackJsonV1 {
  const sorted = [...items].sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame || a.itemId.localeCompare(b.itemId));
  const kinds = new Set(sorted.map((item) => item.kind === 'asset-video' ? 'Video' : 'Audio'));
  if (kinds.size !== 1) throw new Error(`OTIO target profile v1 does not allow mixed video/audio items on track ${trackId}`);

  const children: OtioTrackChildJsonV1[] = [];
  let cursor = 0;
  for (const item of sorted) {
    if (!isOneToOnePlayback(item)) throw new Error(`OTIO target profile v1 does not support retimed item ${item.itemId}`);
    if (!sourceDurationMatchesProjectDuration(item, timeline)) {
      throw new Error(`OTIO target profile v1 requires exact source/project duration equivalence for ${item.itemId}`);
    }
    if (item.startFrame < cursor) throw new Error(`OTIO target profile v1 does not allow overlapping items on track ${trackId}`);
    if (item.startFrame > cursor) children.push(gap(item.startFrame - cursor, timeline.frameRate));
    const mapping = mappingByItemId.get(item.itemId);
    if (!mapping) throw new Error(`Missing relink mapping for ${item.itemId}`);
    children.push(clip(item, mapping));
    cursor = item.endFrame;
  }
  if (cursor < timeline.durationFrames) children.push(gap(timeline.durationFrames - cursor, timeline.frameRate));

  return {
    OTIO_SCHEMA: 'Track.1',
    name: trackId,
    metadata: { ai_editor: { canonicalTrackId: trackId } },
    source_range: null,
    effects: [],
    markers: [],
    enabled: true,
    children,
    kind: [...kinds][0]!,
  };
}

export function buildOtioDavinciTimelineDocumentV1(
  timeline: CanonicalTimelineV2,
  manifest: OtioDavinciInterchangeManifestV1,
): OtioTimelineDocumentV1 {
  const validation = validateOtioDavinciManifestAgainstCanonicalTimelineV2(manifest, timeline);
  if (!validation.valid) throw new Error(`Cannot serialize invalid interchange evidence: ${validation.errors.join('; ')}`);

  const mappings = new Map(manifest.mediaMappings.map((mapping) => [mapping.itemId, mapping]));
  const grouped = new Map<string, CanonicalTimelineAssetItemV2[]>();
  for (const item of mediaItems(timeline)) {
    const group = grouped.get(item.trackId) ?? [];
    group.push(item);
    grouped.set(item.trackId, group);
  }
  const tracks = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([trackId, items]) => buildTrack(trackId, items, mappings, timeline));

  return {
    OTIO_SCHEMA: 'Timeline.1',
    name: timeline.timelineId,
    metadata: {
      ai_editor: {
        canonicalTimelineId: timeline.timelineId,
        canonicalRevisionId: timeline.revisionId,
        canonicalManifestSha256: timeline.manifestSha256.toLowerCase(),
        interchangeManifestRevisionId: manifest.revisionId,
        targetProfileId: manifest.target.profileId,
        targetProfileVersion: manifest.target.profileVersion,
        projectFrameRate: normalizeCanonicalRational(timeline.frameRate),
      },
    },
    global_start_time: null,
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      name: 'tracks',
      metadata: {},
      source_range: null,
      effects: [],
      markers: [],
      enabled: true,
      children: tracks,
    },
  };
}

export function serializeOtioDavinciTimelineDocumentV1(
  timeline: CanonicalTimelineV2,
  manifest: OtioDavinciInterchangeManifestV1,
): string {
  return `${JSON.stringify(buildOtioDavinciTimelineDocumentV1(timeline, manifest), null, 2)}\n`;
}
