import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const work = mkdtempSync(path.join(os.tmpdir(), 'ai-editor-p021-'));
const mediaRoot = path.join(work, 'media');
const outside = path.join(work, 'outside');
mkdirSync(mediaRoot);
mkdirSync(outside);
writeFileSync(path.join(outside, 'outside.txt'), 'outside');

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
};
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const resolveConfined = (rootPath, relativePath) => {
  if (path.isAbsolute(relativePath)) throw new Error('absolute media paths are forbidden');
  const rootReal = realpathSync(rootPath);
  const candidateReal = realpathSync(path.resolve(rootReal, relativePath));
  const relative = path.relative(rootReal, candidateReal);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) return candidateReal;
  throw new Error('resolved media path escapes media root');
};

try {
  run('ffmpeg', ['-version']);
  run('ffprobe', ['-version']);
  symlinkSync(path.join(outside, 'outside.txt'), path.join(mediaRoot, 'escape-link'));
  assert.throws(() => resolveConfined(mediaRoot, '../outside/outside.txt'));
  assert.throws(() => resolveConfined(mediaRoot, 'escape-link'));

  const compiled = path.join(work, 'compiled');
  run('tsc', [
    '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--outDir', compiled,
    path.join(root, 'packages/contracts/src/canonical-timeline.contract.ts'),
    path.join(root, 'packages/preview-renderer/src/index.ts'),
  ]);
  const renderer = await import(pathToFileURL(path.join(compiled, 'preview-renderer/src/index.js')).href);

  const source = path.join(mediaRoot, 'fixture.mp4');
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30000/1001:duration=4',
    '-vf', 'setpts=PTS+1/TB', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-an', '-y', source,
  ]);
  const sourceProbe = JSON.parse(run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=index,time_base,start_pts,r_frame_rate,nb_frames', '-of', 'json', source,
  ])).streams[0];
  const [tbNumerator, tbDenominator] = sourceProbe.time_base.split('/').map(Number);
  const [fpsNumerator, fpsDenominator] = sourceProbe.r_frame_rate.split('/').map(Number);
  const deltaNumerator = 90n * BigInt(fpsDenominator) * BigInt(tbDenominator);
  const deltaDenominator = BigInt(fpsNumerator) * BigInt(tbNumerator);
  assert.equal(deltaNumerator % deltaDenominator, 0n);
  const deltaPts = Number(deltaNumerator / deltaDenominator);
  const sourceSha256 = sha256(source);
  const manifestSha256 = createHash('sha256').update(JSON.stringify({
    sourceSha256, frameRate: [fpsNumerator, fpsDenominator], durationFrames: 90,
    startPts: sourceProbe.start_pts, endPts: sourceProbe.start_pts + deltaPts,
  })).digest('hex');

  const timeline = {
    schemaVersion: '2.0', timelineId: 'timeline-walk-1', revisionId: 'revision-walk-1', projectId: 'project-walk',
    frameRate: { numerator: fpsNumerator, denominator: fpsDenominator }, durationFrames: 90,
    items: [{
      kind: 'asset-video', itemId: 'clip-1', trackId: 'video-0', startFrame: 0, endFrame: 90, assetId: 'fixture-asset',
      source: { streamIndex: sourceProbe.index, sourceStartPts: sourceProbe.start_pts, sourceEndPts: sourceProbe.start_pts + deltaPts, sourceTimeBase: { numerator: tbNumerator, denominator: tbDenominator } },
      playbackRate: { numerator: 1, denominator: 1 },
    }],
    deliveryProfileVersion: 'delivery-fixture-v1', manifestSha256, createdBy: 'p0-21-fixture', createdAt: '2026-08-25T00:00:00Z',
  };

  const verifiedPath = resolveConfined(mediaRoot, 'fixture.mp4');
  const output = path.join(work, 'preview.mp4');
  const args = renderer.buildCanonicalPreviewV2Arguments({
    timeline, verifiedAssetPaths: new Map([['fixture-asset', verifiedPath]]), outputPath: output,
    config: { width: 320, height: 180, crf: 18, preset: 'ultrafast', backgroundColor: '#000000' },
  });
  const commandText = args.join(' ');
  assert.ok(commandText.includes(`trim=start_pts=${sourceProbe.start_pts}:end_pts=${sourceProbe.start_pts + deltaPts}`));
  assert.ok(!commandText.includes('trim=start='));
  run('ffmpeg', args);

  const outputProbe = JSON.parse(run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,duration', '-of', 'json', output,
  ])).streams[0];
  assert.equal(outputProbe.width, 320);
  assert.equal(outputProbe.height, 180);
  assert.equal(outputProbe.r_frame_rate, '30000/1001');
  assert.equal(outputProbe.avg_frame_rate, '30000/1001');
  assert.equal(outputProbe.nb_frames, '90');
  assert.equal(outputProbe.duration, '3.003000');

  console.log('PASS: canonical v2 real preview walking skeleton');
  console.log(JSON.stringify({
    adapterVersion: renderer.CANONICAL_PREVIEW_ADAPTER_VERSION,
    ffmpegVersion: run('ffmpeg', ['-version']).split('\n')[0],
    ffprobeVersion: run('ffprobe', ['-version']).split('\n')[0],
    revisionId: timeline.revisionId,
    manifestSha256,
    source: { sha256: sourceSha256, streamIndex: sourceProbe.index, startPts: sourceProbe.start_pts, endPts: sourceProbe.start_pts + deltaPts, timeBase: sourceProbe.time_base, frameRate: sourceProbe.r_frame_rate },
    output: { sha256: sha256(output), width: outputProbe.width, height: outputProbe.height, frameRate: outputProbe.r_frame_rate, frames: Number(outputProbe.nb_frames), durationSeconds: Number(outputProbe.duration) },
    confinement: { traversalRejected: true, escapingSymlinkRejected: true },
    shellFree: true,
  }, null, 2));
} finally {
  rmSync(work, { recursive: true, force: true });
}
