import {
  normalizeCanonicalRational,
  validateCanonicalTimelineV2,
  type CanonicalRational,
  type CanonicalTimelineAssetItemV2,
  type CanonicalTimelineV2,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateOtioDavinciManifestAgainstCanonicalTimelineV2,
  type OtioDavinciInterchangeManifestV1,
  type OtioDavinciMediaMappingV1,
} from '../../contracts/src/otio-davinci-interchange.contract.js';

export const OTIO_DAVINCI_EXPORT_FIXTURE_SCHEMA_VERSION = '1.0' as const;

export interface OtioExternalReferenceV1 {
  OTIO_SCHEMA: 'ExternalReference.1';
  target_url: string;
  metadata: {
    assetId: string;
    assetSha256: string;
    streamId: string;
    streamIndex: number;
    sourceTimeBase: CanonicalRational;
  };
}

export interface OtioClipV1 {
  OTIO_SCHEMA: 'Clip.2';
  name: string;
  media_reference: OtioExternalReferenceV1;
  source_range: {
    OTIO_SCHEMA: 'TimeRange.1';
    start_time: { OTIO_SCHEMA: 'RationalTime.1'; value: number; rate: number };
    duration: { OTIO_SCHEMA: 'RationalTime.1'; value: number; rate: number };
  };
  metadata: {
    canonicalItemId: string;
    sourceStartPts: number;
    sourceEndPts: number;
  };
}

export interface OtioDavinciExportFixtureV1 {
  schemaVersion: typeof OTIO_DAVINCI_EXPORT_FIXTURE_SCHEMA_VERSION;
  targetNle: 'davinci-resolve';
  interchangeFormat: 'otio';
  timelineId: string;
  timelineRevisionId: string;
  manifestRevisionId: string;
  clips: readonly OtioClipV1[];
}

export interface OtioDavinciRelinkValidationResult {
  valid: boolean;
  errors: string[];
}

function mediaItems(timeline: CanonicalTimelineV2): CanonicalTimelineAssetItemV2[] {
  return timeline.items.filter(
    (item): item is CanonicalTimelineAssetItemV2 => item.kind === 'asset-video' || item.kind === 'source-audio',
  );
}

function otioTimeFromPts(pts: number, timeBase: CanonicalRational): { value: number; rate: number } {
  const normalized = normalizeCanonicalRational(timeBase);
  // OTIO RationalTime is adapter state only. Native PTS + rational time base remain canonical.
  return { value: pts * normalized.numerator, rate: normalized.denominator };
}

function clipFromMapping(item: CanonicalTimelineAssetItemV2, mapping: OtioDavinciMediaMappingV1): OtioClipV1 {
  const start = otioTimeFromPts(mapping.sourceStartPts, mapping.sourceTimeBase);
  const end = otioTimeFromPts(mapping.sourceEndPts, mapping.sourceTimeBase);
  return {
    OTIO_SCHEMA: 'Clip.2',
    name: item.itemId,
    media_reference: {
      OTIO_SCHEMA: 'ExternalReference.1',
      target_url: mapping.relinkPath.value,
      metadata: {
        assetId: mapping.assetId,
        assetSha256: mapping.assetSha256.toLowerCase(),
        streamId: mapping.streamId,
        streamIndex: mapping.streamIndex,
        sourceTimeBase: normalizeCanonicalRational(mapping.sourceTimeBase),
      },
    },
    source_range: {
      OTIO_SCHEMA: 'TimeRange.1',
      start_time: { OTIO_SCHEMA: 'RationalTime.1', ...start },
      duration: { OTIO_SCHEMA: 'RationalTime.1', value: end.value - start.value, rate: start.rate },
    },
    metadata: {
      canonicalItemId: item.itemId,
      sourceStartPts: mapping.sourceStartPts,
      sourceEndPts: mapping.sourceEndPts,
    },
  };
}

