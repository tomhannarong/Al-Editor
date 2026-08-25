import { describe, expect, it } from 'vitest';

import {
  PROXY_DERIVATIVE_SCHEMA_VERSION,
  sameProxyDerivativeSource,
  validateProxyDerivativeRevision,
  type ProxyDerivativeRevision,
} from './proxy-derivative.contract.js';

const ASSET_ID = `sha256:${'b'.repeat(64)}`;

function validProxy(): ProxyDerivativeRevision {
  return {
    schemaVersion: PROXY_DERIVATIVE_SCHEMA_VERSION,
    derivativeId: 'proxy:scene-set:asset-b:stream-0',
    revisionId: 'proxy-revision:v1',
    source: {
      sceneSetId: 'scene-set:asset-b:stream-0',
      sceneSetRevisionId: 'scene-set-revision:v3',
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:0`,
      streamIndex: 0,
      timeBase: { numerator: 1, denominator: 90_000 },
    },
    derivativeProfileVersion: 'proxy-profile/1.0.0',
    toolchain: { name: 'ffmpeg', version: '6.1.1' },
    artifactUri: 'file:///derived/proxies/proxy.mp4',
    createdAt: '2026-08-25T14:00:00.000Z',
  };
}

describe('proxy derivative contract', () => {
  it('accepts a rebuildable versioned proxy bound to immutable scene/source authority', () => {
    expect(validateProxyDerivativeRevision(validProxy())).toEqual({ valid: true, errors: [] });
  });

  it('requires explicit derivative profile and pinned toolchain versions', () => {
    const derivative = validProxy();
    derivative.derivativeProfileVersion = '';
    derivative.toolchain = { name: '', version: '' };

    const result = validateProxyDerivativeRevision(derivative);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('derivativeProfileVersion is required');
    expect(result.errors).toContain('toolchain.name is required');
    expect(result.errors).toContain('toolchain.version is required');
  });

  it('rejects mutable-path identity and invalid stream/rational source mapping', () => {
    const derivative = validProxy();
    derivative.source = {
      ...derivative.source,
      assetId: '/camera/DCIM/clip.mov',
      streamId: '',
      streamIndex: -1,
      timeBase: { numerator: 0, denominator: 1 },
    };

    const result = validateProxyDerivativeRevision(derivative);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('canonical sha256 asset identity');
    expect(result.errors.join('\n')).toContain('source.streamId is required');
    expect(result.errors.join('\n')).toContain('source.streamIndex must be a non-negative safe integer');
    expect(result.errors.join('\n')).toContain('invalid source.timeBase');
  });

  it('compares source authority independently from derivative location/profile/toolchain state', () => {
    const source = validProxy().source;
    expect(sameProxyDerivativeSource(source, {
      ...source,
      timeBase: { numerator: 2, denominator: 180_000 },
    })).toBe(true);
    expect(sameProxyDerivativeSource(source, {
      ...source,
      sceneSetRevisionId: 'scene-set-revision:v4',
    })).toBe(false);
  });

  it('requires scene-set revision lineage and an artifact location without treating that URI as source identity', () => {
    const derivative = validProxy();
    derivative.source.sceneSetRevisionId = '';
    derivative.artifactUri = '';

    const result = validateProxyDerivativeRevision(derivative);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('source.sceneSetRevisionId is required');
    expect(result.errors).toContain('artifactUri is required');
  });
});
