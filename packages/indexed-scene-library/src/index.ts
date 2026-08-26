import {
  normalizeCanonicalRational,
} from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateIndexedSceneDocument,
  type IndexedSceneDocument,
} from '../../contracts/src/indexed-scene-document.contract.js';

export class IndexedSceneDocumentPersistenceInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IndexedSceneDocumentPersistenceInvariantError';
  }
}

export interface RegisterIndexedSceneDocumentResult {
  document: IndexedSceneDocument;
  created: boolean;
}

/**
 * Immutable metadata boundary for Phase-4 indexed-scene evidence.
 *
 * revisionId is immutable evidence identity. Re-registering the same semantic
 * document is idempotent; reusing that revisionId with changed scene/source,
 * representation, embedding/model, vector-digest or creation evidence fails
 * closed. Vector bytes and Qdrant locations remain rebuildable index state and
 * intentionally do not belong to this store.
 */
export interface IndexedSceneDocumentPersistence {
  registerDocument(candidate: IndexedSceneDocument): RegisterIndexedSceneDocumentResult;
  getDocument(revisionId: string): IndexedSceneDocument | undefined;
}

export class InMemoryIndexedSceneDocumentStore implements IndexedSceneDocumentPersistence {
  readonly #documents = new Map<string, IndexedSceneDocument>();

  registerDocument(candidate: IndexedSceneDocument): RegisterIndexedSceneDocumentResult {
    assertValidDocument(candidate);
    const normalizedCandidate = cloneNormalizedDocument(candidate);
    const existing = this.#documents.get(candidate.revisionId);

    if (existing) {
      if (!sameImmutableIndexedSceneDocument(existing, normalizedCandidate)) {
        throw new IndexedSceneDocumentPersistenceInvariantError(
          `indexed scene revisionId ${candidate.revisionId} conflicts with existing immutable document`,
        );
      }
      return { document: cloneNormalizedDocument(existing), created: false };
    }

    this.#documents.set(normalizedCandidate.revisionId, normalizedCandidate);
    return { document: cloneNormalizedDocument(normalizedCandidate), created: true };
  }

  getDocument(revisionId: string): IndexedSceneDocument | undefined {
    const stored = this.#documents.get(revisionId);
    return stored ? cloneNormalizedDocument(stored) : undefined;
  }
}

export function sameImmutableIndexedSceneDocument(
  left: IndexedSceneDocument,
  right: IndexedSceneDocument,
): boolean {
  const leftTimeBase = normalizeTimeBaseOrUndefined(left);
  const rightTimeBase = normalizeTimeBaseOrUndefined(right);
  if (!leftTimeBase || !rightTimeBase) return false;

  return left.schemaVersion === right.schemaVersion
    && left.documentId === right.documentId
    && left.revisionId === right.revisionId
    && left.source.sceneSetId === right.source.sceneSetId
    && left.source.sceneSetRevisionId === right.source.sceneSetRevisionId
    && left.source.sceneId === right.source.sceneId
    && left.source.assetId === right.source.assetId
    && left.source.streamId === right.source.streamId
    && left.source.streamIndex === right.source.streamIndex
    && leftTimeBase.numerator === rightTimeBase.numerator
    && leftTimeBase.denominator === rightTimeBase.denominator
    && left.source.sourceStartPts === right.source.sourceStartPts
    && left.source.sourceEndPts === right.source.sourceEndPts
    && left.representationRevisionId === right.representationRevisionId
    && left.representationText === right.representationText
    && left.embedding.embeddingRevisionId === right.embedding.embeddingRevisionId
    && left.embedding.modelId === right.embedding.modelId
    && left.embedding.modelVersion === right.embedding.modelVersion
    && left.embedding.dimensions === right.embedding.dimensions
    && left.embedding.vectorSha256 === right.embedding.vectorSha256
    && left.createdAt === right.createdAt;
}

function assertValidDocument(candidate: IndexedSceneDocument): void {
  const validation = validateIndexedSceneDocument(candidate);
  if (!validation.valid) {
    throw new IndexedSceneDocumentPersistenceInvariantError(validation.errors.join('; '));
  }
}

function normalizeTimeBaseOrUndefined(document: IndexedSceneDocument) {
  try {
    return normalizeCanonicalRational(document.source.sourceTimeBase);
  } catch {
    return undefined;
  }
}

function cloneNormalizedDocument(document: IndexedSceneDocument): IndexedSceneDocument {
  const sourceTimeBase = normalizeCanonicalRational(document.source.sourceTimeBase);
  return {
    ...document,
    source: {
      ...document.source,
      sourceTimeBase: { ...sourceTimeBase },
    },
    embedding: { ...document.embedding },
  };
}
