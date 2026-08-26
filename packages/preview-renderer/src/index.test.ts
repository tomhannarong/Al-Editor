import { describe, expect, it } from 'vitest';
import { buildCanonicalPreviewV2Arguments, CanonicalPreviewPlanError } from './index.js';
import type { CanonicalTimelineV2 } from '../../contracts/src/canonical-timeline.contract.js';
import { frameToSourcePts, sourcePtsToFrame } from '../../media-time/src/index.js';

const makeTimeline = (): CanonicalTimelineV2 => ({
  schemaVersion: '2.0',
  timelineId: 'timeline-1',
  revisionId: 'revision-1',
  projectId: 'project-1',
  frameRate: { numerator: 30000, denominator: 1001 },
  durationFrames: 90,
  items: [{
    kind: 'asset-video', itemId: 'clip-1', trackId: 'video-0', startFrame: 0, endFrame: 90,
    assetId: 'asset-1',
    source: { streamIndex: 0, sourceStartPts: 29010, sourceEndPts: 119100, sourceTimeBase: { numerator: 1, denominator: 30000 } },
    playbackRate: { numerator: 1, denominator: 1 },
  }],
  deliveryProfileVersion: 'delivery-v1',
  manifestSha256: 'a'.repeat(64),
  createdBy: 'test',
  createdAt: '2026-08-25T00:00:00Z',
});

const config = { width: 320, height: 180, crf: 18, preset: 'ultrafast' as const, backgroundColor: '#000000' };

describe('canonical v2 preview adapter', () => {
  it('maps canonical native PTS and rational FPS directly to FFmpeg argv while preserving timestamps', () => {
    const args = buildCanonicalPreviewV2Arguments({ timeline: makeTimeline(), verifiedAssetPaths: new Map([['asset-1', '/confined/source.mp4']]), outputPath: '/output/preview.mp4', config });
    const text = args.join(' ');
    expect(text).toContain('trim=start_pts=29010:end_pts=119100');
    expect(text).toContain('fps=30000/1001');
    expect(text).toContain('-r 30000/1001');
    expect(text).toContain('-frames:v 90');
    expect(text).not.toContain('trim=start=');
    expect(args).toContain('-copyts');
    expect(args.indexOf('-copyts')).toBeLessThan(args.indexOf('-i'));
  });

  it('goldens exact project-frame span to native source-PTS span at fractional FPS with a non-zero source origin', () => {
    const timeline = makeTimeline();
    const clip = timeline.items[0]!;
    if (clip.kind !== 'asset-video') throw new Error('fixture');

    const projectFrameSpan = clip.endFrame - clip.startFrame;
    const sourcePtsSpan = clip.source.sourceEndPts - clip.source.sourceStartPts;

    expect(projectFrameSpan).toBe(90);
    expect(sourcePtsSpan).toBe(90_090);
    expect(frameToSourcePts(projectFrameSpan, timeline.frameRate, clip.source.sourceTimeBase, 'nearest-half-away-from-zero')).toBe(sourcePtsSpan);
    expect(sourcePtsToFrame(sourcePtsSpan, clip.source.sourceTimeBase, timeline.frameRate, 'nearest-half-away-from-zero')).toBe(projectFrameSpan);

    const args = buildCanonicalPreviewV2Arguments({ timeline, verifiedAssetPaths: new Map([['asset-1', '/confined/source.mp4']]), outputPath: '/output/preview.mp4', config });
    expect(args.join(' ')).toContain(`trim=start_pts=${clip.source.sourceStartPts}:end_pts=${clip.source.sourceEndPts}`);
  });

  it('fails closed when a verified source path is absent', () => {
    expect(() => buildCanonicalPreviewV2Arguments({ timeline: makeTimeline(), verifiedAssetPaths: new Map(), outputPath: '/output/preview.mp4', config })).toThrow(CanonicalPreviewPlanError);
  });

  it('rejects a visual timeline with a gap', () => {
    const timeline = makeTimeline();
    const clip = timeline.items[0]!;
    if (clip.kind !== 'asset-video') throw new Error('fixture');
    clip.startFrame = 1;
    expect(() => buildCanonicalPreviewV2Arguments({ timeline, verifiedAssetPaths: new Map([['asset-1', '/confined/source.mp4']]), outputPath: '/output/preview.mp4', config })).toThrow(/not contiguous/);
  });
});
