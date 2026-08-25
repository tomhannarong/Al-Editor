import { spawn } from 'node:child_process';

import {
  ingestFfprobeStreamMetadata,
  type MediaCatalogPersistence,
} from './index.js';
import type { NativeMediaStreamMetadata } from '../../contracts/src/media-catalog.contract.js';

export interface BoundedProcessOptions {
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
}

export interface BoundedProcessResult {
  stdout: string;
  stderr: string;
}

export type ProcessExecutor = (
  command: string,
  args: readonly string[],
  options: BoundedProcessOptions,
) => Promise<BoundedProcessResult>;

export interface FfprobeExecutionOptions extends Partial<BoundedProcessOptions> {
  ffprobePath?: string;
  executor?: ProcessExecutor;
}

const DEFAULT_PROCESS_OPTIONS: BoundedProcessOptions = {
  timeoutMs: 15_000,
  maxStdoutBytes: 8 * 1024 * 1024,
  maxStderrBytes: 256 * 1024,
};

export class MediaProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaProcessError';
  }
}

export async function runBoundedProcess(
  command: string,
  args: readonly string[],
  options: BoundedProcessOptions,
): Promise<BoundedProcessResult> {
  if (!command.trim()) throw new MediaProcessError('media process command is required');
  validatePositiveSafeInteger(options.timeoutMs, 'timeoutMs');
  validatePositiveSafeInteger(options.maxStdoutBytes, 'maxStdoutBytes');
  validatePositiveSafeInteger(options.maxStderrBytes, 'maxStderrBytes');

  return await new Promise<BoundedProcessResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let terminalError: MediaProcessError | undefined;
    let settled = false;

    const failAndKill = (error: MediaProcessError): void => {
      if (terminalError) return;
      terminalError = error;
      child.kill('SIGKILL');
    };

    child.stdout.on('data', (chunk: Buffer | Uint8Array | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stdoutBytes += buffer.byteLength;
      if (!Number.isSafeInteger(stdoutBytes) || stdoutBytes > options.maxStdoutBytes) {
        failAndKill(new MediaProcessError(`media process stdout exceeded ${options.maxStdoutBytes} bytes`));
        return;
      }
      stdoutChunks.push(buffer);
    });

    child.stderr.on('data', (chunk: Buffer | Uint8Array | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stderrBytes += buffer.byteLength;
      if (!Number.isSafeInteger(stderrBytes) || stderrBytes > options.maxStderrBytes) {
        failAndKill(new MediaProcessError(`media process stderr exceeded ${options.maxStderrBytes} bytes`));
        return;
      }
      stderrChunks.push(buffer);
    });

    const timer = setTimeout(() => {
      failAndKill(new MediaProcessError(`media process timed out after ${options.timeoutMs}ms`));
    }, options.timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(new MediaProcessError(`failed to start media process: ${error.message}`));
    });

    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (terminalError) {
        reject(terminalError);
        return;
      }

      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (code !== 0) {
        const termination = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`;
        const detail = stderr.trim();
        reject(new MediaProcessError(`media process failed with ${termination}${detail ? `: ${detail}` : ''}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

export async function probeMediaWithFfprobe(
  mediaPath: string,
  options: FfprobeExecutionOptions = {},
): Promise<unknown> {
  if (!mediaPath.trim()) throw new MediaProcessError('media path is required');

  const processOptions: BoundedProcessOptions = {
    timeoutMs: options.timeoutMs ?? DEFAULT_PROCESS_OPTIONS.timeoutMs,
    maxStdoutBytes: options.maxStdoutBytes ?? DEFAULT_PROCESS_OPTIONS.maxStdoutBytes,
    maxStderrBytes: options.maxStderrBytes ?? DEFAULT_PROCESS_OPTIONS.maxStderrBytes,
  };
  const executor = options.executor ?? runBoundedProcess;
  const ffprobePath = options.ffprobePath ?? 'ffprobe';
  const args = [
    '-v', 'error',
    '-show_streams',
    '-of', 'json',
    '-i', mediaPath,
  ] as const;

  const result = await executor(ffprobePath, args, processOptions);
  const payload = result.stdout.trim();
  if (!payload) throw new MediaProcessError('ffprobe produced empty stdout');

  try {
    return JSON.parse(payload) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new MediaProcessError(`ffprobe stdout was not valid JSON: ${detail}`);
  }
}

export async function probeAndIngestFfprobeStreamMetadata(
  assetId: string,
  mediaPath: string,
  persistence: MediaCatalogPersistence,
  options: FfprobeExecutionOptions = {},
): Promise<NativeMediaStreamMetadata[]> {
  const ffprobe = await probeMediaWithFfprobe(mediaPath, options);
  return ingestFfprobeStreamMetadata(assetId, ffprobe, persistence);
}

function validatePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new MediaProcessError(`${label} must be a positive safe integer`);
  }
}
