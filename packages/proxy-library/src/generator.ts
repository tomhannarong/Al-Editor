import { mkdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateProxyDerivativeRevision, type ProxyDerivativeRevision } from '../../contracts/src/proxy-derivative.contract.js';
import { runBoundedProcess, type ProcessExecutor } from '../../media-catalog/src/ffprobe.js';

export interface GenerateProxyOptions {
  ffmpegPath?: string;
  executor?: ProcessExecutor;
  timeoutMs?: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
}

export class ProxyGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyGenerationError';
  }
}

export async function generateProxyDerivative(
  revision: ProxyDerivativeRevision,
  managedOriginalPath: string,
  derivativeRoot: string,
  options: GenerateProxyOptions = {},
): Promise<string> {
  const validation = validateProxyDerivativeRevision(revision);
  if (!validation.valid) throw new ProxyGenerationError(validation.errors.join('; '));
  if (revision.derivativeProfileVersion !== 'proxy-h264-720p-v1') {
    throw new ProxyGenerationError('unsupported proxy derivative profile');
  }

  const sourcePath = await realpath(resolve(managedOriginalPath));
  const rootPath = resolve(derivativeRoot);
  await mkdir(rootPath, { recursive: true });
  const resolvedRoot = await realpath(rootPath);
  const outputPath = resolve(resolvedRoot, `${revision.revisionId}.mp4`);
  assertWithinRoot(resolvedRoot, outputPath);
  if (sourcePath === outputPath) throw new ProxyGenerationError('proxy output must not overwrite managed original');

  const expectedArtifactUri = pathToFileURL(outputPath).href;
  if (revision.artifactUri !== expectedArtifactUri) {
    throw new ProxyGenerationError('artifactUri must match the confined derivative output path');
  }

  const executor = options.executor ?? runBoundedProcess;
  await executor(options.ffmpegPath ?? 'ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    '-i', sourcePath,
    '-map', `0:${revision.source.streamIndex}`,
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
    '-an',
    outputPath,
  ], {
    timeoutMs: options.timeoutMs ?? 120_000,
    maxStdoutBytes: options.maxStdoutBytes ?? 64 * 1024,
    maxStderrBytes: options.maxStderrBytes ?? 1024 * 1024,
  });

  return outputPath;
}

function assertWithinRoot(rootPath: string, candidatePath: string): void {
  const rel = relative(rootPath, candidatePath);
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) return;
  throw new ProxyGenerationError('proxy output escapes derivativeRoot');
}
