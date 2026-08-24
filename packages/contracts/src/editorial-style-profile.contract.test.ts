import { describe, expect, it } from 'vitest';
import { EDITORIAL_STYLE_PROFILE_SCHEMA_VERSION, validateEditorialStyleProfileV1, type EditorialStyleProfileV1 } from './editorial-style-profile.contract.js';
const make = (): EditorialStyleProfileV1 => ({schemaVersion:EDITORIAL_STYLE_PROFILE_SCHEMA_VERSION,profileId:'viral-travel',profileVersion:'1.0.0',status:'approved',brandAuthority:{brandId:'brand-001',brandVersion:'2026.08',videoStyleDnaDocument:{documentId:'VIDEO-STYLE-DNA',version:'3.0.0'}},duration:{targetShotDurationMs:1800,hookShotDurationMs:1100,minShotDurationMs:700,maxShotDurationMs:4000},variety:{maxConsecutiveSameShotType:2,preferredHumanPresenceIntervalMs:8000,penalizeNearDuplicates:true},movement:{movementPreferenceWeight:.8,repeatedMovementPenaltyWeight:.2},transitions:{hardCutWeight:.85,maxNonCutTransitionRatio:.15},scoring:{semanticRelevance:.45,visualQuality:.2,continuity:.1,variety:.15,novelty:.1},createdAt:'2026-08-24T00:00:00Z',updatedAt:'2026-08-24T01:00:00Z'});
describe('editorial style profile v1',()=>{
 it('accepts deterministic policy referencing Brand authority',()=>expect(validateEditorialStyleProfileV1(make())).toEqual({valid:true,errors:[]}));
 it('requires VIDEO-STYLE-DNA reference',()=>{const p=make();p.brandAuthority.videoStyleDnaDocument.documentId='';expect(validateEditorialStyleProfileV1(p).errors.join('|')).toMatch(/VIDEO-STYLE-DNA/)});
 it('rejects contradictory duration bounds',()=>{const p=make();p.duration.minShotDurationMs=5000;expect(validateEditorialStyleProfileV1(p).valid).toBe(false)});
 it('rejects target/hook outside bounds',()=>{const p=make();p.duration.targetShotDurationMs=5000;p.duration.hookShotDurationMs=500;expect(validateEditorialStyleProfileV1(p).errors).toHaveLength(2)});
 it('rejects unit interval violations',()=>{const p=make();p.movement.movementPreferenceWeight=1.1;expect(validateEditorialStyleProfileV1(p).valid).toBe(false)});
 it('requires a positive scoring signal',()=>{const p=make();p.scoring={semanticRelevance:0,visualQuality:0,continuity:0,variety:0,novelty:0};expect(validateEditorialStyleProfileV1(p).valid).toBe(false)});
 it('allows human presence preference disabled',()=>{const p=make();p.variety.preferredHumanPresenceIntervalMs=null;expect(validateEditorialStyleProfileV1(p).valid).toBe(true)});
 it('rejects reversed timestamps',()=>{const p=make();p.updatedAt='2026-08-23T00:00:00Z';expect(validateEditorialStyleProfileV1(p).valid).toBe(false)});
});
