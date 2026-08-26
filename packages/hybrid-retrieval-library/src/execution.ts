import {
  HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS,
  validateHybridRetrievalPolicy,
  type HybridRetrievalPolicy,
  type HybridRetrievalRepresentationPolicy,
} from '../../contracts/src/hybrid-retrieval-policy.contract.js';
import {
  sameIndexedSceneSourceLineage,
  validateIndexedSceneDocument,
  type IndexedSceneDocument,
  type IndexedSceneSourceLineage,
} from '../../contracts/src/indexed-scene-document.contract.js';
import { computeIndexedSceneVectorSha256 } from '../../indexed-scene-library/src/qdrant.js';

export interface HybridRetrievalQueryRepresentation {
  representationId: string;
  representationRevisionId: string;
  embeddingRevisionId: string;
  modelId: string;
  modelVersion: string;
  vector: number[];
}

export interface HybridRetrievalCandidate {
  representationId: string;
  document: IndexedSceneDocument;
  vector: number[];
}

export interface ExecuteHybridRetrievalInput {
  policy: HybridRetrievalPolicy;
  topK: number;
  queryRepresentations: HybridRetrievalQueryRepresentation[];
  candidates: HybridRetrievalCandidate[];
}

export interface HybridRetrievalRepresentationScore {
  representationId: string;
  cosineScore: number;
  weightBasisPoints: number;
  weightedScore: number;
  documentRevisionId: string;
}

export interface HybridRetrievalResultItem {
  sceneKey: string;
  source: IndexedSceneSourceLineage;
  fusedScore: number;
  representationScores: HybridRetrievalRepresentationScore[];
}

export interface ExecuteHybridRetrievalResult {
  policyRevisionId: string;
  fusionMethod: HybridRetrievalPolicy['fusionMethod'];
  items: HybridRetrievalResultItem[];
}

export class HybridRetrievalExecutionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HybridRetrievalExecutionInvariantError';
  }
}

interface SceneAccumulator {
  sceneKey: string;
  source: IndexedSceneSourceLineage;
  representationScores: HybridRetrievalRepresentationScore[];
}

/**
 * Deterministic Phase-5 weighted-cosine execution boundary.
 *
 * This function consumes only evidence compatible with the exact immutable
 * policy revision. It does not perform reranking, duplicate control or
 * editorial scoring, and it does not mutate Qdrant/index state.
 */
export function executeHybridRetrieval(
  input: ExecuteHybridRetrievalInput,
): ExecuteHybridRetrievalResult {
  const policyValidation = validateHybridRetrievalPolicy(input.policy);
  if (!policyValidation.valid) {
    throw new HybridRetrievalExecutionInvariantError(
      `invalid hybrid retrieval policy: ${policyValidation.errors.join('; ')}`,
    );
  }
  if (!Number.isSafeInteger(input.topK) || input.topK < 1 || input.topK > input.policy.candidatePoolSize) {
    throw new HybridRetrievalExecutionInvariantError(
      `topK must be a safe integer between 1 and candidatePoolSize ${input.policy.candidatePoolSize}`,
    );
  }

  const policyRepresentations = new Map(
    input.policy.representations.map((representation) => [representation.representationId, representation]),
  );
  if (policyRepresentations.size !== input.policy.representations.length) {
    throw new HybridRetrievalExecutionInvariantError('policy representationId values must be unique');
  }

  const queryByRepresentation = validateQueries(input.queryRepresentations, policyRepresentations);
  const candidateCounts = new Map<string, number>();
  const seenCandidateKeys = new Set<string>();
  const scenes = new Map<string, SceneAccumulator>();

  for (const candidate of input.candidates) {
    const representation = policyRepresentations.get(candidate.representationId);
    if (!representation) {
      throw new HybridRetrievalExecutionInvariantError(
        `candidate references representationId ${candidate.representationId} not present in policy`,
      );
    }
    const count = (candidateCounts.get(candidate.representationId) ?? 0) + 1;
    if (count > input.policy.candidatePoolSize) {
      throw new HybridRetrievalExecutionInvariantError(
        `representation ${candidate.representationId} exceeds candidatePoolSize ${input.policy.candidatePoolSize}`,
      );
    }
    candidateCounts.set(candidate.representationId, count);

    validateCandidate(candidate, representation);
    const query = queryByRepresentation.get(candidate.representationId)!;
    validateSameVectorDimensions(query.vector, candidate.vector, candidate.representationId);

    const sceneKey = sourceSceneKey(candidate.document.source);
    const duplicateKey = `${candidate.representationId}\u0000${sceneKey}`;
    if (seenCandidateKeys.has(duplicateKey)) {
      throw new HybridRetrievalExecutionInvariantError(
        `duplicate candidate for representation ${candidate.representationId} and scene ${sceneKey}`,
      );
    }
    seenCandidateKeys.add(duplicateKey);

    const cosineScore = cosineSimilarity(query.vector, candidate.vector);
    const weightedScore = cosineScore
      * representation.weightBasisPoints
      / HYBRID_RETRIEVAL_WEIGHT_TOTAL_BASIS_POINTS;
    const score: HybridRetrievalRepresentationScore = {
      representationId: candidate.representationId,
      cosineScore,
      weightBasisPoints: representation.weightBasisPoints,
      weightedScore,
      documentRevisionId: candidate.document.revisionId,
    };

    const existing = scenes.get(sceneKey);
    if (existing) {
      if (!sameIndexedSceneSourceLineage(existing.source, candidate.document.source)) {
        throw new HybridRetrievalExecutionInvariantError(
          `scene ${sceneKey} has conflicting immutable source lineage across representations`,
        );
      }
      existing.representationScores.push(score);
    } else {
      scenes.set(sceneKey, {
        sceneKey,
        source: cloneSource(candidate.document.source),
        representationScores: [score],
      });
    }
  }

  for (const representation of input.policy.representations) {
    if ((candidateCounts.get(representation.representationId) ?? 0) === 0) {
      throw new HybridRetrievalExecutionInvariantError(
        `representation ${representation.representationId} has no candidates`,
      );
    }
  }

  const items = [...scenes.values()]
    .map((scene) => {
      const representationScores = [...scene.representationScores]
        .sort((left, right) => left.representationId.localeCompare(right.representationId));
      return {
        sceneKey: scene.sceneKey,
        source: cloneSource(scene.source),
        fusedScore: representationScores.reduce((sum, score) => sum + score.weightedScore, 0),
        representationScores,
      } satisfies HybridRetrievalResultItem;
    })
    .sort((left, right) => right.fusedScore - left.fusedScore || left.sceneKey.localeCompare(right.sceneKey))
    .slice(0, input.topK);

  return {
    policyRevisionId: input.policy.revisionId,
    fusionMethod: input.policy.fusionMethod,
    items,
  };
}

