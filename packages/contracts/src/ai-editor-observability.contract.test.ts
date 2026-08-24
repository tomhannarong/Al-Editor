import {describe,expect,it} from 'vitest';import {findForbiddenLogFieldPaths,validateAiEditorStructuredLogV1,type AiEditorStructuredLogV1} from './ai-editor-observability.contract.js';
const make=():AiEditorStructuredLogV1=>({schemaVersion:'1.0',timestamp:'2026-08-24T00:00:00Z',level:'info',eventName:'render.completed',component:'renderer',operation:'render-preview',outcome:'succeeded',correlation:{workspaceId:'w',projectId:'p',jobId:'j',timelineRevisionId:'r'},versions:{timelineSchemaVersion:'2.0',deliveryProfileVersion:'1.0'},durationMs:120,attempt:1});
describe('AI Editor structured log v1',()=>{
 it('accepts durable correlation/version refs',()=>expect(validateAiEditorStructuredLogV1(make())).toEqual({valid:true,errors:[]}));
 it('requires stable errorCode on failures',()=>{const l=make();l.outcome='failed';expect(validateAiEditorStructuredLogV1(l).valid).toBe(false)});
 it('rejects empty correlation ids',()=>{const l=make();l.correlation.jobId=' ';expect(validateAiEditorStructuredLogV1(l).valid).toBe(false)});
 it('rejects invalid duration/attempt',()=>{const l=make();l.durationMs=-1;l.attempt=0;expect(validateAiEditorStructuredLogV1(l).errors.length).toBeGreaterThanOrEqual(2)});
 it('detects nested secret/content fields after deserialization',()=>{const l=make() as unknown as Record<string,unknown>;l.extra={apiKey:'secret',nested:{transcript:'raw',chainOfThought:'hidden'}};expect(findForbiddenLogFieldPaths(l)).toEqual(['$.extra.apiKey','$.extra.nested.transcript','$.extra.nested.chainOfThought'])});
});
