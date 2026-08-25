import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, realpath, stat, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  validateKeyframeDerivativeRevision,
  type KeyframeDerivativeRevision,
} from '../../contracts/src/keyframe-derivative.contract.js';
import {
  runBoundedProcess,
  type ProcessExecutor,
} from '../../media-catalog/src/ffprobe.js';

const SUPPORTED_PROFILE = 'keyframe-png-v1';
const DEFAULT_MAX_FRAMES = 64;

export interface ExtractKeyframeOptions {
  ffmpegPath?: string;
  executor?: ProcessExecutor;
  timeoutMs?: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  maxFrames?: number;
}

export class KeyframeExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyframeExtractionError';
  }
}

/**
 * Extracts rebuildable keyframe images from a managed immutable original.
 *
 * Native sourcePts + source.timeBase remain the only source-time authority.
 * FFmpeg receives exact integer PTS selectors; image paths/bytes are derivative
 * state only. Caller-controlled IDs never become filesystem path segments.
 */
export async function extractKeyframeDerivativeFrames(
  revision: KeyframeDerivativeRevision,
  managedOriginalPath: string,
  managedRoot: string,
  derivativeRoot: string,
  options: ExtractKeyframeOptions = {},
): Promise<string[]> {
  const validation = validateKeyframeDerivativeRevision(revision);
  if (!validation.valid) throw new KeyframeExtractionError(validation.errors.join('; '));
  if (revision.derivativeProfileVersion !== SUPPORTED_PROFILE) {
    throw new KeyframeExtractionError(`unsupported keyframe derivative profile: ${revision.derivativeProfileVersion}`);
  }
  if (revision.toolchain.name !== 'ffmpeg') {
    throw new KeyframeExtractionError('keyframe derivative toolchain must be ffmpeg');
  }

  const maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;
  if (!Number.isSafeInteger(maxFrames) || maxFrames <= 0) {
    throw new KeyframeExtractionError('maxFrames must be a positive safe integer');
  }
  if (revision.frames.length > maxFrames) {
    throw new KeyframeExtractionError(`keyframe revision exceeds maxFrames ${maxFrames}`);
  }

  const requestedSource = resolve(managedOriginalPath);
  if ((await lstat(requestedSource)).isSymbolicLink()) {
    throw new KeyframeExtractionError('managed original source must not be a symbolic link');
  }
  const sourcePath = await realpath(requestedSource);
  const resolvedManagedRoot = await realpath(resolve(managedRoot));
  assertWithinRoot(resolvedManagedRoot, sourcePath, 'managed original source escapes managedRoot');
  if (!(await stat(sourcePath)).isFile()) {
    throw new KeyframeExtractionError('managed original source must resolve to a regular file');
  }

  await mkdir(resolve(derivativeRoot), { recursive: true });
  const resolvedDerivativeRoot = await realpath(resolve(derivativeRoot));
  const revisionDirectoryName = createHash('sha256').update(revision.revisionId).digest('hex');
  const requestedRevisionDirectory = resolve(resolvedDerivativeRoot, revisionDirectoryName);
  assertWithinRoot(resolvedDerivativeRoot, requestedRevisionDirectory, 'keyframe revision output escapes derivativeRoot');
  await mkdir(requestedRevisionDirectory, { recursive: true });
  const revisionDirectory = await realpath(requestedRevisionDirectory);
  assertWithinRoot(resolvedDerivativeRoot, revisionDirectory, 'keyframe revision output escapes derivativeRoot');

  const executor = options.executor ?? runBoundedProcess;
  const processOptions = {
    timeoutMs: options.timeoutMs ?? 30_000,
    maxStdoutBytes: options.maxStdoutBytes ?? 64 * 1024,
    maxStderrBytes: options.maxStderrBytes ?? 512 * 1024,
  };
  const outputs: string[] = [];

  for (const [index, frame] of revision.frames.entries()) {
    const outputPath = resolve(revisionDirectory, `${String(index).padStart(6, '0')}.png`);
    assertWithinRoot(revisionDirectory, outputPath, 'keyframe frame output escapes revision directory');
    const expectedArtifactUri = pathToFileURL(outputPath).href;
    if (frame.artifactUri !== expectedArtifactUri) {
      throw new KeyframeExtractionError(`frames[${index}].artifactUri must match the confined derivative output path`);
    }

    if (await pathExists(outputPath)) {
      throw new KeyframeExtractionError(`frames[${index}] output already exists; immutable revision artifacts are not overwritten`);
    }

    const tempPath = resolve(revisionDirectory, `.${String(index).padStart(6, '0')}.${randomUUID()}.png`);
    assertWithinRoot(revisionDirectory, tempPath, 'keyframe temporary output escapes revision directory');

    try {
      await executor(options.ffmpegPath ?? 'ffmpeg', [
        '-nostdin', '-hide_banner', '-loglevel', 'error', '-n',
        '-copyts',
        '-i', sourcePath,
        '-map', `0:${revision.source.streamIndex}`,
        '-vf', `select=eq(pts\\,${frame.sourcePts})`,
        '-frames:v', '1',
        '-fps_mode', 'passthrough',
        '-an',
        '-c:v', 'png',
        '-f', 'image2',
        '-update', '1',
        tempPath,
      ], processOptions);

      const artifact = await stat(tempPath).catch(() => undefined);
      if (!artifact?.isFile() || artifact.size <= 0) {
        throw new KeyframeExtractionError(`frames[${index}] exact sourcePts ${frame.sourcePts} produced no image artifact`);
      }

      try {
        await link(tempPath, outputPath);
      } catch (error) {
        if (isNodeErrorCode(error, 'EEXIST')) {
          throw new KeyframeExtractionError(`frames[${index}] output already exists; immutable revision artifacts are not overwritten`);
        }
        throw error;
      }
      outputs.push(outputPath);
    } finally {
      await unlink(tempPath).catch((error: unknown) => {
        if (!isNodeErrorCode(error, 'ENOENT')) throw error;
      });
    }
  }

  return outputs;
}

function assertWithinRoot(rootPath: string, candidatePath: string, message: string): void {
  const rel = relative(rootPath, candidatePath);
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) return;
  throw new KeyframeExtractionError(message);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return false;
    throw error;
  }
}

function isNodeErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === code;
}
