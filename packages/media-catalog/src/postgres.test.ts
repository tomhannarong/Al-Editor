import { describe, expect, it } from 'vitest';

import type { StableMediaAssetIdentity } from '../../contracts/src/media-catalog.contract.js';
import { MediaCatalogInvariantError } from './index.js';
import { PostgresMediaCatalog, type PostgresQueryClient, type PostgresQueryResult } from './postgres.js';

class ScriptedClient implements PostgresQueryClient {
  readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];
  constructor(private readonly responses: PostgresQueryResult[]) {}
  async query<Row = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<PostgresQueryResult<Row>> {
    this.calls.push({ text, values });
    const response = this.responses.shift();
    if (!response) throw new Error(`unexpected query: ${text}`);
    return response as PostgresQueryResult<Row>;
  }
}

const digest = 'a'.repeat(64);
const asset: StableMediaAssetIdentity = {
  schemaVersion: '1.0',
  assetId: `sha256:${digest}`,
  contentDigest: { algorithm: 'sha256', hex: digest },
  byteSize: 1234,
  firstIngestedAt: '2026-08-25T00:00:00.000Z',
};

const assetRow = {
  asset_id: asset.assetId,
  schema_version: asset.schemaVersion,
  digest_algorithm: asset.contentDigest.algorithm,
  digest_hex: digest,
  byte_size: '1234',
  first_ingested_at: asset.firstIngestedAt,
};

describe('PostgresMediaCatalog', () => {
  it('idempotently registers immutable bytes and preserves first-ingest evidence', async () => {
    const inserted = new ScriptedClient([{ rows: [assetRow], rowCount: 1 }]);
    await expect(new PostgresMediaCatalog(inserted).registerAsset(asset)).resolves.toEqual({ asset, created: true });
    expect(inserted.calls[0]?.text).toContain('ON CONFLICT (asset_id) DO NOTHING');

    const existing = new ScriptedClient([
      { rows: [], rowCount: 0 },
      { rows: [assetRow], rowCount: 1 },
    ]);
    const later = { ...asset, contentDigest: { ...asset.contentDigest }, firstIngestedAt: '2026-08-25T05:00:00.000Z' };
    await expect(new PostgresMediaCatalog(existing).registerAsset(later)).resolves.toEqual({ asset, created: false });
  });

  it('upserts mutable storage location without including URI in immutable identity', async () => {
    const row = {
      location_id: 'slot-1', asset_id: asset.assetId, uri: 'file:///archive/moved.mov', state: 'available' as const,
      observed_at: '2026-08-25T01:00:00.000Z',
    };
    const client = new ScriptedClient([{ rows: [row], rowCount: 1 }]);
    const result = await new PostgresMediaCatalog(client).rebindLocation({
      locationId: row.location_id, assetId: row.asset_id, uri: row.uri, state: row.state, observedAt: row.observed_at,
    });
    expect(result.assetId).toBe(asset.assetId);
    expect(client.calls[0]?.text).toContain('ON CONFLICT (location_id) DO UPDATE');
  });

  it('replaces stream projection inside one transaction using native PTS/time-base integers only', async () => {
    const client = new ScriptedClient([
      { rows: [], rowCount: null },
      { rows: [{ asset_id: asset.assetId }], rowCount: 1 },
      { rows: [], rowCount: 2 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: null },
    ]);
    const streams = [{
      streamId: `${asset.assetId}:stream:0`, assetId: asset.assetId, streamIndex: 0, kind: 'video' as const,
      timeBase: { numerator: 1, denominator: 90000 }, startPts: 180000, durationPts: 450000, width: 1920, height: 1080,
    }];
    await expect(new PostgresMediaCatalog(client).replaceStreamMetadata(asset.assetId, streams)).resolves.toEqual(streams);
    expect(client.calls.map((call) => call.text.trim().split(/\s+/)[0])).toEqual(['BEGIN', 'SELECT', 'DELETE', 'INSERT', 'COMMIT']);
    const insertValues = client.calls[3]?.values ?? [];
    expect(insertValues).toContain(180000);
    expect(insertValues).toContain(90000);
    expect(client.calls[3]?.text).not.toMatch(/seconds|milliseconds/i);
  });

  it('rolls back and fails closed when the immutable asset does not exist', async () => {
    const client = new ScriptedClient([
      { rows: [], rowCount: null },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: null },
    ]);
    await expect(new PostgresMediaCatalog(client).replaceStreamMetadata(asset.assetId, [])).rejects.toThrow(MediaCatalogInvariantError);
    expect(client.calls.map((call) => call.text.trim())).toEqual([
      'BEGIN',
      'SELECT asset_id FROM media_assets WHERE asset_id = $1 FOR SHARE',
      'ROLLBACK',
    ]);
  });

  it('rejects duplicate stream indexes before opening a transaction', async () => {
    const client = new ScriptedClient([]);
    const duplicate = [0, 0].map((streamIndex, i) => ({
      streamId: `${asset.assetId}:stream:${i}`, assetId: asset.assetId, streamIndex, kind: 'audio' as const,
      timeBase: { numerator: 1, denominator: 48000 }, startPts: 0, durationPts: 48000,
    }));
    await expect(new PostgresMediaCatalog(client).replaceStreamMetadata(asset.assetId, duplicate)).rejects.toThrow('duplicate streamIndex 0');
    expect(client.calls).toHaveLength(0);
  });

  it('fails closed if PostgreSQL returns timing outside the JavaScript safe-integer domain', async () => {
    const client = new ScriptedClient([{
      rows: [{
        stream_id: `${asset.assetId}:stream:0`, asset_id: asset.assetId, stream_index: 0, kind: 'video', codec_name: null,
        time_base_numerator: '1', time_base_denominator: '90000', start_pts: '9007199254740992', duration_pts: null,
        width: null, height: null, sample_rate: null, channels: null,
      }],
      rowCount: 1,
    }]);
    await expect(new PostgresMediaCatalog(client).getStreamMetadata(asset.assetId)).rejects.toThrow('safe integer domain');
  });
});
