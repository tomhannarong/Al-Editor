import {
  INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
  type IndexedSceneDocument,
} from '../packages/contracts/src/indexed-scene-document.contract.js';
import {
  computeIndexedSceneVectorSha256,
  QdrantIndexedSceneInvariantError,
  QdrantIndexedSceneStore,
} from '../packages/indexed-scene-library/src/qdrant.js';

const qdrantUrl = process.env.QDRANT_URL ?? 'http://127.0.0.1:6333';
const collectionName = 'ai_editor_phase4_baseline_scenes_v1';
const assetId = `sha256:${'4'.repeat(64)}`;
const vector = [0.125, -0.25, 0.5, 1];

function document(): IndexedSceneDocument {
  return {
    schemaVersion: INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
    documentId: 'indexed-scene:runtime-scene-1',
    revisionId: 'indexed-scene-revision:runtime-v1',
    source: {
      sceneSetId: 'scene-set:runtime-phase4',
      sceneSetRevisionId: 'scene-set-revision:runtime-v1',
      sceneId: 'scene-runtime-1',
      assetId,
      streamId: `${assetId}:stream:0`,
      streamIndex: 0,
      sourceTimeBase: { numerator: 1, denominator: 90_000 },
      sourceStartPts: 90_000,
      sourceEndPts: 180_000,
    },
    representationRevisionId: 'scene-representation:runtime-v1',
    representationText: 'Traveler crossing a green rice field at sunrise.',
    embedding: {
      embeddingRevisionId: 'embedding-revision:runtime-v1',
      modelId: 'deterministic-runtime-fixture',
      modelVersion: '1.0.0',
      dimensions: vector.length,
      vectorSha256: computeIndexedSceneVectorSha256(vector),
    },
    createdAt: '2026-08-26T10:30:00.000Z',
  };
}

const store = new QdrantIndexedSceneStore({ baseUrl: qdrantUrl, collectionName });
const first = await store.upsertDocument(document(), vector);
if (!first.created) throw new Error('expected first real-Qdrant upsert to create point');

const equivalent = document();
equivalent.source.sourceTimeBase = { numerator: 2, denominator: 180_000 };
const second = await store.upsertDocument(equivalent, vector);
if (second.created) throw new Error('expected exact semantic re-upsert to be idempotent');
if (second.pointId !== first.pointId) throw new Error('idempotent upsert changed Qdrant point identity');

const readback = await store.getDocument(document().revisionId);
if (!readback) throw new Error('real-Qdrant readback missing indexed scene');
if (readback.document.source.sceneId !== 'scene-runtime-1') throw new Error('scene lineage changed in Qdrant payload');
if (readback.document.source.sourceTimeBase.numerator !== 1
  || readback.document.source.sourceTimeBase.denominator !== 90_000) {
  throw new Error('Qdrant payload did not preserve normalized rational source time base');
}
if (readback.document.embedding.vectorSha256 !== computeIndexedSceneVectorSha256(readback.vector)) {
  throw new Error('Qdrant vector bytes do not match immutable vector digest evidence');
}

let conflictRejected = false;
try {
  await store.upsertDocument(
    { ...document(), representationText: 'Conflicting text must not overwrite immutable revision.' },
    vector,
  );
} catch (error) {
  if (error instanceof QdrantIndexedSceneInvariantError) conflictRejected = true;
  else throw error;
}
if (!conflictRejected) throw new Error('expected conflicting immutable revision to fail closed');

const afterConflict = await store.getDocument(document().revisionId);
if (afterConflict?.document.representationText !== document().representationText) {
  throw new Error('conflicting real-Qdrant upsert mutated historical payload');
}

console.log(JSON.stringify({
  ok: true,
  qdrantUrl,
  collectionName,
  pointId: first.pointId,
  idempotentReuse: !second.created,
  sceneId: readback.document.source.sceneId,
  normalizedTimeBase: readback.document.source.sourceTimeBase,
  vectorSha256: readback.document.embedding.vectorSha256,
  conflictRejected,
}, null, 2));
