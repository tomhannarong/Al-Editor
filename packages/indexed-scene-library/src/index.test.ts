import { describe, expect, it } from 'vitest';

import {
  INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
  type IndexedSceneDocument,
} from '../../contracts/src/indexed-scene-document.contract.js';
import {
  IndexedSceneDocumentPersistenceInvariantError,
  InMemoryIndexedSceneDocumentStore,
  sameImmutableIndexedSceneDocument,
} from './index.js';

const ASSET_ID = `sha256:${'a'.repeat(64)}`;
const VECTOR_SHA256 = 'b'.repeat(64);

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
      dimensions: 768,
      vectorSha256: VECTOR_SHA256,
    },
    createdAt: '2026-08-26T09:20:00.000Z',
    ...overrides,
  };
}

describe('indexed scene document persistence', () => {
  it('registers immutable evidence and returns deep defensive copies', () => {
    const store = new InMemoryIndexedSceneDocumentStore();
    const candidate = validDocument();

    const first = store.registerDocument(candidate);
    expect(first.created).toBe(true);
    expect(first.document.source.sourceTimeBase).toEqual({ numerator: 1, denominator: 90_000 });

    first.document.source.sceneId = 'mutated';
    first.document.source.sourceTimeBase.numerator = 7;
    first.document.embedding.modelVersion = 'mutated';

    expect(store.getDocument(candidate.revisionId)).toEqual(validDocument());
  });

  it('treats semantic re-registration with an equivalent rational time base as idempotent', () => {
    const store = new InMemoryIndexedSceneDocumentStore();
    expect(store.registerDocument(validDocument()).created).toBe(true);

    const equivalent = validDocument();
    equivalent.source.sourceTimeBase = { numerator: 2, denominator: 180_000 };

    const result = store.registerDocument(equivalent);
    expect(result.created).toBe(false);
    expect(result.document.source.sourceTimeBase).toEqual({ numerator: 1, denominator: 90_000 });
  });

  it('fails closed when revisionId is reused with changed scene/source evidence', () => {
    const store = new InMemoryIndexedSceneDocumentStore();
    store.registerDocument(validDocument());

    const changedScene = validDocument();
    changedScene.source = { ...changedScene.source, sceneId: 'scene-2' };
    expect(() => store.registerDocument(changedScene))
      .toThrow(IndexedSceneDocumentPersistenceInvariantError);

    const changedPts = validDocument();
    changedPts.source = { ...changedPts.source, sourceEndPts: 270_000 };
    expect(() => store.registerDocument(changedPts))
      .toThrow(IndexedSceneDocumentPersistenceInvariantError);

    expect(store.getDocument('indexed-scene-revision:v1')?.source.sceneId).toBe('scene-1');
  });

  it('fails closed when representation or embedding evidence changes under the same revisionId', () => {
    const store = new InMemoryIndexedSceneDocumentStore();
    store.registerDocument(validDocument());

    const changedText = validDocument({ representationText: 'Different semantic evidence.' });
    expect(() => store.registerDocument(changedText))
      .toThrow(IndexedSceneDocumentPersistenceInvariantError);

    const changedEmbedding = validDocument();
    changedEmbedding.embedding = {
      ...changedEmbedding.embedding,
      embeddingRevisionId: 'embedding-revision:v3',
    };
    expect(() => store.registerDocument(changedEmbedding))
      .toThrow(IndexedSceneDocumentPersistenceInvariantError);

    const changedDigest = validDocument();
    changedDigest.embedding = {
      ...changedDigest.embedding,
      vectorSha256: 'c'.repeat(64),
    };
    expect(() => store.registerDocument(changedDigest))
      .toThrow(IndexedSceneDocumentPersistenceInvariantError);

    expect(store.getDocument('indexed-scene-revision:v1')).toEqual(validDocument());
  });

  it('requires a new revision for changed representation/embedding evidence and preserves history', () => {
    const store = new InMemoryIndexedSceneDocumentStore();
    store.registerDocument(validDocument());

    const next = validDocument({
      revisionId: 'indexed-scene-revision:v2',
      representationRevisionId: 'scene-representation:v4',
      representationText: 'A traveler walking through a green rice field at sunrise.',
      embedding: {
        embeddingRevisionId: 'embedding-revision:v3',
        modelId: 'text-embedding-local',
        modelVersion: '1.3.0',
        dimensions: 768,
        vectorSha256: 'd'.repeat(64),
      },
      createdAt: '2026-08-26T09:25:00.000Z',
    });

    expect(store.registerDocument(next).created).toBe(true);
    expect(store.getDocument('indexed-scene-revision:v1')?.representationRevisionId)
      .toBe('scene-representation:v3');
    expect(store.getDocument('indexed-scene-revision:v2')?.representationRevisionId)
      .toBe('scene-representation:v4');
  });

  it('rejects invalid evidence before persistence and compares complete immutable semantics', () => {
    const store = new InMemoryIndexedSceneDocumentStore();
    const invalid = validDocument({ representationText: '' });

    expect(() => store.registerDocument(invalid))
      .toThrow(IndexedSceneDocumentPersistenceInvariantError);
    expect(store.getDocument(invalid.revisionId)).toBeUndefined();

    const left = validDocument();
    const right = validDocument();
    right.embedding = { ...right.embedding, modelVersion: '2.0.0' };
    expect(sameImmutableIndexedSceneDocument(left, right)).toBe(false);
  });
});
