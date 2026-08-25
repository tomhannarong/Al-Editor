import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { extractKeyframeDerivativeFrames } from '../packages/keyframe-library/src/generator.ts';
import { runBoundedProcess, probeMediaWithFfprobe } from '../packages/media-catalog/src/ffprobe.ts';
import { KEYFRAME_DERIVATIVE_SCHEMA_VERSION } from '../packages/contracts/src/keyframe-derivative.contract.ts';

const root = await mkdtemp(join(tmpdir(), 'ai-editor-keyframe-runtime-'));
const managedRoot = join(root, 'managed');
const derivativeRoot = join(root, 'derivatives');
await mkdir(managedRoot, { recursive: true });

const managedOriginal = join(managedRoot, 'managed-original.mp4');
await runBoundedProcess('ffmpeg', [
  '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30',
  '-t', '1',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '1', '-bf', '0', '-pix_fmt', 'yuv420p',
  '-video_track_timescale', '90000',
  managedOriginal,
], { timeoutMs: 60_000, maxStdoutBytes: 64 * 1024, maxStderrBytes: 1024 * 1024 });
await chmod(managedOriginal, 0o444);

const frameProbe = await runBoundedProcess('ffprobe', [
  '-v', 'error',
  '-select_streams', 'v:0',
  '-show_entries', 'frame=pts',
  '-of', 'csv=p=0',
  managedOriginal,
], { timeoutMs: 15_000, maxStdoutBytes: 1024 * 1024, maxStderrBytes: 256 * 1024 });
const sourcePts = frameProbe.stdout
  .split(/\r?\n/)
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isSafeInteger(value));
if (!sourcePts.includes(0) || !sourcePts.includes(45_000)) {
  throw new Error(`runtime fixture does not contain required native PTS values: ${JSON.stringify(sourcePts.slice(0, 20))}`);
}

const revisionId = 'keyframe-runtime-rev-1';
const revisionDirectory = createHash('sha256').update(revisionId).digest('hex');
const expectedPaths = [0, 1].map((index) => join(derivativeRoot, revisionDirectory, `${String(index).padStart(6, '0')}.png`));

const outputs = await extractKeyframeDerivativeFrames({
  schemaVersion: KEYFRAME_DERIVATIVE_SCHEMA_VERSION,
  derivativeId: 'keyframes:runtime-scene',
  revisionId,
  source: {
    sceneSetId: 'scene-set-runtime',
    sceneSetRevisionId: 'scene-rev-runtime',
    sceneId: 'scene-runtime',
    assetId: `sha256:${'d'.repeat(64)}`,
    streamId: 'video-0',
    streamIndex: 0,
    timeBase: { numerator: 1, denominator: 90_000 },
  },
  derivativeProfileVersion: 'keyframe-png-v1',
  toolchain: { name: 'ffmpeg', version: 'runtime' },
  createdAt: '2026-08-26T00:00:00.000Z',
  frames: [
    { frameId: 'kf-runtime-0', sourcePts: 0, artifactUri: pathToFileURL(expectedPaths[0]!).href },
    { frameId: 'kf-runtime-45000', sourcePts: 45_000, artifactUri: pathToFileURL(expectedPaths[1]!).href },
  ],
}, managedOriginal, managedRoot, derivativeRoot);

if (outputs.length !== 2) throw new Error(`expected 2 keyframe artifacts, received ${outputs.length}`);

const artifactEvidence: Array<{ sourcePts: number; byteSize: number; codec: string; width: number; height: number }> = [];
for (const [index, output] of outputs.entries()) {
  if (output !== expectedPaths[index]) throw new Error(`unexpected keyframe output path ${output}`);
  const info = await stat(output);
  if (!info.isFile() || info.size <= 0) throw new Error(`keyframe artifact ${index} was not materialized`);

  const probe = await probeMediaWithFfprobe(output) as {
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
  };
  const image = probe.streams?.find((stream) => stream.codec_type === 'video');
  if (!image || image.codec_name !== 'png' || image.width !== 640 || image.height !== 360) {
    throw new Error(`keyframe image output is invalid: ${JSON.stringify(image)}`);
  }
  artifactEvidence.push({
    sourcePts: index === 0 ? 0 : 45_000,
    byteSize: info.size,
    codec: image.codec_name,
    width: image.width,
    height: image.height,
  });
}

console.log(JSON.stringify({
  realFfmpegKeyframeExtraction: 'passed',
  sourceTimeBase: '1/90000',
  sourcePts: [0, 45_000],
  artifacts: artifactEvidence,
}));
