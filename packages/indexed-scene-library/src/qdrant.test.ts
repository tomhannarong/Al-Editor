import { describe, expect, it } from 'vitest';

import {
  INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
  type IndexedSceneDocument,
} from '../../contracts/src/indexed-scene-document.contract.js';
import {
  computeIndexedSceneVectorSha256,
  QdrantIndexedSceneInvariantError,
  QdrantIndexedSceneStore,
  qdrantPointIdForRevision,
} from './qdrant.js';

const ASSET_ID = `sha256:${'a'.repeat(64)}`;
const VECTOR = [0.125, -0.25, 0.5, 1] as const;

function validDocument(overrides: Partial<IndexedSceneDocument> = {}): IndexedSceneDocument {
  return {
    schemaVersion: INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
    documentId: 'indexed-scene:scene-1',
    revisionId: 'indexed-scene-revision:v1',
    source: {
      sceneSetId: 'scene-set:asset-a:stream-0',
      sceneSetRevisionId: 'scene-set-revision:v4',
      sceneId: 'scene-1',
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:0`,
      streamIndex: 0,
      sourceTimeBase: { numerator: 1, denominator: 90_000 },
      sourceStartPts: 90_000,
      sourceEndPts: 180_000,
    },
    representationRevisionId: 'scene-representation:v3',
    representationText: 'A woman walking through a green rice field.',
    embedding: {
      embeddingRevisionId: 'embedding-revision:v2',
      modelId: 'text-embedding-local',
      modelVersion: '1.2.0',
      dimensions: VECTOR.length,
      vectorSha256: computeIndexedSceneVectorSha256(VECTOR),
    },
    createdAt: '2026-08-26T09:20:00.000Z',
    ...overrides,
  };
}

function fakeQdrantFetch() {
  let collectionCreated = false;
  let point: { id: string; vector: number[]; payload: unknown } | undefined;
  let upserts = 0;

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const method = init?.method ?? 'GET';

    if (url.pathname === '/collections/baseline-scenes' && method === 'GET') {
      return collectionCreated
        ? Response.json({ result: { status: 'green' } })
        : new Response('missing', { status: 404 });
    }
    if (url.pathname === '/collections/baseline-scenes' && method === 'PUT') {
      collectionCreated = true;
      return Response.json({ result: true });
    }
    if (url.pathname.endsWith('/points') && method === 'PUT') {
      const body = JSON.parse(String(init?.body)) as {
        points: Array<{ id: string; vector: number[]; payload: unknown }>;
      };
      const next = body.points[0];
      if (!next) return new Response('missing point', { status: 400 });
      point = { id: next.id, vector: [...next.vector], payload: next.payload };
      upserts += 1;
      return Response.json({ result: { status: 'completed' } });
    }
    if (url.pathname.includes('/points/') && method === 'GET') {
      return point
        ? Response.json({ result: point })
        : new Response('missing', { status: 404 });
    }
    return new Response('unexpected request', { status: 500 });
  }) as typeof fetch;

  return { fetchImpl, getUpserts: () => upserts };
}

describe('Qdrant indexed-scene durability boundary', () => {
  it('creates the collection, upserts once, reads back exact evidence and stays idempotent', async () => {
    const fake = fakeQdrantFetch();
    const store = new QdrantIndexedSceneStore({
      baseUrl: 'http://qdrant.test',
      collectionName: 'baseline-scenes',
      fetchImpl: fake.fetchImpl,
    });

    const first = await store.upsertDocument(validDocument(), VECTOR);
    expect(first.created).toBe(true);
    expect(first.document.source.sourceTimeBase).toEqual({ numerator: 1, denominator: 90_000 });
    expect(first.vector).toEqual(VECTOR);

    const equivalent = validDocument();
    equivalent.source.sourceTimeBase = { numerator: 2, denominator: 180_000 };
    const second = await store.upsertDocument(equivalent, VECTOR);
    expect(second.created).toBe(false);
    expect(fake.getUpserts()).toBe(1);

    const readback = await store.getDocument(validDocument().revisionId);
    expect(readback?.document).toEqual(validDocument());
    expect(readback?.vector).toEqual(VECTOR);
  });

  it('fails closed before a Qdrant overwrite when immutable evidence conflicts', async () => {
    const fake = fakeQdrantFetch();
    const store = new QdrantIndexedSceneStore({
      baseUrl: 'http://qdrant.test',
      collectionName: 'baseline-scenes',
      fetchImpl: fake.fetchImpl,
    });
    await store.upsertDocument(validDocument(), VECTOR);

    await expect(store.upsertDocument(
      validDocument({ representationText: 'Conflicting representation.' }),
      VECTOR,
    )).rejects.toThrow(QdrantIndexedSceneInvariantError);
    expect(fake.getUpserts()).toBe(1);
    expect((await store.getDocument(validDocument().revisionId))?.document.representationText)
      .toBe('A woman walking through a green rice field.');
  });

  it('rejects vector dimension and digest mismatches before durable index mutation', async () => {
    const fake = fakeQdrantFetch();
    const store = new QdrantIndexedSceneStore({
      baseUrl: 'http://qdrant.test',
      collectionName: 'baseline-scenes',
      fetchImpl: fake.fetchImpl,
    });

    await expect(store.upsertDocument(validDocument(), [1, 2]))
      .rejects.toThrow(/dimensions/);

    const wrongDigest = validDocument();
    wrongDigest.embedding = { ...wrongDigest.embedding, vectorSha256: 'f'.repeat(64) };
    await expect(store.upsertDocument(wrongDigest, VECTOR))
      .rejects.toThrow(/SHA-256/);
    expect(fake.getUpserts()).toBe(0);
  });

  it('derives stable Qdrant UUID-shaped point IDs from immutable revision IDs', () => {
    const first = qdrantPointIdForRevision('indexed-scene-revision:v1');
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    expect(qdrantPointIdForRevision('indexed-scene-revision:v1')).toBe(first);
    expect(qdrantPointIdForRevision('indexed-scene-revision:v2')).not.toBe(first);
  });
});
