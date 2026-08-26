import { createHash } from 'node:crypto';

import { normalizeCanonicalRational } from '../../contracts/src/canonical-timeline.contract.js';
import {
  validateIndexedSceneDocument,
  type IndexedSceneDocument,
} from '../../contracts/src/indexed-scene-document.contract.js';
import { sameImmutableIndexedSceneDocument } from './index.js';

export class QdrantIndexedSceneInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QdrantIndexedSceneInvariantError';
  }
}

export interface QdrantIndexedSceneStoreOptions {
  baseUrl: string;
  collectionName: string;
  fetchImpl?: typeof fetch;
}

export interface QdrantIndexedSceneRecord {
  document: IndexedSceneDocument;
  vector: number[];
}

export interface UpsertQdrantIndexedSceneResult extends QdrantIndexedSceneRecord {
  created: boolean;
  pointId: string;
}

interface QdrantPointResult {
  id?: unknown;
  vector?: unknown;
  payload?: unknown;
}

const UUID_HEX_LENGTH = 32;

export function computeIndexedSceneVectorSha256(vector: readonly number[]): string {
  assertFiniteVector(vector);
  return createHash('sha256').update(JSON.stringify(vector), 'utf8').digest('hex');
}

export function qdrantPointIdForRevision(revisionId: string): string {
  if (!revisionId.trim()) {
    throw new QdrantIndexedSceneInvariantError('revisionId is required for Qdrant point identity');
  }
  const hex = createHash('sha256').update(revisionId, 'utf8').digest('hex').slice(0, UUID_HEX_LENGTH);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Rebuildable Qdrant boundary; immutable evidence remains owned by the metadata store. */
export class QdrantIndexedSceneStore {
  readonly #baseUrl: string;
  readonly #collectionName: string;
  readonly #fetch: typeof fetch;

  constructor(options: QdrantIndexedSceneStoreOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.#collectionName = options.collectionName.trim();
    this.#fetch = options.fetchImpl ?? fetch;
    if (!this.#baseUrl) throw new QdrantIndexedSceneInvariantError('baseUrl is required');
    if (!this.#collectionName) throw new QdrantIndexedSceneInvariantError('collectionName is required');
  }

  async upsertDocument(candidate: IndexedSceneDocument, vector: readonly number[]): Promise<UpsertQdrantIndexedSceneResult> {
    const document = normalizeAndValidateDocument(candidate);
    validateVectorAgainstDocument(document, vector);
    await this.#ensureCollection(document.embedding.dimensions);

    const pointId = qdrantPointIdForRevision(document.revisionId);
    const existing = await this.#readPoint(pointId);
    if (existing) {
      if (!sameImmutableIndexedSceneDocument(existing.document, document)) {
        throw new QdrantIndexedSceneInvariantError(
          `Qdrant point for revisionId ${document.revisionId} conflicts with immutable indexed-scene evidence`,
        );
      }
      validateVectorAgainstDocument(existing.document, existing.vector);
      return { ...cloneRecord(existing), created: false, pointId };
    }

    const response = await this.#fetch(`${this.#collectionUrl()}/points?wait=true`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ points: [{ id: pointId, vector: [...vector], payload: { document } }] }),
    });
    await assertOk(response, 'Qdrant point upsert failed');

    const readback = await this.#readPoint(pointId);
    if (!readback) throw new QdrantIndexedSceneInvariantError('Qdrant upsert completed without readable point evidence');
    if (!sameImmutableIndexedSceneDocument(readback.document, document)) {
      throw new QdrantIndexedSceneInvariantError('Qdrant readback does not match immutable indexed-scene evidence');
    }
    validateVectorAgainstDocument(readback.document, readback.vector);
    return { ...cloneRecord(readback), created: true, pointId };
  }

  async getDocument(revisionId: string): Promise<QdrantIndexedSceneRecord | undefined> {
    const point = await this.#readPoint(qdrantPointIdForRevision(revisionId));
    return point ? cloneRecord(point) : undefined;
  }

  async #ensureCollection(dimensions: number): Promise<void> {
    const response = await this.#fetch(this.#collectionUrl());
    if (response.ok) return;
    if (response.status !== 404) await assertOk(response, 'Qdrant collection lookup failed');

    const createResponse = await this.#fetch(this.#collectionUrl(), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vectors: { size: dimensions, distance: 'Cosine' } }),
    });
    await assertOk(createResponse, 'Qdrant collection creation failed');
  }

  async #readPoint(pointId: string): Promise<QdrantIndexedSceneRecord | undefined> {
    const response = await this.#fetch(`${this.#collectionUrl()}/points`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [pointId], with_payload: true, with_vector: true }),
    });
    await assertOk(response, 'Qdrant point retrieve failed');

    const envelope = await response.json() as { result?: QdrantPointResult[] | null };
    const point = envelope.result?.[0];
    if (!point) return undefined;
    const document = extractDocument(point.payload);
    const vector = extractVector(point.vector);
    validateVectorAgainstDocument(document, vector);
    return { document, vector };
  }

  #collectionUrl(): string {
    return `${this.#baseUrl}/collections/${encodeURIComponent(this.#collectionName)}`;
  }
}

function normalizeAndValidateDocument(candidate: IndexedSceneDocument): IndexedSceneDocument {
  const validation = validateIndexedSceneDocument(candidate);
  if (!validation.valid) throw new QdrantIndexedSceneInvariantError(validation.errors.join('; '));
  const sourceTimeBase = normalizeCanonicalRational(candidate.source.sourceTimeBase);
  return {
    ...candidate,
    source: { ...candidate.source, sourceTimeBase: { ...sourceTimeBase } },
    embedding: { ...candidate.embedding },
  };
}

function validateVectorAgainstDocument(document: IndexedSceneDocument, vector: readonly number[]): void {
  assertFiniteVector(vector);
  if (vector.length !== document.embedding.dimensions) {
    throw new QdrantIndexedSceneInvariantError(
      `vector dimensions ${vector.length} do not match immutable evidence ${document.embedding.dimensions}`,
    );
  }
  if (computeIndexedSceneVectorSha256(vector) !== document.embedding.vectorSha256) {
    throw new QdrantIndexedSceneInvariantError('vector SHA-256 does not match immutable embedding evidence');
  }
}

function assertFiniteVector(vector: readonly number[]): void {
  if (vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
    throw new QdrantIndexedSceneInvariantError('vector must contain only finite numeric values');
  }
}

function extractDocument(payload: unknown): IndexedSceneDocument {
  if (!payload || typeof payload !== 'object' || !('document' in payload)) {
    throw new QdrantIndexedSceneInvariantError('Qdrant payload is missing indexed-scene document evidence');
  }
  return normalizeAndValidateDocument((payload as { document: IndexedSceneDocument }).document);
}

function extractVector(vector: unknown): number[] {
  if (!Array.isArray(vector) || vector.some((value) => typeof value !== 'number')) {
    throw new QdrantIndexedSceneInvariantError('Qdrant point is missing a numeric vector');
  }
  const values = vector as number[];
  assertFiniteVector(values);
  return [...values];
}

function cloneRecord(record: QdrantIndexedSceneRecord): QdrantIndexedSceneRecord {
  return { document: normalizeAndValidateDocument(record.document), vector: [...record.vector] };
}

async function assertOk(response: Response, message: string): Promise<void> {
  if (response.ok) return;
  const detail = await response.text();
  throw new QdrantIndexedSceneInvariantError(`${message}: HTTP ${response.status}${detail ? ` ${detail}` : ''}`);
}
