import { describe, expect, it } from 'vitest';
import {
  assetIdFromSha256,
  sameImmutableAsset,
  validateMediaStorageLocation,
  validateNativeMediaStreamMetadata,
  validateStableMediaAssetIdentity,
  type StableMediaAssetIdentity,
} from './media-catalog.contract.js';

const digest = 'a'.repeat(64);
const identity: StableMediaAssetIdentity = {
  schemaVersion: '1.0',
  assetId: `sha256:${digest}`,
  contentDigest: { algorithm: 'sha256', hex: digest },
  byteSize: 42,
  firstIngestedAt: '2026-08-25T03:00:00+07:00',
};

describe('media catalog identity contract', () => {
  it('derives stable asset identity from immutable bytes, not storage location', () => {
    expect(assetIdFromSha256(digest.toUpperCase())).toBe(`sha256:${digest}`);
    expect(validateStableMediaAssetIdentity(identity)).toEqual({ valid: true, errors: [] });
    expect(validateMediaStorageLocation({
      locationId: 'loc-1', assetId: identity.assetId, uri: 'file:///mnt/a.mov', state: 'available', observedAt: '2026-08-25T03:00:01+07:00',
    }).valid).toBe(true);
    expect(validateMediaStorageLocation({
      locationId: 'loc-2', assetId: identity.assetId, uri: 'file:///archive/renamed.mov', state: 'available', observedAt: '2026-08-25T03:00:02+07:00',
    }).valid).toBe(true);
  });

  it('keeps re-ingest idempotent for identical immutable bytes', () => {
    const reingested = { ...identity, firstIngestedAt: '2026-08-25T04:00:00+07:00' };
    expect(sameImmutableAsset(identity, reingested)).toBe(true);
    expect(sameImmutableAsset(identity, { ...reingested, byteSize: 43 })).toBe(false);
  });

  it('rejects path-derived or malformed identities', () => {
    expect(validateStableMediaAssetIdentity({ ...identity, assetId: 'file:///mnt/a.mov' }).valid).toBe(false);
    expect(() => assetIdFromSha256('not-a-digest')).toThrow();
  });

  it('normalizes native stream timing without derived-seconds authority', () => {
    expect(validateNativeMediaStreamMetadata({
      streamId: `${identity.assetId}:stream:0`,
      assetId: identity.assetId,
      streamIndex: 0,
      kind: 'video',
      codecName: 'h264',
      timeBase: { numerator: 1, denominator: 90000 },
      startPts: 9009,
      durationPts: 270000,
      width: 1920,
      height: 1080,
    })).toEqual({ valid: true, errors: [] });

    expect(validateNativeMediaStreamMetadata({
      streamId: 'bad', assetId: identity.assetId, streamIndex: 0, kind: 'video', timeBase: { numerator: 0, denominator: 1 }, startPts: 0, durationPts: 1,
    }).valid).toBe(false);
  });
});
