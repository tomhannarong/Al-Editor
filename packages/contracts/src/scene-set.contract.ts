import { normalizeCanonicalRational, type CanonicalRational } from './canonical-timeline.contract.js';

export const SCENE_SET_SCHEMA_VERSION = '1.0' as const;

export interface SceneSourceMapping {
  assetId: string;
  streamId: string;
  streamIndex: number;
  timeBase: CanonicalRational;
}

export interface SceneInterval {
  sceneId: string;
  sourceStartPts: number;
  sourceEndPts: number;
}

/**
 * Immutable scene-set revision for one source stream. Proxies/keyframes are
 * downstream derivatives and therefore deliberately absent from this contract.
 */
export interface SceneSetRevision {
  schemaVersion: typeof SCENE_SET_SCHEMA_VERSION;
  sceneSetId: string;
  revisionId: string;
  source: SceneSourceMapping;
  detectorVersion: string;
  createdAt: string;
  scenes: SceneInterval[];
}

export interface SceneSetValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_ASSET_ID = /^sha256:[a-f0-9]{64}$/;

export function validateSceneSetRevision(sceneSet: SceneSetRevision): SceneSetValidationResult {
  const errors: string[] = [];

  if (sceneSet.schemaVersion !== SCENE_SET_SCHEMA_VERSION) errors.push('unsupported scene-set schemaVersion');
  if (!sceneSet.sceneSetId.trim()) errors.push('sceneSetId is required');
  if (!sceneSet.revisionId.trim()) errors.push('revisionId is required');
  if (!sceneSet.detectorVersion.trim()) errors.push('detectorVersion is required');
  if (Number.isNaN(Date.parse(sceneSet.createdAt))) errors.push('createdAt must be an ISO-compatible timestamp');

  const source = sceneSet.source;
  if (!SHA256_ASSET_ID.test(source.assetId)) errors.push('source.assetId must be a canonical sha256 asset identity');
  if (!source.streamId.trim()) errors.push('source.streamId is required');
  if (!Number.isSafeInteger(source.streamIndex) || source.streamIndex < 0) {
    errors.push('source.streamIndex must be a non-negative safe integer');
  }
  try {
    normalizeCanonicalRational(source.timeBase);
  } catch (error) {
    errors.push(`invalid source.timeBase: ${String(error)}`);
  }

  const seenSceneIds = new Set<string>();
  let previousEndPts: number | undefined;
  for (const [index, scene] of sceneSet.scenes.entries()) {
    if (!scene.sceneId.trim()) errors.push(`scenes[${index}].sceneId is required`);
    if (seenSceneIds.has(scene.sceneId)) errors.push(`duplicate sceneId ${scene.sceneId}`);
    seenSceneIds.add(scene.sceneId);

    if (!Number.isSafeInteger(scene.sourceStartPts)) {
      errors.push(`scenes[${index}].sourceStartPts must be a safe integer`);
    }
    if (!Number.isSafeInteger(scene.sourceEndPts)) {
      errors.push(`scenes[${index}].sourceEndPts must be a safe integer`);
    }
    if (Number.isSafeInteger(scene.sourceStartPts) && Number.isSafeInteger(scene.sourceEndPts)
      && scene.sourceEndPts <= scene.sourceStartPts) {
      errors.push(`scenes[${index}] sourceEndPts must be greater than sourceStartPts`);
    }
    if (previousEndPts !== undefined && Number.isSafeInteger(scene.sourceStartPts)
      && scene.sourceStartPts < previousEndPts) {
      errors.push(`scenes[${index}] overlaps or is out of source order`);
    }
    if (Number.isSafeInteger(scene.sourceEndPts)) previousEndPts = scene.sourceEndPts;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Source mapping equality is exact integer/rational equality; no decimal-time
 * conversion is allowed to become scene authority.
 */
export function sameSceneSourceMapping(left: SceneSourceMapping, right: SceneSourceMapping): boolean {
  try {
    const leftTimeBase = normalizeCanonicalRational(left.timeBase);
    const rightTimeBase = normalizeCanonicalRational(right.timeBase);
    return left.assetId === right.assetId
      && left.streamId === right.streamId
      && left.streamIndex === right.streamIndex
      && leftTimeBase.numerator === rightTimeBase.numerator
      && leftTimeBase.denominator === rightTimeBase.denominator;
  } catch {
    return false;
  }
}
