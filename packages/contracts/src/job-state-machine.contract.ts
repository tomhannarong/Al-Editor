export const JOB_STATE_MACHINE_VERSION = '1.0' as const;
export const JOB_STATES = ['queued','leased','running','retry-wait','succeeded','failed','cancelled'] as const;
export type JobState = (typeof JOB_STATES)[number];
export interface JobLeaseV1 { ownerId:string; token:string; acquiredAt:string; heartbeatAt:string; expiresAt:string; }
export interface DurableJobV1 { stateMachineVersion:typeof JOB_STATE_MACHINE_VERSION; jobId:string; jobType:string; idempotencyKey:string; state:JobState; attempt:number; maxAttempts:number; lease:JobLeaseV1|null; nextAttemptAt:string|null; lastErrorCode:string|null; createdAt:string; updatedAt:string; }
export type JobCommandV1 =
 | {type:'lease'; ownerId:string; token:string; now:string; leaseExpiresAt:string}
 | {type:'start'; token:string; now:string}
 | {type:'heartbeat'; token:string; now:string; leaseExpiresAt:string}
 | {type:'succeed'; token:string; now:string}
 | {type:'fail-retryable'; token:string; now:string; errorCode:string; nextAttemptAt:string}
 | {type:'fail-terminal'; token:string; now:string; errorCode:string}
 | {type:'requeue'; now:string}
 | {type:'cancel'; now:string};
export interface JobTransitionResult { ok:boolean; job:DurableJobV1; error?:string; }
const parse=(value:string):number=>Date.parse(value);
export function validateDurableJobV1(job:DurableJobV1):string[]{
  const errors:string[]=[];
  if(job.stateMachineVersion!==JOB_STATE_MACHINE_VERSION) errors.push('stateMachineVersion must be 1.0');
  if(!job.jobId.trim()||!job.jobType.trim()||!job.idempotencyKey.trim()) errors.push('jobId, jobType and idempotencyKey are required');
  if(!Number.isSafeInteger(job.attempt)||job.attempt<0) errors.push('attempt must be a non-negative safe integer');
  if(!Number.isSafeInteger(job.maxAttempts)||job.maxAttempts<=0) errors.push('maxAttempts must be a positive safe integer');
  if(job.attempt>job.maxAttempts) errors.push('attempt cannot exceed maxAttempts');
  if(Number.isNaN(parse(job.createdAt))||Number.isNaN(parse(job.updatedAt))) errors.push('createdAt and updatedAt must be valid date-time strings');
  if((job.state==='leased'||job.state==='running')&&!job.lease) errors.push('leased/running jobs require a lease');
  if(!(job.state==='leased'||job.state==='running')&&job.lease) errors.push('only leased/running jobs may hold a lease');
  if(job.state==='retry-wait'&&!job.nextAttemptAt) errors.push('retry-wait jobs require nextAttemptAt');
  if(job.state!=='retry-wait'&&job.nextAttemptAt) errors.push('only retry-wait jobs may have nextAttemptAt');
  if(job.lease){
    if(!job.lease.ownerId.trim()||!job.lease.token.trim()) errors.push('lease ownerId and token are required');
    const acquired=parse(job.lease.acquiredAt), heartbeat=parse(job.lease.heartbeatAt), expires=parse(job.lease.expiresAt);
    if([acquired,heartbeat,expires].some(Number.isNaN)) errors.push('lease timestamps must be valid');
    else if(!(acquired<=heartbeat&&heartbeat<expires)) errors.push('lease timestamps must satisfy acquiredAt <= heartbeatAt < expiresAt');
  }
  return errors;
}
export function transitionDurableJobV1(job:DurableJobV1, command:JobCommandV1):JobTransitionResult{
  const existing=validateDurableJobV1(job); if(existing.length) return {ok:false,job,error:existing.join('; ')};
  const next=structuredClone(job); const fail=(error:string):JobTransitionResult=>({ok:false,job,error}); const now=parse(command.now);
  if(Number.isNaN(now)) return fail('command now must be a valid date-time');
  if(now<parse(job.updatedAt)) return fail('command time cannot move backwards');
  if(command.type==='cancel'){
    if(['succeeded','failed','cancelled'].includes(job.state)) return fail('terminal jobs cannot be cancelled');
    next.state='cancelled'; next.lease=null; next.nextAttemptAt=null; next.updatedAt=command.now; return {ok:true,job:next};
  }
  if(command.type==='lease'){
    if(job.state!=='queued') return fail('only queued jobs may be leased');
    if(job.attempt>=job.maxAttempts) return fail('job has exhausted maxAttempts');
    if(!command.ownerId.trim()||!command.token.trim()||parse(command.leaseExpiresAt)<=now) return fail('lease identity/expiry is invalid');
    next.state='leased'; next.attempt+=1; next.lease={ownerId:command.ownerId,token:command.token,acquiredAt:command.now,heartbeatAt:command.now,expiresAt:command.leaseExpiresAt}; next.updatedAt=command.now; return {ok:true,job:next};
  }
  if(command.type==='requeue'){
    if(job.state!=='retry-wait') return fail('only retry-wait jobs may be requeued');
    if(!job.nextAttemptAt||now<parse(job.nextAttemptAt)) return fail('retry is not due');
    if(job.attempt>=job.maxAttempts){next.state='failed';next.nextAttemptAt=null;} else {next.state='queued';next.nextAttemptAt=null;}
    next.updatedAt=command.now; return {ok:true,job:next};
  }
  if(!job.lease) return fail('command requires an active lease');
  if(!('token' in command)||command.token!==job.lease.token) return fail('lease token mismatch');
  if(now>=parse(job.lease.expiresAt)) return fail('lease expired');
  if(command.type==='start') { if(job.state!=='leased')return fail('only leased jobs may start'); next.state='running';next.updatedAt=command.now;return {ok:true,job:next}; }
  if(command.type==='heartbeat') { if(job.state!=='leased'&&job.state!=='running')return fail('heartbeat requires leased/running state'); if(parse(command.leaseExpiresAt)<=now)return fail('heartbeat expiry must be after now'); next.lease!.heartbeatAt=command.now;next.lease!.expiresAt=command.leaseExpiresAt;next.updatedAt=command.now;return {ok:true,job:next}; }
  if(command.type==='succeed') { if(job.state!=='running')return fail('only running jobs may succeed');next.state='succeeded';next.lease=null;next.lastErrorCode=null;next.updatedAt=command.now;return {ok:true,job:next}; }
  if(command.type==='fail-terminal') { if(job.state!=='running')return fail('only running jobs may fail');next.state='failed';next.lease=null;next.lastErrorCode=command.errorCode;next.updatedAt=command.now;return {ok:true,job:next}; }
  if(command.type==='fail-retryable') { if(job.state!=='running')return fail('only running jobs may fail retryably');next.lease=null;next.lastErrorCode=command.errorCode;next.updatedAt=command.now;if(job.attempt>=job.maxAttempts){next.state='failed';next.nextAttemptAt=null;}else{if(parse(command.nextAttemptAt)<=now)return fail('nextAttemptAt must be after now');next.state='retry-wait';next.nextAttemptAt=command.nextAttemptAt;}return {ok:true,job:next}; }
  return fail('unsupported command');
}
