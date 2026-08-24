import { describe, expect, it } from 'vitest';

import {
  InMemoryMediaCatalog,
  hashMediaContent,
  ingestMediaContent,
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
