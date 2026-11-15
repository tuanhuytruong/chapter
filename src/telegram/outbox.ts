import { hash, type TelegramRepository } from './repository.js';
import type { BotClient } from './client.js';
import { authorized } from './authorization.js';
import { renderSummary, RENDERER_VERSION } from './render.js';
import { localClock } from './scheduler.js';
export class Outbox {
 constructor(public repo: TelegramRepository,public bot: BotClient,public origin: string,public enabled=false){}
 async preview(owner: string,id: string,day?: string,book?: string) {
  const {d,s}=await authorized(this.repo,this.bot,owner,id,book);
  const date=day||localClock(new Date(),s.timezone).day;
  const r=await this.repo.pool.query(`SELECT l.*,b.title,b.author FROM chapter.reading_log l JOIN chapter.books b ON b.id=l.book_id JOIN chapter.telegram_book_grants g ON g.environment=$1 AND g.book_id=b.id AND g.destination_id=$2 AND g.revoked_at IS NULL AND g.granted_by=$3 WHERE b.owner_id=$3 AND b.status='active' AND l.reading_round=b.current_reading_round AND l.date=$4 AND nullif(btrim(l.summary),'') IS NOT NULL AND l.created_at >= $5::timestamptz AND ($6::uuid IS NULL OR b.id=$6) ORDER BY l.session,l.created_at,l.id`,[this.repo.environment,id,owner,date,d.activated_at,book||null]);
  return {d,date,logs:r.rows};
 }
 async enqueue(owner: string,id: string,day?: string,book?: string,c?: any) {
  if(!this.enabled)throw new Error('SENDER_DISABLED');
  const {d,date,logs}=await this.preview(owner,id,day,book);
  const insert=async (client: any)=>{let count=0;
   for(const log of logs){
    const parts=renderSummary(log.title,log.author,log,this.origin);
    const r=await client.query(`INSERT INTO chapter.telegram_deliveries(environment,owner_id,destination_id,canonical_destination,reading_log_id,reading_round,book_id,local_date,content_hash,renderer_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(environment,canonical_destination,reading_log_id,reading_round,kind) DO NOTHING RETURNING id`,[this.repo.environment,owner,id,`${d.chat_id}:${d.thread_id}`,log.id,log.reading_round,log.book_id,date,hash(parts.join('')),RENDERER_VERSION]);
    if(!r.rowCount)continue;count++;
    for(let i=0;i<parts.length;i++)await client.query('INSERT INTO chapter.telegram_delivery_parts(environment,delivery_id,part_index,html) VALUES($1,$2,$3,$4)',[this.repo.environment,r.rows[0].id,i,parts[i]]);
   }return {queued:count,sessions:logs.length,date};
  };return c?insert(c):this.repo.transaction(insert);
 }
 async resolve(owner: string,id: string,action: string,duplicateWarning: boolean) {
  if(!['delivered','retry'].includes(action)||action==='retry'&&!duplicateWarning)throw new Error('DUPLICATE_WARNING_REQUIRED');
  return this.repo.transaction(async c=>{
   const r=await c.query("SELECT * FROM chapter.telegram_deliveries WHERE environment=$1 AND id=$2 AND owner_id=$3 AND state IN ('unknown','failed') FOR UPDATE",[this.repo.environment,id,owner]);
   if(!r.rowCount)throw new Error('DELIVERY_NOT_RESOLVABLE');
   await authorized(this.repo,this.bot,owner,r.rows[0].destination_id,r.rows[0].book_id);
   if(action==='delivered')await c.query("UPDATE chapter.telegram_delivery_parts SET state='sent',acknowledged_at=now() WHERE environment=$1 AND delivery_id=$2 AND state='unknown'",[this.repo.environment,id]);
   else await c.query("UPDATE chapter.telegram_delivery_parts SET state='pending' WHERE environment=$1 AND delivery_id=$2 AND state IN ('unknown','failed')",[this.repo.environment,id]);
   await c.query("UPDATE chapter.telegram_deliveries SET state='pending',lease_token=NULL,lease_until=NULL,next_attempt_at=now() WHERE environment=$1 AND id=$2 AND owner_id=$3",[this.repo.environment,id,owner]);
  });
 }
}
