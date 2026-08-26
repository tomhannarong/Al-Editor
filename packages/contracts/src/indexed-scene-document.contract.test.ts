import { describe, expect, it } from 'vitest';

import {
  INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
  sameIndexedSceneSourceLineage,
  validateIndexedSceneDocument,
  type IndexedSceneDocument,
} from './indexed-scene-document.contract.js';

const ASSET_ID = `sha256:${'a'.repeat(64)}`;
const VECTOR_SHA256 = 'b'.repeat(64);

function validDocument(): IndexedSceneDocument {
  return {
    schemaVersion: INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION,
    documentId: 'indexed-scene:scene-0001',
    revisionId: 'indexed-scene-revision:v1',
    source: {
      sceneSetId: 'scene-set:asset-a:stream-0',
      sceneSetRevisionId: 'scene-set-revision:v1',
      sceneId: 'scene-0001',
      assetId: ASSET_ID,
      streamId: `${ASSET_ID}:stream:0`,
      streamIndex: 0,
      sourceTimeBase: { numerator: 1, denominator: 90_000 },
      sourceStartPts: 90_000,
      sourceEndPts: 180_000,
    },
    representationRevisionId: 'scene-representation:v1',
    representationText: 'green mountain road beneath low clouds',
    embedding: {
      embeddingRevisionId: 'scene-embedding:v1',
      modelId: 'embedding:text-scene',
      modelVersion: '2026-08-01',
      dimensions: 768,
      vectorSha256: VECTOR_SHA256,
    },
    createdAt: '2026-08-26T08:30:00.000Z',
  };
}

describe('indexed scene document contract', () => {
  it('accepts a versioned document bound to exact scene/source lineage and pinned embedding evidence', () => {
    expect(validateIndexedSceneDocument(validDocument())).toEqual({ valid: true, errors: [] });
  });

  it('rejects mutable source identity and non-canonical timing fields through the fixed contract shape', () => {
    const document = validDocument();
    document.source.assetId = '/mutable/path/camera.mov';
    document.source.streamIndex = -1;
    document.source.sourceStartPts = 12.5;
    document.source.sourceEndPts = 12;
    document.source.sourceTimeBase = { numerator: 0, denominator: 1 };

    const result = validateIndexedSceneDocument(document);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('canonical sha256 asset identity');
    expect(result.errors.join('\n')).toContain('streamIndex must be a non-negative safe integer');
    expect(result.errors.join('\n')).toContain('sourceStartPts must be a safe integer');
    expect(result.errors.join('\n')).toContain('sourceTimeBase');
  });

  it('rejects unpinned embedding model metadata, invalid dimensions and invalid vector digest', () => {
    const document = validDocument();
    document.embedding.modelVersion = 'latest';
    document.embedding.dimensions = 0;
    document.embedding.vectorSha256 = 'not-a-digest';

    const result = validateIndexedSceneDocument(document);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('embedding.modelVersion must be pinned and non-mutable');
    expect(result.errors).toContain('embedding.dimensions must be a safe integer between 1 and 65536');
    expect(result.errors).toContain('embedding.vectorSha256 must be a lowercase SHA-256 hex digest');
  });

  it('rejects missing immutable revision evidence and empty representation text', () => {
    const document = validDocument();
    document.revisionId = '';
    document.representationRevisionId = '';
    document.representationText = '   ';
    document.embedding.embeddingRevisionId = '';

    const result = validateIndexedSceneDocument(document);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('revisionId is required');
    expect(result.errors).toContain('representationRevisionId is required');
    expect(result.errors).toContain('representationText is required');
    expect(result.errors).toContain('embedding.embeddingRevisionId is required');
  });

  it('compares exact scene/source identity after rational normalization', () => {
    const source = validDocument().source;
    expect(sameIndexedSceneSourceLineage(source, {
      ...source,
      sourceTimeBase: { numerator: 2, denominator: 180_000 },
    })).toBe(true);
    expect(sameIndexedSceneSourceLineage(source, {
      ...source,
      sceneId: 'scene-0002',
    })).toBe(false);
    expect(sameIndexedSceneSourceLineage(source, {
      ...source,
      sourceStartPts: source.sourceStartPts + 1,
    })).toBe(false);
  });
});