export function buildOtioDavinciExportFixtureV1(
  timeline: CanonicalTimelineV2,
  manifest: OtioDavinciInterchangeManifestV1,
): OtioDavinciExportFixtureV1 {
  const validation = validateOtioDavinciManifestAgainstCanonicalTimelineV2(manifest, timeline);
  if (!validation.valid) throw new Error(`Cannot export invalid interchange evidence: ${validation.errors.join('; ')}`);

  const mappingByItemId = new Map(manifest.mediaMappings.map((mapping) => [mapping.itemId, mapping]));
  return Object.freeze({
    schemaVersion: OTIO_DAVINCI_EXPORT_FIXTURE_SCHEMA_VERSION,
    targetNle: 'davinci-resolve',
    interchangeFormat: 'otio',
    timelineId: timeline.timelineId,
    timelineRevisionId: timeline.revisionId,
    manifestRevisionId: manifest.revisionId,
    clips: Object.freeze(mediaItems(timeline).map((item) => clipFromMapping(item, mappingByItemId.get(item.itemId)!))),
  });
}

export function validateOtioDavinciRelinkRoundTripV1(
  fixture: OtioDavinciExportFixtureV1,
  timeline: CanonicalTimelineV2,
  manifest: OtioDavinciInterchangeManifestV1,
): OtioDavinciRelinkValidationResult {
  const errors: string[] = [];
  const canonical = validateCanonicalTimelineV2(timeline);
  if (!canonical.valid) errors.push(...canonical.errors.map((error) => `canonical timeline: ${error}`));
  const manifestValidation = validateOtioDavinciManifestAgainstCanonicalTimelineV2(manifest, timeline);
  if (!manifestValidation.valid) errors.push(...manifestValidation.errors.map((error) => `manifest: ${error}`));

  if (fixture.schemaVersion !== OTIO_DAVINCI_EXPORT_FIXTURE_SCHEMA_VERSION) errors.push('fixture schemaVersion must be 1.0');
  if (fixture.targetNle !== manifest.target.nle || fixture.interchangeFormat !== manifest.target.interchangeFormat) errors.push('fixture target must match manifest target');
  if (fixture.timelineId !== timeline.timelineId || fixture.timelineRevisionId !== timeline.revisionId) errors.push('fixture timeline identity must match canonical revision');
  if (fixture.manifestRevisionId !== manifest.revisionId) errors.push('fixture manifest revision must match interchange manifest');

  const items = mediaItems(timeline);
  const clipByItemId = new Map(fixture.clips.map((clip) => [clip.metadata.canonicalItemId, clip]));
  const mappingByItemId = new Map(manifest.mediaMappings.map((mapping) => [mapping.itemId, mapping]));
  if (fixture.clips.length !== items.length) errors.push('fixture must contain exactly one clip per canonical media item');

  for (const item of items) {
    const clip = clipByItemId.get(item.itemId);
    const mapping = mappingByItemId.get(item.itemId);
    if (!clip || !mapping) { errors.push(`missing fixture/relink evidence for ${item.itemId}`); continue; }
    if (clip.media_reference.target_url !== mapping.relinkPath.value) errors.push(`relink path mismatch for ${item.itemId}`);
    if (clip.media_reference.metadata.assetId !== item.assetId || clip.media_reference.metadata.assetId !== mapping.assetId) errors.push(`asset lineage mismatch for ${item.itemId}`);
    if (clip.media_reference.metadata.streamIndex !== item.source.streamIndex || clip.media_reference.metadata.streamIndex !== mapping.streamIndex) errors.push(`stream lineage mismatch for ${item.itemId}`);
    if (clip.metadata.sourceStartPts !== item.source.sourceStartPts || clip.metadata.sourceEndPts !== item.source.sourceEndPts) errors.push(`native PTS round-trip mismatch for ${item.itemId}`);
    const expected = normalizeCanonicalRational(item.source.sourceTimeBase);
    const actual = normalizeCanonicalRational(clip.media_reference.metadata.sourceTimeBase);
    if (expected.numerator !== actual.numerator || expected.denominator !== actual.denominator) errors.push(`source time-base round-trip mismatch for ${item.itemId}`);
  }

  for (const clip of fixture.clips) if (!items.some((item) => item.itemId === clip.metadata.canonicalItemId)) errors.push(`unexpected fixture clip ${clip.metadata.canonicalItemId}`);
  return { valid: errors.length === 0, errors };
}