function validateQueries(
  queries: readonly HybridRetrievalQueryRepresentation[],
  policyRepresentations: ReadonlyMap<string, HybridRetrievalRepresentationPolicy>,
): Map<string, HybridRetrievalQueryRepresentation> {
  if (queries.length !== policyRepresentations.size) {
    throw new HybridRetrievalExecutionInvariantError(
      'queryRepresentations must contain exactly one query for every policy representation',
    );
  }

  const result = new Map<string, HybridRetrievalQueryRepresentation>();
  for (const query of queries) {
    if (result.has(query.representationId)) {
      throw new HybridRetrievalExecutionInvariantError(
        `duplicate query representationId ${query.representationId}`,
      );
    }
    const policyRepresentation = policyRepresentations.get(query.representationId);
    if (!policyRepresentation || !samePinnedRepresentation(query, policyRepresentation)) {
      throw new HybridRetrievalExecutionInvariantError(
        `query representation ${query.representationId} does not match pinned policy evidence`,
      );
    }
    validateVector(query.vector, `query representation ${query.representationId}`);
    result.set(query.representationId, { ...query, vector: [...query.vector] });
  }
  return result;
}

function validateCandidate(
  candidate: HybridRetrievalCandidate,
  policyRepresentation: HybridRetrievalRepresentationPolicy,
): void {
  const validation = validateIndexedSceneDocument(candidate.document);
  if (!validation.valid) {
    throw new HybridRetrievalExecutionInvariantError(
      `invalid indexed scene ${candidate.document.revisionId}: ${validation.errors.join('; ')}`,
    );
  }
  if (
    candidate.document.representationRevisionId !== policyRepresentation.representationRevisionId
    || candidate.document.embedding.embeddingRevisionId !== policyRepresentation.embeddingRevisionId
    || candidate.document.embedding.modelId !== policyRepresentation.modelId
    || candidate.document.embedding.modelVersion !== policyRepresentation.modelVersion
  ) {
    throw new HybridRetrievalExecutionInvariantError(
      `candidate ${candidate.document.revisionId} does not match pinned representation/model evidence for ${candidate.representationId}`,
    );
  }
  validateVector(candidate.vector, `candidate ${candidate.document.revisionId}`);
  if (candidate.vector.length !== candidate.document.embedding.dimensions) {
    throw new HybridRetrievalExecutionInvariantError(
      `candidate ${candidate.document.revisionId} vector dimensions do not match immutable embedding evidence`,
    );
  }
  if (computeIndexedSceneVectorSha256(candidate.vector) !== candidate.document.embedding.vectorSha256) {
    throw new HybridRetrievalExecutionInvariantError(
      `candidate ${candidate.document.revisionId} vector does not match immutable vectorSha256 evidence`,
    );
  }
}

function samePinnedRepresentation(
  query: HybridRetrievalQueryRepresentation,
  policy: HybridRetrievalRepresentationPolicy,
): boolean {
  return query.representationId === policy.representationId
    && query.representationRevisionId === policy.representationRevisionId
    && query.embeddingRevisionId === policy.embeddingRevisionId
    && query.modelId === policy.modelId
    && query.modelVersion === policy.modelVersion;
}

function validateSameVectorDimensions(
  queryVector: readonly number[],
  candidateVector: readonly number[],
  representationId: string,
): void {
  if (queryVector.length !== candidateVector.length) {
    throw new HybridRetrievalExecutionInvariantError(
      `query/candidate vector dimensions differ for representation ${representationId}`,
    );
  }
}

function validateVector(vector: readonly number[], label: string): void {
  if (vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
    throw new HybridRetrievalExecutionInvariantError(`${label} vector must contain finite numeric values`);
  }
  if (vector.every((value) => value === 0)) {
    throw new HybridRetrievalExecutionInvariantError(`${label} vector must have non-zero magnitude`);
  }
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;
    dot += leftValue * rightValue;
    leftSquares += leftValue * leftValue;
    rightSquares += rightValue * rightValue;
  }
  return dot / (Math.sqrt(leftSquares) * Math.sqrt(rightSquares));
}

function sourceSceneKey(source: IndexedSceneSourceLineage): string {
  return JSON.stringify([source.sceneSetId, source.sceneSetRevisionId, source.sceneId]);
}

function cloneSource(source: IndexedSceneSourceLineage): IndexedSceneSourceLineage {
  return {
    ...source,
    sourceTimeBase: { ...source.sourceTimeBase },
  };
}
