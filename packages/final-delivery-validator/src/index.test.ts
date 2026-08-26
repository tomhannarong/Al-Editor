import { describe, expect, it } from 'vitest';
import type { DeliveryProfileV1 } from '../../contracts/src/delivery-profile.contract.js';
import {
  FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION,
  validateFinalDeliveryAgainstProfileV1,
  type FinalDeliveryMeasurementV1,
} from './index.js';

const profile: DeliveryProfileV1 = {
  schemaVersion: '1.0',
  profileId: 'delivery-tiktok-1080x1920',
  profileVersion: '1.0.0',
  status: 'approved',
  platform: 'tiktok',
  video: {
    container: 'mp4',
    codec: 'h264',
    pixelFormat: 'yuv420p',
    width: 1080,
    height: 1920,
    frameRate: { numerator: 30000, denominator: 1001 },
    colorPrimaries: 'bt709',
    colorTransfer: 'bt709',
    colorMatrix: 'bt709',
    colorRange: 'limited',
    hdrPolicy: 'reject-hdr',
    maxVideoBitrateKbps: 12000,
  },
  audio: {
    codec: 'aac',
    sampleRateHz: 48000,
    channels: 2,
    integratedLufsTarget: -14,
    truePeakDbtpMax: -1,
  },
  captions: {
    mode: 'both',
    safeAreaPercent: 8,
    maxLines: 2,
    sidecarFormat: 'srt',
  },
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const measurement: FinalDeliveryMeasurementV1 = {
  schemaVersion: FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION,
  deliveryProfileId: profile.profileId,
  deliveryProfileVersion: profile.profileVersion,
  video: {
    container: 'mp4',
    codec: 'h264',
    pixelFormat: 'yuv420p',
    width: 1080,
    height: 1920,
    frameRate: { numerator: 60000, denominator: 2002 },
    colorPrimaries: 'bt709',
    colorTransfer: 'bt709',
    colorMatrix: 'bt709',
    colorRange: 'limited',
    averageVideoBitrateKbps: 8000,
  },
  audio: {
    codec: 'aac',
    sampleRateHz: 48000,
    channels: 2,
    integratedLufs: -14,
    truePeakDbtp: -1.2,
  },
  captions: {
    burnedIn: true,
    sidecarFormat: 'srt',
    safeAreaPercent: 10,
    maxRenderedLines: 2,
  },
};

describe('final delivery validation', () => {
  it('accepts measured delivery evidence that satisfies the exact profile', () => {
    expect(validateFinalDeliveryAgainstProfileV1(profile, measurement)).toEqual({ valid: true, errors: [] });
  });

  it('accepts rationally equivalent measured frame rates without creating decimal-time authority', () => {
    const equivalent = structuredClone(measurement);
    equivalent.video.frameRate = { numerator: 30000, denominator: 1001 };
    expect(validateFinalDeliveryAgainstProfileV1(profile, equivalent).valid).toBe(true);
  });

  it('fails closed on profile identity, codec, canvas, color, bitrate, audio, loudness and caption mismatches', () => {
    const invalid = structuredClone(measurement);
    invalid.deliveryProfileVersion = '2.0.0';
    invalid.video.codec = 'hevc';
    invalid.video.width = 720;
    invalid.video.colorTransfer = 'smpte2084';
    invalid.video.averageVideoBitrateKbps = 13000;
    invalid.audio.sampleRateHz = 44100;
    invalid.audio.integratedLufs = -13;
    invalid.audio.truePeakDbtp = -0.5;
    invalid.captions.burnedIn = false;
    invalid.captions.sidecarFormat = 'vtt';

    const result = validateFinalDeliveryAgainstProfileV1(profile, invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'measurement must bind to the exact delivery profile identity/version',
      'video codec does not match delivery profile',
      'video canvas does not match delivery profile',
      'video color transfer does not match delivery profile',
      'video bitrate exceeds delivery profile ceiling or is unavailable',
      'audio sample rate does not match delivery profile',
      'measured integrated loudness does not match delivery profile target',
      'measured true peak exceeds delivery profile maximum',
      'burned-in caption presence does not match delivery profile',
      'caption sidecar format does not match delivery profile',
    ]));
  });

  it('does not silently pass an invalid delivery profile', () => {
    const invalidProfile = structuredClone(profile);
    invalidProfile.video.frameRate = { numerator: 60000, denominator: 2002 };
    const result = validateFinalDeliveryAgainstProfileV1(invalidProfile, measurement);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('invalid delivery profile:');
  });
});
