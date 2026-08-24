export const AI_EDITOR_LOG_SCHEMA_VERSION = '1.0' as const;
export type AiEditorLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type AiEditorLogOutcome = 'started' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
export interface AiEditorLogCorrelationV1 { tenantId?:string; workspaceId?:string; projectId?:string; jobId?:string; timelineRevisionId?:string; mediaAssetId?:string; sceneId?:string; voiceoverId?:string; retrievalRunId?:string; renderRunId?:string; modelRunId?:string; requestId?:string; traceId?:string; spanId?:string; }
export interface AiEditorLogVersionRefsV1 { timelineSchemaVersion?:string; styleProfileVersion?:string; deliveryProfileVersion?:string; promptVersion?:string; modelVersion?:string; scoringPolicyVersion?:string; }
export interface AiEditorStructuredLogV1 { schemaVersion:typeof AI_EDITOR_LOG_SCHEMA_VERSION; timestamp:string; level:AiEditorLogLevel; eventName:string; component:string; operation:string; outcome:AiEditorLogOutcome; correlation:AiEditorLogCorrelationV1; versions?:AiEditorLogVersionRefsV1; durationMs?:number; attempt?:number; errorCode?:string; }
export interface AiEditorStructuredLogValidationResult { valid:boolean; errors:string[]; }
/** Canonical logs store durable IDs/versions, never raw content, paths, credentials or hidden model reasoning. */
export const AI_EDITOR_FORBIDDEN_LOG_FIELDS = ['authorization','cookie','secret','token','apiKey','prompt','rawPrompt','transcript','ocrText','mediaPath','sourcePath','sourceUrl','modelReasoning','chainOfThought'] as const;
const forbiddenFields = new Set<string>(AI_EDITOR_FORBIDDEN_LOG_FIELDS.map((value) => value.toLowerCase()));
const isNonEmpty = (value:string|undefined):boolean => value === undefined || value.trim().length > 0;
export function findForbiddenLogFieldPaths(value:unknown, path='$'):string[] {
  const found:string[]=[];
  if(Array.isArray(value)){ value.forEach((entry,index)=>found.push(...findForbiddenLogFieldPaths(entry,`${path}[${index}]`))); return found; }
  if(!value || typeof value !== 'object') return found;
  for(const [key,child] of Object.entries(value as Record<string,unknown>)) {
    if(forbiddenFields.has(key.toLowerCase())) found.push(`${path}.${key}`);
    found.push(...findForbiddenLogFieldPaths(child,`${path}.${key}`));
  }
  return found;
}
export function validateAiEditorStructuredLogV1(log:AiEditorStructuredLogV1):AiEditorStructuredLogValidationResult {
  const errors:string[]=[];
  if(log.schemaVersion!==AI_EDITOR_LOG_SCHEMA_VERSION) errors.push('schemaVersion must be 1.0');
  if(Number.isNaN(Date.parse(log.timestamp))) errors.push('timestamp must be a valid ISO-8601 timestamp');
  if(!log.eventName.trim()||!log.component.trim()||!log.operation.trim()) errors.push('eventName, component and operation are required');
  if(!Object.values(log.correlation).every(isNonEmpty)) errors.push('correlation identifiers must be non-empty when present');
  if(log.versions && !Object.values(log.versions).every(isNonEmpty)) errors.push('version references must be non-empty when present');
  if(log.durationMs!==undefined && (!Number.isFinite(log.durationMs)||log.durationMs<0)) errors.push('durationMs must be finite and non-negative when present');
  if(log.attempt!==undefined && (!Number.isSafeInteger(log.attempt)||log.attempt<=0)) errors.push('attempt must be a positive safe integer when present');
  if(log.errorCode!==undefined && !log.errorCode.trim()) errors.push('errorCode must be non-empty when present');
  if(log.outcome==='failed' && !log.errorCode) errors.push('failed events must include a stable errorCode');
  const forbidden=findForbiddenLogFieldPaths(log);
  if(forbidden.length) errors.push(`forbidden structured-log fields detected: ${forbidden.join(', ')}`);
  return {valid:errors.length===0,errors};
}
