import { normalizeCanonicalRational, type CanonicalRational } from './canonical-timeline.contract.js';

export const DELIVERY_PROFILE_SCHEMA_VERSION = '1.0' as const;

export type DeliveryProfileStatus = 'draft' | 'approved' | 'archived';
export type DeliveryPlatform = 'tiktok' | 'instagram-reels' | 'youtube-shorts' | 'facebook-reels' | 'other';
export type DeliveryContainer = 'mp4' | 'mov' | 'webm';
export type DeliveryVideoCodec = 'h264' | 'hevc' | 'av1' | 'vp9';
export type DeliveryPixelFormat = 'yuv420p' | 'yuv420p10le' | 'yuv422p10le';
export type DeliveryColorRange = 'limited' | 'full';
export type DeliveryHdrPolicy = 'preserve' | 'tone-map-to-sdr' | 'reject-hdr';
export type DeliveryAudioCodec = 'aac' | 'opus' | 'pcm-s16le';
export type DeliveryCaptionMode = 'burned-in' | 'sidecar' | 'both' | 'none';

export interface DeliveryVideoPolicyV1 {
  container: DeliveryContainer;
  codec: DeliveryVideoCodec;
  pixelFormat: DeliveryPixelFormat;
  width: number;
  height: number;
  frameRate: CanonicalRational;
  colorPrimaries: string;
  colorTransfer: string;
  colorMatrix: string;
  colorRange: DeliveryColorRange;
  hdrPolicy: DeliveryHdrPolicy;
  maxVideoBitrateKbps: number | null;
}

export interface DeliveryAudioPolicyV1 {
  codec: DeliveryAudioCodec;
  sampleRateHz: number;
  channels: 1 | 2;
  integratedLufsTarget: number;
  truePeakDbtpMax: number;
}

export interface DeliveryCaptionPolicyV1 {
  mode: DeliveryCaptionMode;
  safeAreaPercent: number;
  maxLines: number;
  sidecarFormat: 'srt' | 'vtt' | null;
}

/** Measurable final-delivery policy only; editorial timing/style and encoder implementation remain separate authorities. */
export interface DeliveryProfileV1 {
  schemaVersion: typeof DELIVERY_PROFILE_SCHEMA_VERSION;
  profileId: string;
  profileVersion: string;
  status: DeliveryProfileStatus;
  platform: DeliveryPlatform;
  video: DeliveryVideoPolicyV1;
  audio: DeliveryAudioPolicyV1;
  captions: DeliveryCaptionPolicyV1;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryProfileValidationResult {
  valid: boolean;
  errors: string[];
}

const isPositiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const isFiniteInRange = (value: number, min: number, max: number): boolean => Number.isFinite(value) && value >= min && value <= max;
const isValidDate = (value: string): boolean => value.trim().length > 0 && Number.isFinite(Date.parse(value));

export function validateDeliveryProfileV1(profile: DeliveryProfileV1): DeliveryProfileValidationResult {
  const errors: string[] = [];
  if (profile.schemaVersion !== DELIVERY_PROFILE_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if (!profile.profileId.trim() || !profile.profileVersion.trim()) errors.push('profileId and profileVersion are required');

  const { video } = profile;
  if (!isPositiveSafeInteger(video.width) || !isPositiveSafeInteger(video.height)) errors.push('video width and height must be positive safe integers');
  try {
    const normalized = normalizeCanonicalRational(video.frameRate);
    if (normalized.numerator !== video.frameRate.numerator || normalized.denominator !== video.frameRate.denominator) {
      errors.push('video frameRate must be normalized to reduced canonical rational form');
    }
  } catch {
    errors.push('video frameRate must be a positive canonical rational');
  }
  if (video.maxVideoBitrateKbps !== null && !isPositiveSafeInteger(video.maxVideoBitrateKbps)) errors.push('maxVideoBitrateKbps must be null or a positive safe integer');
  if (!video.colorPrimaries.trim() || !video.colorTransfer.trim() || !video.colorMatrix.trim()) errors.push('video color primaries, transfer and matrix are required');

  const { audio } = profile;
  if (!isPositiveSafeInteger(audio.sampleRateHz)) errors.push('audio sampleRateHz must be a positive safe integer');
  if (!isFiniteInRange(audio.integratedLufsTarget, -40, -5)) errors.push('integratedLufsTarget must be between -40 and -5 LUFS');
  if (!isFiniteInRange(audio.truePeakDbtpMax, -12, 0)) errors.push('truePeakDbtpMax must be between -12 and 0 dBTP');

  const { captions } = profile;
  if (!isFiniteInRange(captions.safeAreaPercent, 0, 30)) errors.push('caption safeAreaPercent must be between 0 and 30');
  if (!isPositiveSafeInteger(captions.maxLines)) errors.push('caption maxLines must be a positive safe integer');
  const sidecarRequested = captions.mode === 'sidecar' || captions.mode === 'both';
  if (sidecarRequested && captions.sidecarFormat === null) errors.push('sidecarFormat is required when caption mode requests sidecar output');
  if (!sidecarRequested && captions.sidecarFormat !== null) errors.push('sidecarFormat must be null when sidecar output is not requested');

  if (!isValidDate(profile.createdAt) || !isValidDate(profile.updatedAt)) errors.push('createdAt and updatedAt must be valid ISO-8601 timestamps');
  else if (Date.parse(profile.updatedAt) < Date.parse(profile.createdAt)) errors.push('updatedAt must be greater than or equal to createdAt');

  return { valid: errors.length === 0, errors };
}
