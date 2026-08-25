import type {
  MediaStorageLocation,
  NativeMediaStreamMetadata,
  StableMediaAssetIdentity,
} from '../../contracts/src/media-catalog.contract.js';
import { InMemoryMediaCatalog } from './index.js';
import {
  ingestImmutableLocalMedia,
  type ImmutableLocalMediaIngestInput,
  type ImmutableLocalMediaIngestResult,
} from './immutable-ingest.js';

export interface ValidatedImmutableIngestBundle {
  asset: StableMediaAssetIdentity;
  sourceLocation: MediaStorageLocation;
  managedLocation: MediaStorageLocation;
  streams: NativeMediaStreamMetadata[];
}

/**
 * Durable persistence boundary for a fully validated immutable ingest bundle.
 * Implementations are expected to commit the bundle atomically and idempotently.
 */
export interface DurableImmutableIngestPersistence {
  commitValidatedImmutableIngest(bundle: ValidatedImmutableIngestBundle): Promise<void>;
}

export interface StagedImmutableLocalMediaIngest {
  result: ImmutableLocalMediaIngestResult;
  bundle: ValidatedImmutableIngestBundle;
}

/**
 * Runs the existing verified ingest primitives against isolated staging state.
 * No durable catalog write is possible until source hashing, managed-original
 * verification and ffprobe/native-timing validation have all succeeded.
 */
export async function stageImmutableLocalMediaIngest(
  input: ImmutableLocalMediaIngestInput,
): Promise<StagedImmutableLocalMediaIngest> {
  const staging = new InMemoryMediaCatalog();
  const result = await ingestImmutableLocalMedia(input, staging);

  return {
    result,
    bundle: {
      asset: cloneAsset(result.source.asset),
      sourceLocation: { ...result.source.location },
      managedLocation: { ...result.managedOriginal.location },
      streams: result.streams.map(cloneStream),
    },
  };
}

/**
 * Durable orchestration boundary: validate everything first, then hand one
 * immutable aggregate to the durable transaction implementation.
 */
export async function ingestImmutableLocalMediaDurably(
  input: ImmutableLocalMediaIngestInput,
  persistence: DurableImmutableIngestPersistence,
): Promise<ImmutableLocalMediaIngestResult> {
  const staged = await stageImmutableLocalMediaIngest(input);
  await persistence.commitValidatedImmutableIngest(cloneBundle(staged.bundle));
  return staged.result;
}

function cloneBundle(bundle: ValidatedImmutableIngestBundle): ValidatedImmutableIngestBundle {
  return {
    asset: cloneAsset(bundle.asset),
    sourceLocation: { ...bundle.sourceLocation },
    managedLocation: { ...bundle.managedLocation },
    streams: bundle.streams.map(cloneStream),
  };
}

function cloneAsset(asset: StableMediaAssetIdentity): StableMediaAssetIdentity {
  return { ...asset, contentDigest: { ...asset.contentDigest } };
}

function cloneStream(stream: NativeMediaStreamMetadata): NativeMediaStreamMetadata {
  return { ...stream, timeBase: { ...stream.timeBase } };
}
