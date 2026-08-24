import {
  sameImmutableAsset,
  validateMediaStorageLocation,
  validateNativeMediaStreamMetadata,
  validateStableMediaAssetIdentity,
  type MediaStorageLocation,
  type NativeMediaStreamMetadata,
  type StableMediaAssetIdentity,
} from '../../contracts/src/media-catalog.contract.js';
import { MediaCatalogInvariantError } from './index.js';

export interface PostgresQueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount: number | null;
}

/** A dedicated PostgreSQL connection/client. Transactional methods must not use a pool facade that can switch connections. */
export interface PostgresQueryClient {
  query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PostgresQueryResult<Row>>;
}

type AssetRow = {
  asset_id: string;
  schema_version: string;
  digest_algorithm: string;
  digest_hex: string;
  byte_size: string | number;
  first_ingested_at: string | Date;
};

type LocationRow = {
  location_id: string;
  asset_id: string;
  uri: string;
  state: MediaStorageLocation['state'];
  observed_at: string | Date;
};

type StreamRow = {
  stream_id: string;
  asset_id: string;
  stream_index: number;
  kind: NativeMediaStreamMetadata['kind'];
  codec_name: string | null;
  time_base_numerator: string | number;
  time_base_denominator: string | number;
  start_pts: string | number | null;
  duration_pts: string | number | null;
  width: number | null;
  height: number | null;
  sample_rate: number | null;
  channels: number | null;
};

export class PostgresMediaCatalog {
  constructor(private readonly client: PostgresQueryClient) {}

  async registerAsset(candidate: StableMediaAssetIdentity): Promise<{ asset: StableMediaAssetIdentity; created: boolean }> {
    assertAsset(candidate);
    const inserted = await this.client.query<AssetRow>(
      `INSERT INTO media_assets (asset_id, schema_version, digest_algorithm, digest_hex, byte_size, first_ingested_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (asset_id) DO NOTHING
       RETURNING asset_id, schema_version, digest_algorithm, digest_hex, byte_size, first_ingested_at`,
      [candidate.assetId, candidate.schemaVersion, candidate.contentDigest.algorithm, candidate.contentDigest.hex, candidate.byteSize, candidate.firstIngestedAt],
    );
    if (inserted.rows[0]) return { asset: assetFromRow(inserted.rows[0]), created: true };

    const existing = await this.getAsset(candidate.assetId);
    if (!existing) throw new MediaCatalogInvariantError('asset conflict disappeared before readback');
    if (!sameImmutableAsset(existing, candidate)) {
      throw new MediaCatalogInvariantError('content-addressed asset identity conflicts with existing immutable bytes');
    }
    return { asset: existing, created: false };
  }

  async rebindLocation(location: MediaStorageLocation): Promise<MediaStorageLocation> {
    assertLocation(location);
    const result = await this.client.query<LocationRow>(
      `INSERT INTO media_storage_locations (location_id, asset_id, uri, state, observed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (location_id) DO UPDATE SET
         asset_id = EXCLUDED.asset_id,
         uri = EXCLUDED.uri,
         state = EXCLUDED.state,
         observed_at = EXCLUDED.observed_at
       RETURNING location_id, asset_id, uri, state, observed_at`,
      [location.locationId, location.assetId, location.uri, location.state, location.observedAt],
    );
    const row = result.rows[0];
    if (!row) throw new MediaCatalogInvariantError('location upsert returned no row');
    return locationFromRow(row);
  }

