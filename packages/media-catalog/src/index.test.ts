import { describe, expect, it } from 'vitest';

import {
  InMemoryMediaCatalog,
  MediaCatalogInvariantError,
  hashMediaContent,
  ingestFfprobeStreamMetadata,
  ingestMediaContent,
  parseNormalizedFfprobeStreams,
} from './index.js';

const encoder = new TextEncoder();

function chunks(...values: string[]): Uint8Array[] {
  return values.map((value) => encoder.encode(value));
}

describe('content-addressed media ingest', () => {
  it('streams SHA-256 independent of chunk boundaries', async () => {
    const oneChunk = await hashMediaContent(chunks('abc'));
    const splitChunks = await hashMediaContent(chunks('a', 'b', 'c'));

    expect(oneChunk).toEqual({
      sha256Hex: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      byteSize: 3,
    });
    expect(splitChunks).toEqual(oneChunk);
  });

  it('accepts async chunk streams without buffering identity semantics', async () => {
    async function* source(): AsyncGenerator<Uint8Array> {
      yield encoder.encode('local-');
      yield encoder.encode('footage');
    }

    const streamed = await hashMediaContent(source());
    const contiguous = await hashMediaContent(chunks('local-footage'));
    expect(streamed).toEqual(contiguous);
  });

  it('idempotently registers identical bytes and preserves first-ingest evidence', async () => {
    const catalog = new InMemoryMediaCatalog();
    const first = await ingestMediaContent({
      chunks: chunks('same footage'),
      firstIngestedAt: '2026-08-25T00:00:00.000Z',
      location: {
        locationId: 'camera-card-slot',
        uri: 'file:///media/DCIM/clip-001.mp4',
        observedAt: '2026-08-25T00:00:00.000Z',
      },
    }, catalog);

    const second = await ingestMediaContent({
      chunks: chunks('same ', 'footage'),
      firstIngestedAt: '2026-08-25T01:00:00.000Z',
      location: {
        locationId: 'archive-slot',
        uri: 'file:///archive/renamed.mp4',
        observedAt: '2026-08-25T01:00:00.000Z',
      },
    }, catalog);

    expect(first.assetCreated).toBe(true);
    expect(second.assetCreated).toBe(false);
    expect(second.asset.assetId).toBe(first.asset.assetId);
    expect(second.asset.firstIngestedAt).toBe('2026-08-25T00:00:00.000Z');
    expect(second.location.uri).toBe('file:///archive/renamed.mp4');
  });

  it('rebinds mutable location when bytes at a known slot change', async () => {
    const catalog = new InMemoryMediaCatalog();
    const first = await ingestMediaContent({
      chunks: chunks('version-a'),
      firstIngestedAt: '2026-08-25T00:00:00.000Z',
      location: {
        locationId: 'watched-path',
        uri: 'file:///ingest/current.mp4',
        observedAt: '2026-08-25T00:00:00.000Z',
      },
    }, catalog);
    const replacement = await ingestMediaContent({
      chunks: chunks('version-b'),
      firstIngestedAt: '2026-08-25T02:00:00.000Z',
      location: {
        locationId: 'watched-path',
        uri: 'file:///ingest/current.mp4',
        observedAt: '2026-08-25T02:00:00.000Z',
      },
    }, catalog);

    expect(replacement.asset.assetId).not.toBe(first.asset.assetId);
    expect(catalog.getLocation('watched-path')?.assetId).toBe(replacement.asset.assetId);
    expect(catalog.getAsset(first.asset.assetId)?.assetId).toBe(first.asset.assetId);
  });

  it('returns defensive copies so callers cannot mutate persisted identity', async () => {
    const catalog = new InMemoryMediaCatalog();
    const result = await ingestMediaContent({
      chunks: chunks('immutable'),
      firstIngestedAt: '2026-08-25T00:00:00.000Z',
      location: {
        locationId: 'loc-1',
        uri: 'file:///immutable.mp4',
        observedAt: '2026-08-25T00:00:00.000Z',
      },
    }, catalog);

    result.asset.contentDigest.hex = '0'.repeat(64);
    expect(catalog.getAsset(result.asset.assetId)?.contentDigest.hex).not.toBe('0'.repeat(64));
  });
});

