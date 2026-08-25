import { describe, expect, it } from 'vitest';

import {
  PROXY_DERIVATIVE_SCHEMA_VERSION,
  type ProxyDerivativeRevision,
} from '../../contracts/src/proxy-derivative.contract.js';
import {
  InMemoryProxyDerivativeRevisionStore,
  ProxyDerivativePersistenceInvariantError,
  sameImmutableProxyDerivativeRevision,
} from './index.js';

const ASSET_ID = `sha256:${'c'.repeat(64)}`;

function validRevision(overrides: Partial<ProxyDerivativeRevision> = {}): ProxyDerivativeRevision {
  return {
    schemaVersion: PROXY_DERIVATIVE_SCHEMA_VERSION,
    derivativeId: 'proxy:scene-set:asset-c:stream-0',
    revisionId: 'proxy-revision:v1',
    source: {
      sceneSetId: 'scene-set:asset-c:stream-0',
      sceneSetRevisionId: 'scene-set-revision:v3',
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:0`,
      streamIndex: 0,
      timeBase: { numerator: 1, denominator: 90_000 },
    },
    derivativeProfileVersion: 'proxy-profile/1.0.0',
    toolchain: { name: 'ffmpeg', version: '6.1.1' },
    artifactUri: 'file:///derived/proxies/proxy-v1.mp4',
    createdAt: '2026-08-25T15:00:00.000Z',
    ...overrides,
  };
}

describe('proxy derivative revision persistence', () => {
  it('registers immutable derivative evidence and returns defensive copies', () => {
    const store = new InMemoryProxyDerivativeRevisionStore();
    const candidate = validRevision();

    const first = store.registerRevision(candidate);
    expect(first.created).toBe(true);
    expect(first.revision.source.timeBase).toEqual({ numerator: 1, denominator: 90_000 });

    first.revision.source.streamId = 'mutated';
    first.revision.toolchain.version = 'mutated';

    expect(store.getRevision(candidate.revisionId)).toEqual(validRevision());
  });

  it('treats semantic re-registration with an equivalent rational time base as idempotent', () => {
    const store = new InMemoryProxyDerivativeRevisionStore();
    expect(store.registerRevision(validRevision()).created).toBe(true);

    const equivalent = validRevision();
    equivalent.source.timeBase = { numerator: 2, denominator: 180_000 };

    const result = store.registerRevision(equivalent);
    expect(result.created).toBe(false);
    expect(result.revision.source.timeBase).toEqual({ numerator: 1, denominator: 90_000 });
  });

  it('fails closed when revisionId is reused with changed immutable source evidence', () => {
    const store = new InMemoryProxyDerivativeRevisionStore();
    store.registerRevision(validRevision());

    const conflict = validRevision();
    conflict.source = { ...conflict.source, sceneSetRevisionId: 'scene-set-revision:v4' };

    expect(() => store.registerRevision(conflict)).toThrow(ProxyDerivativePersistenceInvariantError);
    expect(store.getRevision('proxy-revision:v1')?.source.sceneSetRevisionId).toBe('scene-set-revision:v3');
  });

  it('keeps rebuild state immutable within a revision and requires a new revision for a rebuilt artifact', () => {
    const store = new InMemoryProxyDerivativeRevisionStore();
    store.registerRevision(validRevision());

    expect(() => store.registerRevision(validRevision({
      artifactUri: 'file:///derived/proxies/rebuilt.mp4',
    }))).toThrow(ProxyDerivativePersistenceInvariantError);

    const rebuilt = validRevision({
      revisionId: 'proxy-revision:v2',
      artifactUri: 'file:///derived/proxies/rebuilt.mp4',
      createdAt: '2026-08-25T15:05:00.000Z',
    });
    expect(store.registerRevision(rebuilt).created).toBe(true);
    expect(store.getRevision('proxy-revision:v1')?.artifactUri).toBe('file:///derived/proxies/proxy-v1.mp4');
    expect(store.getRevision('proxy-revision:v2')?.artifactUri).toBe('file:///derived/proxies/rebuilt.mp4');
  });

  it('rejects invalid evidence before persistence and compares complete immutable revision semantics', () => {
    const store = new InMemoryProxyDerivativeRevisionStore();
    const invalid = validRevision({ derivativeProfileVersion: '' });

    expect(() => store.registerRevision(invalid)).toThrow(ProxyDerivativePersistenceInvariantError);
    expect(store.getRevision(invalid.revisionId)).toBeUndefined();

    const left = validRevision();
    const right = validRevision();
    right.toolchain = { ...right.toolchain, version: '7.0.0' };
    expect(sameImmutableProxyDerivativeRevision(left, right)).toBe(false);
  });
});
