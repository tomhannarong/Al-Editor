import { describe, expect, it } from 'vitest';

import { MEDIA_ASSET_IDENTITY_SCHEMA_VERSION, SHA256_ALGORITHM } from '../../contracts/src/media-catalog.contract.js';
import { InMemoryMediaCatalog } from './index.js';
import {
  MediaProcessError,
  probeAndIngestFfprobeStreamMetadata,
  probeMediaWithFfprobe,
  runBoundedProcess,
  type ProcessExecutor,
} from './ffprobe.js';

const NODE_PROCESS_OPTIONS = {
  timeoutMs: 2_000,
  maxStdoutBytes: 1_024,
  maxStderrBytes: 1_024,
};

describe('runBoundedProcess', () => {
  it('executes direct argv without a shell and captures bounded output', async () => {
    const result = await runBoundedProcess(
      process.execPath,
      ['-e', 'process.stdout.write(process.argv[1])', 'literal;$(echo-not-a-shell)'],
      NODE_PROCESS_OPTIONS,
    );

    expect(result.stdout).toBe('literal;$(echo-not-a-shell)');
    expect(result.stderr).toBe('');
  });

  it('fails closed when stdout exceeds the configured cap', async () => {
    await expect(runBoundedProcess(
      process.execPath,
      ['-e', 'process.stdout.write("x".repeat(2048))'],
      { ...NODE_PROCESS_OPTIONS, maxStdoutBytes: 128 },
    )).rejects.toThrow('stdout exceeded 128 bytes');
  });

  it('kills a process that exceeds the configured timeout', async () => {
    await expect(runBoundedProcess(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 10000)'],
      { ...NODE_PROCESS_OPTIONS, timeoutMs: 50 },
    )).rejects.toThrow('timed out after 50ms');
  });

  it('surfaces bounded stderr for a non-zero exit', async () => {
    await expect(runBoundedProcess(
      process.execPath,
      ['-e', 'process.stderr.write("probe failed"); process.exit(7)'],
      NODE_PROCESS_OPTIONS,
    )).rejects.toThrow('exit code 7: probe failed');
  });
});

describe('probeMediaWithFfprobe', () => {
  it('uses a fixed ffprobe argv contract and passes the media path as an argument', async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const executor: ProcessExecutor = async (command, args) => {
      calls.push({ command, args: [...args] });
      return { stdout: '{"streams":[]}', stderr: '' };
    };

    await expect(probeMediaWithFfprobe('-dangerous-looking-local-name.mp4', {
      ffprobePath: '/opt/bin/ffprobe',
      executor,
    })).resolves.toEqual({ streams: [] });

    expect(calls).toEqual([{
      command: '/opt/bin/ffprobe',
      args: ['-v', 'error', '-show_streams', '-of', 'json', '-i', '-dangerous-looking-local-name.mp4'],
    }]);
  });

  it('rejects empty or malformed JSON output before normalization side effects', async () => {
    const emptyExecutor: ProcessExecutor = async () => ({ stdout: '   ', stderr: '' });
    const malformedExecutor: ProcessExecutor = async () => ({ stdout: '{nope}', stderr: '' });

    await expect(probeMediaWithFfprobe('/media/a.mov', { executor: emptyExecutor }))
      .rejects.toThrow('ffprobe produced empty stdout');
    await expect(probeMediaWithFfprobe('/media/a.mov', { executor: malformedExecutor }))
      .rejects.toThrow('ffprobe stdout was not valid JSON');
  });
});

describe('probeAndIngestFfprobeStreamMetadata', () => {
  it('hands strict JSON to the existing native-PTS normalizer and ignores decimal seconds', async () => {
    const catalog = new InMemoryMediaCatalog();
    const assetId = `sha256:${'a'.repeat(64)}`;
    catalog.registerAsset({
      schemaVersion: MEDIA_ASSET_IDENTITY_SCHEMA_VERSION,
      assetId,
      contentDigest: { algorithm: SHA256_ALGORITHM, hex: 'a'.repeat(64) },
      byteSize: 123,
      firstIngestedAt: '2026-08-25T00:00:00.000Z',
    });

    const executor: ProcessExecutor = async () => ({
      stdout: JSON.stringify({
        streams: [{
          index: 0,
          codec_type: 'video',
          codec_name: 'h264',
          time_base: '1/90000',
          start_pts: '9000',
          duration_ts: '180000',
          start_time: '0.100000',
          duration: '2.000000',
          width: 1920,
          height: 1080,
        }],
      }),
      stderr: '',
    });

    const streams = await probeAndIngestFfprobeStreamMetadata(
      assetId,
      '/managed/original',
      catalog,
      { executor },
    );

    expect(streams).toEqual([expect.objectContaining({
      streamIndex: 0,
      startPts: 9000,
      durationPts: 180000,
      timeBase: { numerator: 1, denominator: 90000 },
    })]);
    expect(catalog.getStreamMetadata(assetId)).toEqual(streams);
    expect(streams[0]).not.toHaveProperty('start_time');
    expect(streams[0]).not.toHaveProperty('duration');
  });

  it('does not persist malformed native timing', async () => {
    const catalog = new InMemoryMediaCatalog();
    const assetId = `sha256:${'b'.repeat(64)}`;
    catalog.registerAsset({
      schemaVersion: MEDIA_ASSET_IDENTITY_SCHEMA_VERSION,
      assetId,
      contentDigest: { algorithm: SHA256_ALGORITHM, hex: 'b'.repeat(64) },
      byteSize: 321,
      firstIngestedAt: '2026-08-25T00:00:00.000Z',
    });

    const executor: ProcessExecutor = async () => ({
      stdout: JSON.stringify({ streams: [{ index: 0, time_base: '0/0', start_pts: 1, duration_ts: 2 }] }),
      stderr: '',
    });

    await expect(probeAndIngestFfprobeStreamMetadata(assetId, '/managed/original', catalog, { executor }))
      .rejects.toThrow();
    expect(catalog.getStreamMetadata(assetId)).toEqual([]);
  });

  it('validates process bounds before spawning', async () => {
    await expect(runBoundedProcess(process.execPath, ['-e', ''], {
      timeoutMs: 0,
      maxStdoutBytes: 1,
      maxStderrBytes: 1,
    })).rejects.toBeInstanceOf(MediaProcessError);
  });
});