describe('normalized ffprobe stream metadata', () => {
  it('preserves native PTS and rational time bases while ignoring contradictory seconds', () => {
    const assetId = `sha256:${'a'.repeat(64)}`;
    const streams = parseNormalizedFfprobeStreams(assetId, {
      streams: [
        {
          index: 1,
          codec_type: 'audio',
          codec_name: 'aac',
          time_base: '1/48000',
          start_pts: '96000',
          duration_ts: '240000',
          sample_rate: '48000',
          channels: 2,
          start_time: '999.999',
          duration: '0.001',
        },
        {
          index: 0,
          codec_type: 'video',
          codec_name: 'h264',
          time_base: '1/90000',
          start_pts: 180000,
          duration_ts: '450000',
          width: 1920,
          height: 1080,
          start_time: '0.000000',
          duration: '9999.0',
        },
      ],
    });

    expect(streams).toEqual([
      {
        streamId: `${assetId}:stream:0`,
        assetId,
        streamIndex: 0,
        kind: 'video',
        codecName: 'h264',
        timeBase: { numerator: 1, denominator: 90000 },
        startPts: 180000,
        durationPts: 450000,
        width: 1920,
        height: 1080,
      },
      {
        streamId: `${assetId}:stream:1`,
        assetId,
        streamIndex: 1,
        kind: 'audio',
        codecName: 'aac',
        timeBase: { numerator: 1, denominator: 48000 },
        startPts: 96000,
        durationPts: 240000,
        sampleRate: 48000,
        channels: 2,
      },
    ]);
  });

  it('allows ffprobe N/A native timing only as explicit null', () => {
    const assetId = `sha256:${'b'.repeat(64)}`;
    expect(parseNormalizedFfprobeStreams(assetId, {
      streams: [{ index: 0, codec_type: 'subtitle', time_base: '1/1000', start_pts: 'N/A', duration_ts: 'N/A' }],
    })[0]).toMatchObject({ startPts: null, durationPts: null, timeBase: { numerator: 1, denominator: 1000 } });
  });

  it.each([
    { label: 'decimal PTS', stream: { index: 0, codec_type: 'video', time_base: '1/90000', start_pts: '1.5' } },
    { label: 'unsafe PTS', stream: { index: 0, codec_type: 'video', time_base: '1/90000', start_pts: '9007199254740992' } },
    { label: 'malformed time base', stream: { index: 0, codec_type: 'video', time_base: '0.001', start_pts: '1' } },
    { label: 'zero time-base numerator', stream: { index: 0, codec_type: 'video', time_base: '0/90000', start_pts: '1' } },
  ])('fails closed for $label', ({ stream }) => {
    expect(() => parseNormalizedFfprobeStreams(`sha256:${'c'.repeat(64)}`, { streams: [stream] })).toThrow(MediaCatalogInvariantError);
  });

  it('rejects duplicate stream indexes instead of silently overwriting timing identity', () => {
    const assetId = `sha256:${'d'.repeat(64)}`;
    expect(() => parseNormalizedFfprobeStreams(assetId, {
      streams: [
        { index: 0, codec_type: 'video', time_base: '1/90000', start_pts: 0 },
        { index: 0, codec_type: 'audio', time_base: '1/48000', start_pts: 0 },
      ],
    })).toThrow('duplicate ffprobe stream index 0');
  });

  it('persists a deterministic replacement projection only for a registered immutable asset', async () => {
    const catalog = new InMemoryMediaCatalog();
    const ingested = await ingestMediaContent({
      chunks: chunks('stream-metadata-owner'),
      firstIngestedAt: '2026-08-25T00:00:00.000Z',
      location: {
        locationId: 'stream-owner',
        uri: 'file:///media/stream-owner.mov',
        observedAt: '2026-08-25T00:00:00.000Z',
      },
    }, catalog);

    ingestFfprobeStreamMetadata(ingested.asset.assetId, {
      streams: [
        { index: 0, codec_type: 'video', codec_name: 'prores', time_base: '1/24000', start_pts: '2400', duration_ts: '48000', width: 1920, height: 1080 },
        { index: 1, codec_type: 'audio', codec_name: 'pcm_s24le', time_base: '1/48000', start_pts: '4800', duration_ts: '96000', sample_rate: '48000', channels: 2 },
      ],
    }, catalog);

    const firstRead = catalog.getStreamMetadata(ingested.asset.assetId);
    firstRead[0]!.timeBase.denominator = 1;
    expect(catalog.getStreamMetadata(ingested.asset.assetId)[0]!.timeBase.denominator).toBe(24000);

    ingestFfprobeStreamMetadata(ingested.asset.assetId, {
      streams: [{ index: 0, codec_type: 'video', time_base: '1/90000', start_pts: '9000', duration_ts: '90000' }],
    }, catalog);
    expect(catalog.getStreamMetadata(ingested.asset.assetId)).toHaveLength(1);

    expect(() => ingestFfprobeStreamMetadata(`sha256:${'e'.repeat(64)}`, {
      streams: [{ index: 0, codec_type: 'video', time_base: '1/90000', start_pts: 0 }],
    }, catalog)).toThrow('cannot persist streams for unknown asset');
  });
});
