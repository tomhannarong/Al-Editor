import {
  validateDeliveryProfileV1,
  type DeliveryProfileV1,
} from '../../contracts/src/delivery-profile.contract.js';
import {
  normalizeCanonicalRational,
  type CanonicalRational,
} from '../../contracts/src/canonical-timeline.contract.js';

export const FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION = '1.0' as const;

export interface FinalDeliveryVideoMeasurementV1 {
  container: DeliveryProfileV1['video']['container'];
  codec: DeliveryProfileV1['video']['codec'];
  pixelFormat: DeliveryProfileV1['video']['pixelFormat'];
  width: number;
  height: number;
  frameRate: CanonicalRational;
  colorPrimaries: string;
  colorTransfer: string;
  colorMatrix: string;
  colorRange: DeliveryProfileV1['video']['colorRange'];
  averageVideoBitrateKbps: number | null;
}

export interface FinalDeliveryAudioMeasurementV1 {
  codec: DeliveryProfileV1['audio']['codec'];
  sampleRateHz: number;
  channels: number;
  integratedLufs: number;
  truePeakDbtp: number;
}

export interface FinalDeliveryCaptionMeasurementV1 {
  burnedIn: boolean;
  sidecarFormat: 'srt' | 'vtt' | null;
  safeAreaPercent: number | null;
  maxRenderedLines: number | null;
}

/**
 * Normalized, measured evidence about one rendered artifact. Raw ffprobe or
 * loudness-tool output must be validated/normalized before constructing this
 * record. This evidence is not a timing authority.
 */
export interface FinalDeliveryMeasurementV1 {
  schemaVersion: typeof FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION;
  deliveryProfileId: string;
  deliveryProfileVersion: string;
  video: FinalDeliveryVideoMeasurementV1;
  audio: FinalDeliveryAudioMeasurementV1;
  captions: FinalDeliveryCaptionMeasurementV1;
}

export interface FinalDeliveryValidationResult {
  valid: boolean;
  errors: string[];
}

function sameRational(left: CanonicalRational, right: CanonicalRational): boolean {
  const a = normalizeCanonicalRational(left);
  const b = normalizeCanonicalRational(right);
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

export function validateFinalDeliveryAgainstProfileV1(
  profile: DeliveryProfileV1,
  measurement: FinalDeliveryMeasurementV1,
): FinalDeliveryValidationResult {
  const profileValidation = validateDeliveryProfileV1(profile);
  if (!profileValidation.valid) {
    return {
      valid: false,
      errors: profileValidation.errors.map((error) => `invalid delivery profile: ${error}`),
    };
  }

  const errors: string[] = [];
  if (measurement.schemaVersion !== FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION) {
    errors.push('measurement schemaVersion must be 1.0');
  }
  if (measurement.deliveryProfileId !== profile.profileId || measurement.deliveryProfileVersion !== profile.profileVersion) {
    errors.push('measurement must bind to the exact delivery profile identity/version');
  }

  const expectedVideo = profile.video;
  const actualVideo = measurement.video;
  if (actualVideo.container !== expectedVideo.container) errors.push('video container does not match delivery profile');
  if (actualVideo.codec !== expectedVideo.codec) errors.push('video codec does not match delivery profile');
  if (actualVideo.pixelFormat !== expectedVideo.pixelFormat) errors.push('video pixel format does not match delivery profile');
  if (actualVideo.width !== expectedVideo.width || actualVideo.height !== expectedVideo.height) errors.push('video canvas does not match delivery profile');
  try {
    if (!sameRational(actualVideo.frameRate, expectedVideo.frameRate)) errors.push('video frame rate does not match delivery profile');
  } catch {
    errors.push('measured video frame rate must be a positive canonical rational');
  }
  if (actualVideo.colorPrimaries !== expectedVideo.colorPrimaries) errors.push('video color primaries do not match delivery profile');
  if (actualVideo.colorTransfer !== expectedVideo.colorTransfer) errors.push('video color transfer does not match delivery profile');
  if (actualVideo.colorMatrix !== expectedVideo.colorMatrix) errors.push('video color matrix does not match delivery profile');
  if (actualVideo.colorRange !== expectedVideo.colorRange) errors.push('video color range does not match delivery profile');
  if (expectedVideo.maxVideoBitrateKbps !== null) {
    if (!Number.isFinite(actualVideo.averageVideoBitrateKbps ?? Number.NaN) || (actualVideo.averageVideoBitrateKbps ?? Infinity) > expectedVideo.maxVideoBitrateKbps) {
      errors.push('video bitrate exceeds delivery profile ceiling or is unavailable');
    }
  }

  const expectedAudio = profile.audio;
  const actualAudio = measurement.audio;
  if (actualAudio.codec !== expectedAudio.codec) errors.push('audio codec does not match delivery profile');
  if (actualAudio.sampleRateHz !== expectedAudio.sampleRateHz) errors.push('audio sample rate does not match delivery profile');
  if (actualAudio.channels !== expectedAudio.channels) errors.push('audio channel count does not match delivery profile');
  if (!Number.isFinite(actualAudio.integratedLufs) || actualAudio.integratedLufs !== expectedAudio.integratedLufsTarget) {
    errors.push('measured integrated loudness does not match delivery profile target');
  }
  if (!Number.isFinite(actualAudio.truePeakDbtp) || actualAudio.truePeakDbtp > expectedAudio.truePeakDbtpMax) {
    errors.push('measured true peak exceeds delivery profile maximum');
  }

  const expectedCaptions = profile.captions;
  const actualCaptions = measurement.captions;
  const expectsBurned = expectedCaptions.mode === 'burned-in' || expectedCaptions.mode === 'both';
  const expectsSidecar = expectedCaptions.mode === 'sidecar' || expectedCaptions.mode === 'both';
  if (actualCaptions.burnedIn !== expectsBurned) errors.push('burned-in caption presence does not match delivery profile');
  if (expectsSidecar) {
    if (actualCaptions.sidecarFormat !== expectedCaptions.sidecarFormat) errors.push('caption sidecar format does not match delivery profile');
  } else if (actualCaptions.sidecarFormat !== null) {
    errors.push('unexpected caption sidecar output');
  }
  if (expectsBurned) {
    if (actualCaptions.safeAreaPercent === null || actualCaptions.safeAreaPercent < expectedCaptions.safeAreaPercent) {
      errors.push('burned-in caption safe area is below delivery profile requirement');
    }
    if (actualCaptions.maxRenderedLines === null || actualCaptions.maxRenderedLines > expectedCaptions.maxLines) {
      errors.push('burned-in caption line count exceeds delivery profile maximum');
    }
  }

  return { valid: errors.length === 0, errors };
}