  async replaceStreamMetadata(assetId: string, streams: NativeMediaStreamMetadata[]): Promise<NativeMediaStreamMetadata[]> {
    const normalized = validateStreamSet(assetId, streams);
    await this.client.query('BEGIN');
    try {
      const owner = await this.client.query<{ asset_id: string }>('SELECT asset_id FROM media_assets WHERE asset_id = $1 FOR SHARE', [assetId]);
      if (!owner.rows[0]) throw new MediaCatalogInvariantError(`cannot persist streams for unknown asset ${assetId}`);
      await this.client.query('DELETE FROM media_streams WHERE asset_id = $1', [assetId]);
      for (const stream of normalized) {
        await this.client.query(
          `INSERT INTO media_streams (
             stream_id, asset_id, stream_index, kind, codec_name,
             time_base_numerator, time_base_denominator, start_pts, duration_pts,
             width, height, sample_rate, channels
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            stream.streamId, stream.assetId, stream.streamIndex, stream.kind, stream.codecName ?? null,
            stream.timeBase.numerator, stream.timeBase.denominator, stream.startPts, stream.durationPts,
            stream.width ?? null, stream.height ?? null, stream.sampleRate ?? null, stream.channels ?? null,
          ],
        );
      }
      await this.client.query('COMMIT');
      return normalized.map(cloneStream);
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw error;
    }
  }

  async getAsset(assetId: string): Promise<StableMediaAssetIdentity | undefined> {
    const result = await this.client.query<AssetRow>(
      'SELECT asset_id, schema_version, digest_algorithm, digest_hex, byte_size, first_ingested_at FROM media_assets WHERE asset_id = $1',
      [assetId],
    );
    return result.rows[0] ? assetFromRow(result.rows[0]) : undefined;
  }

  async getLocation(locationId: string): Promise<MediaStorageLocation | undefined> {
    const result = await this.client.query<LocationRow>(
      'SELECT location_id, asset_id, uri, state, observed_at FROM media_storage_locations WHERE location_id = $1',
      [locationId],
    );
    return result.rows[0] ? locationFromRow(result.rows[0]) : undefined;
  }

  async getStreamMetadata(assetId: string): Promise<NativeMediaStreamMetadata[]> {
    const result = await this.client.query<StreamRow>(
      `SELECT stream_id, asset_id, stream_index, kind, codec_name,
              time_base_numerator, time_base_denominator, start_pts, duration_pts,
              width, height, sample_rate, channels
       FROM media_streams WHERE asset_id = $1 ORDER BY stream_index ASC`,
      [assetId],
    );
    return result.rows.map(streamFromRow);
  }
}

function assertAsset(asset: StableMediaAssetIdentity): void {
  const validation = validateStableMediaAssetIdentity(asset);
  if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));
}

function assertLocation(location: MediaStorageLocation): void {
  const validation = validateMediaStorageLocation(location);
  if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));
}

function validateStreamSet(assetId: string, streams: NativeMediaStreamMetadata[]): NativeMediaStreamMetadata[] {
  const indexes = new Set<number>();
  const ids = new Set<string>();
  return streams.map((stream) => {
    const validation = validateNativeMediaStreamMetadata(stream);
    if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));
    if (stream.assetId !== assetId) throw new MediaCatalogInvariantError('stream assetId must match persistence assetId');
    if (indexes.has(stream.streamIndex)) throw new MediaCatalogInvariantError(`duplicate streamIndex ${stream.streamIndex}`);
    if (ids.has(stream.streamId)) throw new MediaCatalogInvariantError(`duplicate streamId ${stream.streamId}`);
    indexes.add(stream.streamIndex);
    ids.add(stream.streamId);
    return cloneStream(stream);
  }).sort((left, right) => left.streamIndex - right.streamIndex);
}

function assetFromRow(row: AssetRow): StableMediaAssetIdentity {
  const asset: StableMediaAssetIdentity = {
    schemaVersion: '1.0',
    assetId: row.asset_id,
    contentDigest: { algorithm: 'sha256', hex: row.digest_hex },
    byteSize: safeInteger(row.byte_size, 'byte_size', 0),
    firstIngestedAt: timestamp(row.first_ingested_at),
  };
  if (row.schema_version !== asset.schemaVersion || row.digest_algorithm !== asset.contentDigest.algorithm) {
    throw new MediaCatalogInvariantError('persisted media asset uses an unsupported schema or digest algorithm');
  }
  assertAsset(asset);
  return asset;
}

function locationFromRow(row: LocationRow): MediaStorageLocation {
  const location: MediaStorageLocation = {
    locationId: row.location_id,
    assetId: row.asset_id,
    uri: row.uri,
    state: row.state,
    observedAt: timestamp(row.observed_at),
  };
  assertLocation(location);
  return location;
}

function streamFromRow(row: StreamRow): NativeMediaStreamMetadata {
  const stream: NativeMediaStreamMetadata = {
    streamId: row.stream_id,
    assetId: row.asset_id,
    streamIndex: safeInteger(row.stream_index, 'stream_index', 0),
    kind: row.kind,
    timeBase: {
      numerator: safeInteger(row.time_base_numerator, 'time_base_numerator', 1),
      denominator: safeInteger(row.time_base_denominator, 'time_base_denominator', 1),
    },
    startPts: nullableSafeInteger(row.start_pts, 'start_pts'),
    durationPts: nullableSafeInteger(row.duration_pts, 'duration_pts', 0),
  };
  if (row.codec_name !== null) stream.codecName = row.codec_name;
  if (row.width !== null) stream.width = safeInteger(row.width, 'width', 1);
  if (row.height !== null) stream.height = safeInteger(row.height, 'height', 1);
  if (row.sample_rate !== null) stream.sampleRate = safeInteger(row.sample_rate, 'sample_rate', 1);
  if (row.channels !== null) stream.channels = safeInteger(row.channels, 'channels', 1);
  const validation = validateNativeMediaStreamMetadata(stream);
  if (!validation.valid) throw new MediaCatalogInvariantError(validation.errors.join('; '));
  return stream;
}

function safeInteger(value: string | number, label: string, minimum?: number): number {
  const parsed = typeof value === 'string' && /^-?[0-9]+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || (minimum !== undefined && parsed < minimum)) {
    throw new MediaCatalogInvariantError(`persisted ${label} is outside the safe integer domain`);
  }
  return parsed;
}

function nullableSafeInteger(value: string | number | null, label: string, minimum?: number): number | null {
  return value === null ? null : safeInteger(value, label, minimum);
}

function timestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new MediaCatalogInvariantError('persisted timestamp is invalid');
  return date.toISOString();
}

function cloneStream(stream: NativeMediaStreamMetadata): NativeMediaStreamMetadata {
  return { ...stream, timeBase: { ...stream.timeBase } };
}
