import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { generateProxyDerivative } from '../packages/proxy-library/src/generator.ts';
import { runBoundedProcess, probeMediaWithFfprobe } from '../packages/media-catalog/src/ffprobe.ts';
import { PROXY_DERIVATIVE_SCHEMA_VERSION } from '../packages/contracts/src/proxy-derivative.contract.ts';

const root = await mkdtemp(join(tmpdir(), 'ai-editor-proxy-runtime-'));
const managedOriginal = join(root, 'managed-original.mp4');
const derivativeRoot = join(root, 'derivatives');
const revisionId = 'proxy-runtime-rev-1';
const outputPath = join(derivativeRoot, `${revisionId}.mp4`);

await runBoundedProcess('ffmpeg', [
  '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=30',
  '-t', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', managedOriginal,
], { timeoutMs: 60000, maxStdoutBytes: 65536, maxStderrBytes: 1048576 });

const output = await generateProxyDerivative({
  schemaVersion: PROXY_DERIVATIVE_SCHEMA_VERSION,
  derivativeId: 'proxy-runtime-1', revisionId,
  source: {
    sceneSetId: 'scene-set-runtime', sceneSetRevisionId: 'scene-rev-runtime',
    assetId: `sha256:${'b'.repeat(64)}`, streamId: 'video-0', streamIndex: 0,
    timeBase: { numerator: 1, denominator: 15360 },
  },
  derivativeProfileVersion: 'proxy-h264-720p-v1',
  toolchain: { name: 'ffmpeg', version: 'runtime' },
  artifactUri: pathToFileURL(outputPath).href,
  createdAt: '2026-08-25T00:00:00.000Z',
}, managedOriginal, derivativeRoot);

const info = await stat(output);
if (!info.isFile() || info.size <= 0) throw new Error('proxy artifact was not materialized');
const probe = await probeMediaWithFfprobe(output) as { streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }> };
const video = probe.streams?.find((stream) => stream.codec_type === 'video');
if (!video || video.codec_name !== 'h264' || !video.width || !video.height || video.width > 1280 || video.height > 720) {
  throw new Error(`proxy video output is invalid: ${JSON.stringify(video)}`);
}
console.log(JSON.stringify({ realFfmpegProxyGeneration: 'passed', codec: video.codec_name, width: video.width, height: video.height, byteSize: info.size }));
