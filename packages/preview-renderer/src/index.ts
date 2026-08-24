import {
  normalizeCanonicalRational,
  validateCanonicalTimelineV2,
  type CanonicalTimelineAssetItemV2,
  type CanonicalTimelineV2,
} from '../../contracts/src/canonical-timeline.contract.js';

export const CANONICAL_PREVIEW_ADAPTER_VERSION = 'ffmpeg-canonical-v2-preview-v1' as const;

export class CanonicalPreviewPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalPreviewPlanError';
  }
}

export interface CanonicalPreviewRenderConfigV1 {
  width: number;
  height: number;
  crf: number;
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
  backgroundColor: string;
}

/**
 * Build a shell-free FFmpeg argv plan from canonical timeline v2.
 * Project placement remains integer frames + rational FPS. Source trims remain
 * absolute native PTS. `-copyts` is mandatory so demuxer timestamp rebasing
 * cannot silently change the native PTS domain before trim=start_pts/end_pts.
 * `verifiedAssetPaths` must contain already-confined, realpath-resolved paths;
 * path authority is deliberately outside this planner.
 */
export function buildCanonicalPreviewV2Arguments(input: {
  timeline: CanonicalTimelineV2;
  verifiedAssetPaths: ReadonlyMap<string, string>;
  outputPath: string;
  config: CanonicalPreviewRenderConfigV1;
}): string[] {
  const validation = validateCanonicalTimelineV2(input.timeline);
  if (!validation.valid) {
    throw new CanonicalPreviewPlanError(`invalid canonical timeline: ${validation.errors.join('; ')}`);
  }
  validateConfig(input.config);
  if (!input.outputPath.trim()) throw new CanonicalPreviewPlanError('outputPath is required');

  const frameRate = normalizeCanonicalRational(input.timeline.frameRate);
  const frameRateText = `${frameRate.numerator}/${frameRate.denominator}`;
  const visual = input.timeline.items
    .filter((item): item is CanonicalTimelineAssetItemV2 => item.kind === 'asset-video')
    .sort((left, right) => left.startFrame - right.startFrame || left.itemId.localeCompare(right.itemId));

  if (!visual.length) throw new CanonicalPreviewPlanError('timeline has no asset-video items');

  let expectedStart = 0;
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-copyts', '-y'];
  const filters: string[] = [];
  const labels: string[] = [];

  visual.forEach((clip, inputIndex) => {
    if (clip.startFrame !== expectedStart) {
      throw new CanonicalPreviewPlanError(`visual timeline is not contiguous at ${clip.itemId}`);
    }
    expectedStart = clip.endFrame;

    const verifiedPath = input.verifiedAssetPaths.get(clip.assetId);
    if (!verifiedPath?.trim()) {
      throw new CanonicalPreviewPlanError(`verified path missing for ${clip.assetId}`);
    }
    if (!Number.isSafeInteger(clip.source.streamIndex) || clip.source.streamIndex < 0) {
      throw new CanonicalPreviewPlanError(`invalid source stream index for ${clip.itemId}`);
    }

    const playbackRate = normalizeCanonicalRational(clip.playbackRate);
    const frameCount = clip.endFrame - clip.startFrame;
    args.push('-i', verifiedPath);
    filters.push(
      `[${inputIndex}:${clip.source.streamIndex}]trim=start_pts=${clip.source.sourceStartPts}:end_pts=${clip.source.sourceEndPts},` +
      `setpts=(PTS-STARTPTS)*${playbackRate.denominator}/${playbackRate.numerator},` +
      `fps=${frameRateText},` +
      `scale=${input.config.width}:${input.config.height}:force_original_aspect_ratio=decrease,` +
      `pad=${input.config.width}:${input.config.height}:(ow-iw)/2:(oh-ih)/2:${ffmpegColor(input.config.backgroundColor)},` +
      `setsar=1,trim=end_frame=${frameCount},setpts=PTS-STARTPTS,format=yuv420p[v${inputIndex}]`,
    );
    labels.push(`[v${inputIndex}]`);
  });

  if (expectedStart !== input.timeline.durationFrames) {
    throw new CanonicalPreviewPlanError('visual timeline does not cover durationFrames');
  }

  filters.push(`${labels.join('')}concat=n=${visual.length}:v=1:a=0[outv]`);
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[outv]',
    '-an',
    '-c:v', 'libx264',
    '-preset', input.config.preset,
    '-crf', String(input.config.crf),
    '-threads:v', '1',
    '-pix_fmt', 'yuv420p',
    '-r', frameRateText,
    '-frames:v', String(input.timeline.durationFrames),
    '-map_metadata', '-1',
    '-metadata', 'creation_time=1970-01-01T00:00:00Z',
    '-fflags', '+bitexact',
    '-flags:v', '+bitexact',
    '-movflags', '+faststart',
    input.outputPath,
  );
  return args;
}

function validateConfig(config: CanonicalPreviewRenderConfigV1): void {
  if (!Number.isSafeInteger(config.width) || config.width <= 0 || !Number.isSafeInteger(config.height) || config.height <= 0) {
    throw new CanonicalPreviewPlanError('preview width/height must be positive safe integers');
  }
  if (!Number.isSafeInteger(config.crf) || config.crf < 0 || config.crf > 51) {
    throw new CanonicalPreviewPlanError('preview crf must be an integer from 0 through 51');
  }
  ffmpegColor(config.backgroundColor);
}

function ffmpegColor(value: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new CanonicalPreviewPlanError('backgroundColor must be #RRGGBB');
  }
  return `0x${value.slice(1).toUpperCase()}`;
}
