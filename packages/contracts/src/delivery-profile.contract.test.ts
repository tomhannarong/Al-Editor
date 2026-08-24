import { describe, expect, it } from 'vitest';
import { validateDeliveryProfileV1, type DeliveryProfileV1 } from './delivery-profile.contract.js';

const makeProfile = (): DeliveryProfileV1 => ({
  schemaVersion: '1.0', profileId: 'vertical-social', profileVersion: '1.0.0', status: 'approved', platform: 'tiktok',
  video: { container: 'mp4', codec: 'h264', pixelFormat: 'yuv420p', width: 1080, height: 1920, frameRate: { numerator: 30000, denominator: 1001 }, colorPrimaries: 'bt709', colorTransfer: 'bt709', colorMatrix: 'bt709', colorRange: 'limited', hdrPolicy: 'tone-map-to-sdr', maxVideoBitrateKbps: 12000 },
  audio: { codec: 'aac', sampleRateHz: 48000, channels: 2, integratedLufsTarget: -14, truePeakDbtpMax: -1 },
  captions: { mode: 'burned-in', safeAreaPercent: 8, maxLines: 2, sidecarFormat: null },
  createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
});

describe('delivery profile v1', () => {
  it('accepts measurable vertical-social delivery policy', () => expect(validateDeliveryProfileV1(makeProfile()).valid).toBe(true));
  it('requires reduced canonical rational fps', () => { const p = makeProfile(); p.video.frameRate = { numerator: 60000, denominator: 2002 }; expect(validateDeliveryProfileV1(p).valid).toBe(false); });
  it('requires sidecar format exactly when sidecar output is requested', () => { const p = makeProfile(); p.captions.mode = 'both'; expect(validateDeliveryProfileV1(p).valid).toBe(false); p.captions.sidecarFormat = 'srt'; expect(validateDeliveryProfileV1(p).valid).toBe(true); });
  it('rejects invalid loudness/true-peak policy', () => { const p = makeProfile(); p.audio.integratedLufsTarget = -50; p.audio.truePeakDbtpMax = 1; expect(validateDeliveryProfileV1(p).valid).toBe(false); });
  it('requires explicit color metadata', () => { const p = makeProfile(); p.video.colorPrimaries = ''; expect(validateDeliveryProfileV1(p).valid).toBe(false); });
  it('rejects invalid or reversed timestamps', () => { const p = makeProfile(); p.updatedAt = '2026-08-24T00:00:00Z'; expect(validateDeliveryProfileV1(p).valid).toBe(false); p.updatedAt = 'bad'; expect(validateDeliveryProfileV1(p).valid).toBe(false); });
});
