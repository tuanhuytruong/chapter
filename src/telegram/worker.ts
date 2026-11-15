import { randomUUID } from 'node:crypto';
import { BotError } from './client.js';
import { authorized } from './authorization.js';
import { plainText } from './render.js';
import type { Outbox } from './outbox.js';
export class Worker {
 stopped=false;
 constructor(public outbox: Outbox){}
 async recover() { const {repo}=this.outbox;
  await repo.transaction(async c=>{
   await c.query(`UPDATE chapter.telegram_delivery_parts p SET state='unknown' FROM chapter.telegram_deliveries d WHERE p.environment=$1 AND d.environment=p.environment AND d.id=p.delivery_id AND d.lease_until<now() AND p.state='sending'`,[repo.environment]);
   await c.query(`UPDATE chapter.telegram_deliveries SET state='unknown',safe_error_code='INTERRUPTED_DISPATCH',updated_at=now() WHERE environment=$1 AND lease_until<now() AND state='sending'`,[repo.environment]);
  });
 }
 async claim(){ const {repo}=this.outbox;await repo.expire();const token=randomUUID();
  const r=await repo.pool.query(`WITH candidate AS (SELECT id FROM chapter.telegram_deliveries WHERE environment=$1 AND (state IN ('pending','retry_wait') AND next_attempt_at<=now() OR state='leased' AND lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE chapter.telegram_deliveries d SET state='leased',lease_token=$2,lease_until=now()+interval '90 seconds',attempt_count=attempt_count+1,updated_at=now() FROM candidate c WHERE d.environment=$1 AND d.id=c.id RETURNING d.*`,[repo.environment,token]);return r.rows[0];
 }
 async fenced(job:any,sql:string,args:any[]=[]) {const {repo}=this.outbox;return repo.pool.query(sql,[repo.environment,job.id,job.lease_token,...args]);}
 async runOnce(){if(this.stopped||!this.outbox.enabled)return false;await this.recover();const job=await this.claim();if(!job)return false;
  const {repo,bot}=this.outbox;
  const parts=(await repo.pool.query("SELECT * FROM chapter.telegram_delivery_parts WHERE environment=$1 AND delivery_id=$2 ORDER BY part_index",[repo.environment,job.id])).rows;
  for(const part of parts){
   if(part.state==='sent')continue;
   if(this.stopped)return true;
   if(part.state!=='pending'){await this.fenced(job,"UPDATE chapter.telegram_deliveries SET state='failed',safe_error_code='TERMINAL_PART' WHERE environment=$1 AND id=$2 AND lease_token=$3 AND state='leased'");return true;}
   let d:any;
   const guard=async()=>{
    if(this.stopped)return false;
    try{({d}=await authorized(repo,bot,job.owner_id,job.destination_id,job.book_id));}catch{return false;}
    if(this.stopped)return false;
    // A stale worker must win the fenced sending transition before dispatching.
    const r=await repo.transaction(async c=>{
     const locked=await c.query("UPDATE chapter.telegram_deliveries SET state='sending',lease_until=now()+interval '90 seconds',updated_at=now() WHERE environment=$1 AND id=$2 AND lease_token=$3 AND lease_until>now() AND state IN ('leased','sending') AND EXISTS (SELECT 1 FROM chapter.telegram_destinations dest JOIN chapter.telegram_identities ident ON ident.environment=dest.environment AND ident.id=dest.identity_id AND ident.user_id=dest.manager_user_id AND ident.revoked_at IS NULL JOIN chapter.telegram_subscriptions sub ON sub.environment=dest.environment AND sub.destination_id=dest.id AND sub.enabled AND telegram_deliveries.local_date=(clock_timestamp() AT TIME ZONE sub.timezone)::date JOIN chapter.telegram_book_grants g ON g.environment=dest.environment AND g.destination_id=dest.id AND g.book_id=telegram_deliveries.book_id AND g.granted_by=dest.manager_user_id AND g.revoked_at IS NULL JOIN chapter.books book ON book.id=g.book_id AND book.owner_id=dest.manager_user_id AND book.status='active' WHERE dest.environment=telegram_deliveries.environment AND dest.id=telegram_deliveries.destination_id AND dest.manager_user_id=telegram_deliveries.owner_id AND dest.state='active') RETURNING id",[repo.environment,job.id,job.lease_token]);
     if(!locked.rowCount)return false;
     const p=await c.query("UPDATE chapter.telegram_delivery_parts SET state='sending',attempt_count=attempt_count+CASE WHEN state='pending' THEN 1 ELSE 0 END WHERE environment=$1 AND delivery_id=$2 AND part_index=$3 AND state IN ('pending','sending') RETURNING part_index",[repo.environment,job.id,part.part_index]);return !!p.rowCount;
    });return r && !this.stopped;
   };
   try{
    // Authorization occurs after rate reservation, not before an arbitrary limiter wait.
    d=await repo.destination(job.owner_id,job.destination_id);if(!d)throw new BotError('DESTINATION_REVOKED','rejected');
    const payload:any={chat_id:d.chat_id,message_thread_id:Number(d.thread_id)||undefined,text:part.html,parse_mode:'HTML',disable_web_page_preview:true};
    let result:any;
    try{result=await bot.call('sendMessage',payload,{outbound:true,group:d.type!=='private',beforeDispatch:guard,canDispatch:()=>!this.stopped});}
    catch(e){
     if(!(e instanceof BotError)||e.code!=='PARSE_REJECTED')throw e;
     // Definite parse rejection has not delivered. Reset only this unsent part under fence.
     await repo.pool.query("UPDATE chapter.telegram_delivery_parts p SET state='pending' FROM chapter.telegram_deliveries d WHERE p.environment=$1 AND p.delivery_id=$2 AND p.part_index=$4 AND d.environment=p.environment AND d.id=p.delivery_id AND d.lease_token=$3 AND d.lease_until>now() AND p.state='sending'",[repo.environment,job.id,job.lease_token,part.part_index]);
     delete payload.parse_mode;payload.text=plainText(part.html);result=await bot.call('sendMessage',payload,{outbound:true,group:d.type!=='private',beforeDispatch:guard,canDispatch:()=>!this.stopped});
    }
    if(!result?.message_id)throw new BotError('MISSING_MESSAGE_ID','unknown');
    const saved=await repo.pool.query("UPDATE chapter.telegram_delivery_parts p SET state='sent',telegram_message_id=$5,sent_at=now() FROM chapter.telegram_deliveries d WHERE p.environment=$1 AND p.delivery_id=$2 AND p.part_index=$4 AND d.environment=p.environment AND d.id=p.delivery_id AND d.lease_token=$3 AND d.lease_until>now() AND d.state='sending' AND p.state='sending' RETURNING p.part_index",[repo.environment,job.id,job.lease_token,part.part_index,String(result.message_id)]);
    if(!saved.rowCount)return true;
   }catch(e){
    const error=e instanceof BotError?e:new BotError('UNCONFIRMED_RESULT','unknown');
    await repo.transaction(async c=>{
     const state=error.code==='STALE_OR_REVOKED'?'canceled':error.outcome==='retry'?'retry_wait':error.outcome==='unknown'?'unknown':'failed';
     const r=await c.query("UPDATE chapter.telegram_deliveries SET state=$4,safe_error_code=$5,next_attempt_at=now()+$6*interval '1 second',updated_at=now() WHERE environment=$1 AND id=$2 AND lease_token=$3 AND lease_until>now() AND state IN ('leased','sending') RETURNING id",[repo.environment,job.id,job.lease_token,state,error.code,error.retryAfter+1]);
     if(r.rowCount)await c.query("UPDATE chapter.telegram_delivery_parts SET state=CASE WHEN $4='canceled' THEN CASE WHEN state='sent' THEN state ELSE 'canceled' END ELSE $4 END,html=CASE WHEN $4='canceled' THEN NULL ELSE html END WHERE environment=$1 AND delivery_id=$2 AND ($4='canceled' OR part_index=$3 AND state IN ('pending','sending'))",[repo.environment,job.id,part.part_index,state==='retry_wait'?'pending':state]);
    });return true;
   }
  }
  await this.fenced(job,"UPDATE chapter.telegram_deliveries d SET state='sent',lease_until=NULL,updated_at=now() WHERE environment=$1 AND id=$2 AND lease_token=$3 AND lease_until>now() AND state IN ('leased','sending') AND NOT EXISTS(SELECT 1 FROM chapter.telegram_delivery_parts p WHERE p.environment=d.environment AND p.delivery_id=d.id AND p.state<>'sent')");return true;
 }
}
