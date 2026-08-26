import { normalizeCanonicalRational, type CanonicalRational } from './canonical-timeline.contract.js';

export const INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION = '1.0' as const;

export interface IndexedSceneSourceLineage {
  sceneSetId: string;
  sceneSetRevisionId: string;
  sceneId: string;
  assetId: string;
  streamId: string;
  streamIndex: number;
  sourceTimeBase: CanonicalRational;
  sourceStartPts: number;
  sourceEndPts: number;
}

export interface IndexedSceneEmbeddingEvidence {
  embeddingRevisionId: string;
  modelId: string;
  modelVersion: string;
  dimensions: number;
  vectorSha256: string;
}

/**
 * Phase-4 baseline indexed-scene document. It binds retrievable representation
 * evidence to one exact immutable scene revision/source interval. The vector
 * itself is storage/index state; this contract records the pinned embedding
 * provenance needed to reproduce and audit that state.
 *
 * Hybrid features, reranker scores and editorial judgment intentionally do not
 * belong here and are reserved for later phases.
 */
export interface IndexedSceneDocument {
  schemaVersion: typeof INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION;
  documentId: string;
  revisionId: string;
  source: IndexedSceneSourceLineage;
  representationRevisionId: string;
  representationText: string;
  embedding: IndexedSceneEmbeddingEvidence;
  createdAt: string;
}

export interface IndexedSceneDocumentValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_ASSET_ID = /^sha256:[a-f0-9]{64}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const MUTABLE_VERSION_ALIASES = new Set(['latest', 'main', 'master', 'stable', 'default', 'current']);
const MAX_REPRESENTATION_TEXT_LENGTH = 16_384;
const MAX_EMBEDDING_DIMENSIONS = 65_536;

function pinnedVersion(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_VERSION_ALIASES.has(normalized);
}

function normalizedSourceIdentity(source: IndexedSceneSourceLineage): string {
  const timeBase = normalizeCanonicalRational(source.sourceTimeBase);
  return [
    source.sceneSetId,
    source.sceneSetRevisionId,
    source.sceneId,
    source.assetId,
    source.streamId,
    String(source.streamIndex),
    `${timeBase.numerator}/${timeBase.denominator}`,
    String(source.sourceStartPts),
    String(source.sourceEndPts),
  ].join('|');
}

export function validateIndexedSceneDocument(
  document: IndexedSceneDocument,
): IndexedSceneDocumentValidationResult {
  const errors: string[] = [];

  if (document.schemaVersion !== INDEXED_SCENE_DOCUMENT_SCHEMA_VERSION) {
    errors.push('unsupported indexed scene document schemaVersion');
  }
  if (!document.documentId.trim()) errors.push('documentId is required');
  if (!document.revisionId.trim()) errors.push('revisionId is required');
  if (!document.representationRevisionId.trim()) errors.push('representationRevisionId is required');
  if (!document.representationText.trim()) errors.push('representationText is required');
  if (document.representationText.length > MAX_REPRESENTATION_TEXT_LENGTH) {
    errors.push(`representationText must be at most ${MAX_REPRESENTATION_TEXT_LENGTH} characters`);
  }
  if (Number.isNaN(Date.parse(document.createdAt))) {
    errors.push('createdAt must be an ISO-compatible timestamp');
  }

  const source = document.source;
  if (!source.sceneSetId.trim()) errors.push('source.sceneSetId is required');
  if (!source.sceneSetRevisionId.trim()) errors.push('source.sceneSetRevisionId is required');
  if (!source.sceneId.trim()) errors.push('source.sceneId is required');
  if (!SHA256_ASSET_ID.test(source.assetId)) {
    errors.push('source.assetId must be a canonical sha256 asset identity');
  }
  if (!source.streamId.trim()) errors.push('source.streamId is required');
  if (!Number.isSafeInteger(source.streamIndex) || source.streamIndex < 0) {
    errors.push('source.streamIndex must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(source.sourceStartPts)) {
    errors.push('source.sourceStartPts must be a safe integer');
  }
  if (!Number.isSafeInteger(source.sourceEndPts)) {
    errors.push('source.sourceEndPts must be a safe integer');
  }
  if (Number.isSafeInteger(source.sourceStartPts)
    && Number.isSafeInteger(source.sourceEndPts)
    && source.sourceEndPts <= source.sourceStartPts) {
    errors.push('source.sourceEndPts must be greater than source.sourceStartPts');
  }
  try {
    normalizeCanonicalRational(source.sourceTimeBase);
  } catch (error) {
    errors.push(`invalid source.sourceTimeBase: ${String(error)}`);
  }

  const embedding = document.embedding;
  if (!embedding.embeddingRevisionId.trim()) errors.push('embedding.embeddingRevisionId is required');
  if (!embedding.modelId.trim()) errors.push('embedding.modelId is required');
  if (!pinnedVersion(embedding.modelVersion)) {
    errors.push('embedding.modelVersion must be pinned and non-mutable');
  }
  if (!Number.isSafeInteger(embedding.dimensions)
    || embedding.dimensions < 1
    || embedding.dimensions > MAX_EMBEDDING_DIMENSIONS) {
    errors.push(`embedding.dimensions must be a safe integer between 1 and ${MAX_EMBEDDING_DIMENSIONS}`);
  }
  if (!SHA256_HEX.test(embedding.vectorSha256)) {
    errors.push('embedding.vectorSha256 must be a lowercase SHA-256 hex digest');
  }

  return { valid: errors.length === 0, errors };
}

/** Exact scene/source identity after rational normalization; storage location is absent. */
export function sameIndexedSceneSourceLineage(
  left: IndexedSceneSourceLineage,
  right: IndexedSceneSourceLineage,
): boolean {
  try {
    return normalizedSourceIdentity(left) === normalizedSourceIdentity(right);
  } catch {
    return false;
  }
}
