import type { NativeMediaStreamMetadata } from '../../contracts/src/media-catalog.contract.js';
import {
  probeAndIngestFfprobeStreamMetadata,
  type FfprobeExecutionOptions,
} from './ffprobe.js';
import {
  ingestLocalMediaFile,
  type IngestLocalMediaFileInput,
} from './local-file-ingest.js';
import {
  materializeManagedOriginal,
  type ManagedOriginalMaterializationResult,
} from './managed-original.js';
import type { IngestMediaContentResult, MediaCatalogPersistence } from './index.js';

export interface ImmutableLocalMediaIngestInput extends IngestLocalMediaFileInput {
  managedRoot: string;
  managedLocationId: string;
  managedObservedAt: string;
  ffprobe?: FfprobeExecutionOptions;
}

export interface ImmutableLocalMediaIngestResult {
  source: IngestMediaContentResult;
  managedOriginal: ManagedOriginalMaterializationResult;
  streams: NativeMediaStreamMetadata[];
}

/**
 * Thin orchestration boundary for local immutable ingest.
 *
 * Side effects are deliberately ordered so ffprobe metadata cannot be
 * published until the content-addressed managed original has been verified.
 * Each stage delegates to the existing verified primitive rather than
 * introducing a second identity, storage, or timing implementation.
 */
export async function ingestImmutableLocalMedia(
  input: ImmutableLocalMediaIngestInput,
  persistence: MediaCatalogPersistence,
): Promise<ImmutableLocalMediaIngestResult> {
  const sourceInput: IngestLocalMediaFileInput = {
    filePath: input.filePath,
    allowedRoot: input.allowedRoot,
    firstIngestedAt: input.firstIngestedAt,
    locationId: input.locationId,
    observedAt: input.observedAt,
    ...(input.chunkSize === undefined ? {} : { chunkSize: input.chunkSize }),
  };
  const source = await ingestLocalMediaFile(sourceInput, persistence);

  const managedOriginal = await materializeManagedOriginal({
    sourceFilePath: input.filePath,
    allowedSourceRoot: input.allowedRoot,
    managedRoot: input.managedRoot,
    asset: source.asset,
    locationId: input.managedLocationId,
    observedAt: input.managedObservedAt,
    ...(input.chunkSize === undefined ? {} : { chunkSize: input.chunkSize }),
  }, persistence);

  const streams = await probeAndIngestFfprobeStreamMetadata(
    source.asset.assetId,
    managedOriginal.destinationPath,
    persistence,
    input.ffprobe,
  );

  return { source, managedOriginal, streams };
}
