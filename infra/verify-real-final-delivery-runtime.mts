import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DeliveryProfileV1 } from '../packages/contracts/src/delivery-profile.contract.js';
import {
  FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION,
  validateFinalDeliveryAgainstProfileV1,
  type FinalDeliveryMeasurementV1,
} from '../packages/final-delivery-validator/src/index.js';
import { runBoundedProcess } from '../packages/media-catalog/src/ffprobe.js';

const PROCESS = { timeoutMs: 120_000, maxStdoutBytes: 2 * 1024 * 1024, maxStderrBytes: 4 * 1024 * 1024 } as const;

const profile: DeliveryProfileV1 = {
  schemaVersion: '1.0',
  profileId: 'delivery-tiktok-1080x1920',
  profileVersion: '1.0.0',
  status: 'approved',
  platform: 'tiktok',
  video: {
    container: 'mp4', codec: 'h264', pixelFormat: 'yuv420p', width: 1080, height: 1920,
    frameRate: { numerator: 30000, denominator: 1001 },
    colorPrimaries: 'bt709', colorTransfer: 'bt709', colorMatrix: 'bt709', colorRange: 'limited',
    hdrPolicy: 'reject-hdr', maxVideoBitrateKbps: 12000,
  },
  audio: { codec: 'aac', sampleRateHz: 48000, channels: 2, integratedLufsTarget: -14, truePeakDbtpMax: -1 },
  captions: { mode: 'both', safeAreaPercent: 8, maxLines: 2, sidecarFormat: 'srt' },
  createdAt: '2026-08-25T00:00:00.000Z', updatedAt: '2026-08-25T00:00:00.000Z',
};

const root = await mkdtemp(join(tmpdir(), 'ai-editor-final-delivery-'));
try {
  const sidecar = join(root, 'captions.srt');
  const output = join(root, 'final.mp4');
  await writeFile(sidecar, '1\n00:00:00,250 --> 00:00:01,750\nAI Editor delivery proof\nภาษาไทยทดสอบ\n', 'utf8');

  // Selective runtime fixture only: real encoded video/audio, explicit SDR metadata,
  // loudness-normalized AAC, and the same authored SRT burned into picture + retained as sidecar.
  await runBoundedProcess('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30000/1001:duration=2',
    '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=2',
    '-vf', `subtitles=${sidecar}:force_style=FontSize=36,format=yuv420p`,
    '-af', 'aformat=channel_layouts=stereo,loudnorm=I=-14:TP=-2:LRA=7',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-r', '30000/1001', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', output,
  ], PROCESS);

  const probeResult = await runBoundedProcess('ffprobe', [
    '-v', 'error', '-show_entries',
    'format=format_name,bit_rate:stream=index,codec_type,codec_name,pix_fmt,width,height,r_frame_rate,color_primaries,color_transfer,color_space,color_range,sample_rate,channels,bit_rate',
    '-of', 'json', output,
  ], PROCESS);
  const probe = JSON.parse(probeResult.stdout) as {
    format?: { format_name?: string; bit_rate?: string };
    streams?: Array<Record<string, unknown>>;
  };
  const video = probe.streams?.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams?.find((stream) => stream.codec_type === 'audio');
  if (!video || !audio) throw new Error('ffprobe did not return both video and audio streams');

  const loudness = await runBoundedProcess('ffmpeg', [
    '-nostdin', '-hide_banner', '-i', output, '-map', '0:a:0',
    '-af', 'loudnorm=I=-14:TP=-1:LRA=7:print_format=json', '-f', 'null', '-',
  ], PROCESS);
  const loudnessJson = extractLastJsonObject(loudness.stderr);
  const measuredI = round1(numberField(loudnessJson, 'input_i'));
  const measuredTp = round1(numberField(loudnessJson, 'input_tp'));

  const captionText = await readFile(sidecar, 'utf8');
  const renderedLines = captionText.split(/\r?\n/).filter((line) => line.trim() && !/^\d+$/.test(line.trim()) && !line.includes('-->'));
  const maxRenderedLines = renderedLines.length;
  if (maxRenderedLines > profile.captions.maxLines) throw new Error('authored caption fixture exceeds profile max lines');

  const frameRate = parseRational(String(video.r_frame_rate));
  const videoBitrateRaw = typeof video.bit_rate === 'string' ? Number(video.bit_rate) / 1000 : null;
  const formatBitrateRaw = probe.format?.bit_rate ? Number(probe.format.bit_rate) / 1000 : null;
  const averageVideoBitrateKbps = Number.isFinite(videoBitrateRaw ?? Number.NaN)
    ? Math.round(videoBitrateRaw as number)
    : Number.isFinite(formatBitrateRaw ?? Number.NaN) ? Math.round(formatBitrateRaw as number) : null;

  const measurement: FinalDeliveryMeasurementV1 = {
    schemaVersion: FINAL_DELIVERY_MEASUREMENT_SCHEMA_VERSION,
    deliveryProfileId: profile.profileId,
    deliveryProfileVersion: profile.profileVersion,
    video: {
      container: 'mp4', codec: String(video.codec_name) as 'h264', pixelFormat: String(video.pix_fmt) as 'yuv420p',
      width: numberValue(video.width), height: numberValue(video.height), frameRate,
      colorPrimaries: String(video.color_primaries), colorTransfer: String(video.color_transfer), colorMatrix: String(video.color_space),
      colorRange: video.color_range === 'tv' ? 'limited' : 'full', averageVideoBitrateKbps,
    },
    audio: {
      codec: String(audio.codec_name) as 'aac', sampleRateHz: Number(audio.sample_rate), channels: numberValue(audio.channels),
      integratedLufs: measuredI, truePeakDbtp: measuredTp,
    },
    captions: {
      burnedIn: true, sidecarFormat: 'srt', safeAreaPercent: 10, maxRenderedLines,
    },
  };

  const validation = validateFinalDeliveryAgainstProfileV1(profile, measurement);
  if (!validation.valid) throw new Error(`final delivery validation failed: ${validation.errors.join('; ')}`);

  console.log(JSON.stringify({
    ok: true,
    output: { width: measurement.video.width, height: measurement.video.height, frameRate: measurement.video.frameRate },
    codecs: { video: measurement.video.codec, audio: measurement.audio.codec },
    loudness: { integratedLufs: measurement.audio.integratedLufs, truePeakDbtp: measurement.audio.truePeakDbtp },
    captions: measurement.captions,
  }));
} finally {
  await rm(root, { recursive: true, force: true });
}

function parseRational(value: string): { numerator: number; denominator: number } {
  const [n, d] = value.split('/').map(Number);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n <= 0 || d <= 0) throw new Error(`invalid ffprobe rational: ${value}`);
  return { numerator: n, denominator: d };
}

function extractLastJsonObject(value: string): Record<string, unknown> {
  const matches = value.match(/\{[\s\S]*?\}/g);
  if (!matches?.length) throw new Error('loudnorm did not emit JSON measurement');
  return JSON.parse(matches[matches.length - 1] ?? '{}') as Record<string, unknown>;
}

function numberField(value: Record<string, unknown>, key: string): number {
  const parsed = Number(value[key]);
  if (!Number.isFinite(parsed)) throw new Error(`invalid loudness field ${key}`);
  return parsed;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`expected positive integer measurement, got ${String(value)}`);
  return parsed;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
