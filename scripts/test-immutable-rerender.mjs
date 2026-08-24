import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const work = mkdtempSync(path.join(os.tmpdir(), 'ai-editor-p022-'));
const mediaRoot = path.join(work, 'media');
mkdirSync(mediaRoot);
const run = (command, args) => { const result = spawnSync(command, args, { encoding: 'utf8' }); if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`); return result.stdout; };
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const probe = (file) => JSON.parse(run('ffprobe', ['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,duration','-of','json',file])).streams[0];

try {
  run('ffmpeg', ['-version']); run('ffprobe', ['-version']);
  const compiled = path.join(work, 'compiled');
  run('tsc', ['--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','--outDir',compiled,
    path.join(root,'packages/contracts/src/canonical-timeline.contract.ts'), path.join(root,'packages/preview-renderer/src/index.ts'), path.join(root,'packages/timeline-revision/src/index.ts')]);
  const renderer = await import(pathToFileURL(path.join(compiled,'preview-renderer/src/index.js')).href);
  const revisions = await import(pathToFileURL(path.join(compiled,'timeline-revision/src/index.js')).href);

  const source = path.join(mediaRoot, 'fixture.mp4');
  run('ffmpeg', ['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30000/1001:duration=4','-vf','setpts=PTS+1/TB','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-an','-y',source]);
  const sourceInfo = JSON.parse(run('ffprobe', ['-v','error','-select_streams','v:0','-show_entries','stream=index,time_base,start_pts,r_frame_rate','-of','json',source])).streams[0];
  const [tbNum,tbDen] = sourceInfo.time_base.split('/').map(Number); const [fpsNum,fpsDen] = sourceInfo.r_frame_rate.split('/').map(Number);
  const framePts = Number(BigInt(fpsDen) * BigInt(tbDen) / (BigInt(fpsNum) * BigInt(tbNum)));
  const spanPts = framePts * 90; const start1 = sourceInfo.start_pts; const end1 = start1 + spanPts;
  const sourceHash = sha256(source);
  const manifest1 = createHash('sha256').update(JSON.stringify({sourceHash,start1,end1,revision:'revision-walk-1'})).digest('hex');
  const parent = { schemaVersion:'2.0',timelineId:'timeline-walk-1',revisionId:'revision-walk-1',projectId:'project-walk',frameRate:{numerator:fpsNum,denominator:fpsDen},durationFrames:90,items:[{kind:'asset-video',itemId:'clip-1',trackId:'video-0',startFrame:0,endFrame:90,assetId:'fixture-asset',source:{streamIndex:sourceInfo.index,sourceStartPts:start1,sourceEndPts:end1,sourceTimeBase:{numerator:tbNum,denominator:tbDen}},playbackRate:{numerator:1,denominator:1}}],deliveryProfileVersion:'delivery-fixture-v1',manifestSha256:manifest1,createdBy:'p0-22-fixture',createdAt:'2026-08-25T00:00:00Z' };
  const parentSnapshot = JSON.stringify(parent);
  const verifiedPath = realpathSync(source); const verifiedPaths = new Map([['fixture-asset',verifiedPath]]); const config = {width:320,height:180,crf:18,preset:'ultrafast',backgroundColor:'#000000'};

  const r1Path = path.join(work,'revision-1.mp4'); run('ffmpeg', renderer.buildCanonicalPreviewV2Arguments({timeline:parent,verifiedAssetPaths:verifiedPaths,outputPath:r1Path,config}));
  const r1HashBefore = sha256(r1Path); const r1BytesBefore = readFileSync(r1Path); const r1Probe = probe(r1Path);

  const shiftPts = framePts * 15; const manifest2 = createHash('sha256').update(JSON.stringify({parent:manifest1,start:start1+shiftPts,end:end1+shiftPts,revision:'revision-walk-2'})).digest('hex');
  const child = revisions.createShiftedSourceRevisionV2(parent,{itemId:'clip-1',sourceStartPts:start1+shiftPts,sourceEndPts:end1+shiftPts},{revisionId:'revision-walk-2',manifestSha256:manifest2,createdBy:'p0-22-fixture',createdAt:'2026-08-25T00:00:01Z'});
  assert.equal(JSON.stringify(parent), parentSnapshot); assert.equal(child.parentRevisionId,parent.revisionId); assert.notEqual(child.revisionId,parent.revisionId); assert.notEqual(child.manifestSha256,parent.manifestSha256); assert.ok(Object.isFrozen(child));

  const r2Path = path.join(work,'revision-2.mp4'); run('ffmpeg', renderer.buildCanonicalPreviewV2Arguments({timeline:child,verifiedAssetPaths:verifiedPaths,outputPath:r2Path,config}));
  const r2Hash = sha256(r2Path); const r2Probe = probe(r2Path);
  assert.equal(sha256(r1Path),r1HashBefore); assert.deepEqual(readFileSync(r1Path),r1BytesBefore); assert.notEqual(r2Hash,r1HashBefore);
  for (const result of [r1Probe,r2Probe]) { assert.equal(result.width,320); assert.equal(result.height,180); assert.equal(result.r_frame_rate,'30000/1001'); assert.equal(result.avg_frame_rate,'30000/1001'); assert.equal(result.nb_frames,'90'); assert.equal(result.duration,'3.003000'); }

  console.log('PASS: immutable canonical v2 edit -> distinct rerender');
  console.log(JSON.stringify({adapterVersion:renderer.CANONICAL_PREVIEW_ADAPTER_VERSION,revisionEditorVersion:revisions.CANONICAL_SOURCE_WINDOW_EDITOR_VERSION,sourceSha256:sourceHash,r1:{revisionId:parent.revisionId,manifestSha256:parent.manifestSha256,startPts:start1,endPts:end1,sha256:r1HashBefore,frames:Number(r1Probe.nb_frames),durationSeconds:Number(r1Probe.duration)},r2:{revisionId:child.revisionId,parentRevisionId:child.parentRevisionId,manifestSha256:child.manifestSha256,startPts:start1+shiftPts,endPts:end1+shiftPts,sha256:r2Hash,frames:Number(r2Probe.nb_frames),durationSeconds:Number(r2Probe.duration)},r1UnchangedAfterR2:true,outputsDistinct:r1HashBefore!==r2Hash,frameRate:r1Probe.r_frame_rate},null,2));
} finally { rmSync(work,{recursive:true,force:true}); }
