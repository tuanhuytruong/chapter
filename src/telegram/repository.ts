import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export type Environment = 'dev'|'prd';
export class TelegramRepository {
 constructor(public pool: Pool, public environment: Environment) { if (!['dev','prd'].includes(environment)) throw new Error('ENVIRONMENT_REQUIRED'); }
 async transaction<T>(fn: (c: PoolClient)=>Promise<T>): Promise<T> { const c = await this.pool.connect(); try { await c.query('BEGIN'); const r=await fn(c); await c.query('COMMIT'); return r; } catch(e){ await c.query('ROLLBACK'); throw e; } finally{ c.release(); } }
 async ready() {
  try {
   const columns:Record<string,string[]>={"telegram_identities": ["environment", "id", "user_id", "telegram_user_id", "private_chat_id", "revoked_at", "linked_at"], "telegram_link_requests": ["environment", "id", "user_id", "purpose", "token_hash", "candidate", "expires_at", "consumed_at", "created_at"], "telegram_destinations": ["environment", "id", "manager_user_id", "identity_id", "chat_id", "thread_id", "type", "label", "state", "activated_at", "permissions_checked_at", "created_at"], "telegram_book_grants": ["environment", "destination_id", "book_id", "code", "granted_by", "granted_at", "revoked_at"], "telegram_subscriptions": ["environment", "destination_id", "local_time", "timezone", "enabled", "next_run_at", "created_at", "updated_at"], "telegram_deliveries": ["environment", "id", "owner_id", "destination_id", "canonical_destination", "reading_log_id", "reading_round", "book_id", "kind", "local_date", "state", "attempt_count", "next_attempt_at", "lease_token", "lease_until", "safe_error_code", "content_hash", "renderer_version", "created_at", "updated_at"], "telegram_delivery_parts": ["environment", "delivery_id", "part_index", "html", "state", "telegram_message_id", "acknowledged_at", "attempt_count", "sent_at", "created_at"], "telegram_webhook_updates": ["environment", "bot_key", "update_id", "created_at"], "telegram_rate_limits": ["bot_key", "scope", "next_at", "updated_at"]};
   for(const [table,names] of Object.entries(columns)){
    const r=await this.pool.query("SELECT attname FROM pg_attribute WHERE attrelid=to_regclass($1) AND attnum>0 AND NOT attisdropped",['chapter.'+table]);
    if(!names.every(n=>r.rows.some(x=>x.attname===n)))return false;
   }
   const r=await this.pool.query(`SELECT count(*)::int AS n FROM pg_index WHERE indexrelid=ANY($1::regclass[]) AND indisvalid AND indisready`,[['chapter.telegram_identity_user','chapter.telegram_identity_sender','chapter.telegram_delivery_due','chapter.telegram_users_environment_id','chapter.telegram_books_owner_id']]);
   if(r.rows[0].n!==5)return false;
   const constraints=await this.pool.query("SELECT conrelid::regclass::text AS name,contype,count(*)::int AS n,bool_and(convalidated) AS valid FROM pg_constraint WHERE connamespace='chapter'::regnamespace GROUP BY conrelid,contype");
   const expected:Record<string,Record<string,number>>={"telegram_identities": {"p": 1, "f": 2, "u": 0, "c": 2}, "telegram_link_requests": {"p": 1, "f": 2, "u": 1, "c": 3}, "telegram_destinations": {"p": 1, "f": 3, "u": 1, "c": 4}, "telegram_book_grants": {"p": 1, "f": 5, "u": 1, "c": 0}, "telegram_subscriptions": {"p": 1, "f": 1, "u": 0, "c": 1}, "telegram_deliveries": {"p": 1, "f": 3, "u": 1, "c": 3}, "telegram_delivery_parts": {"p": 1, "f": 1, "u": 0, "c": 2}, "telegram_webhook_updates": {"p": 1, "f": 0, "u": 0, "c": 1}, "telegram_rate_limits": {"p": 1, "f": 0, "u": 0, "c": 0}};
   for(const table of Object.keys(columns)){
    const cs=constraints.rows.filter(x=>x.name==='chapter.'+table);
    if(cs.some(x=>!x.valid))return false;
    for(const [type,count] of Object.entries(expected[table]))if(count>0&&!cs.some(x=>x.contype===type&&x.n>=count))return false;
   }
   return true;
  }catch{return false;}
 }
 async expire() { await this.transaction(async c=>{
  await c.query(`UPDATE chapter.telegram_deliveries d SET state='expired',updated_at=now() FROM chapter.telegram_subscriptions s WHERE d.environment=$1 AND s.environment=d.environment AND s.destination_id=d.destination_id AND d.local_date < (clock_timestamp() AT TIME ZONE s.timezone)::date AND d.state IN ('pending','retry_wait','leased')`,[this.environment]);
  await c.query(`UPDATE chapter.telegram_delivery_parts p SET html=NULL,state=CASE WHEN p.state='pending' THEN 'canceled' ELSE p.state END FROM chapter.telegram_deliveries d WHERE p.environment=$1 AND d.environment=p.environment AND d.id=p.delivery_id AND d.state='expired'`,[this.environment]);
 }); }
 async identity(owner: string, c: any=this.pool) { return (await c.query('SELECT * FROM chapter.telegram_identities WHERE environment=$1 AND user_id=$2 AND revoked_at IS NULL',[this.environment,owner])).rows[0]; }
 async destination(owner: string,id: string,c: any=this.pool) { return (await c.query('SELECT * FROM chapter.telegram_destinations WHERE environment=$1 AND manager_user_id=$2 AND id=$3',[this.environment,owner,id])).rows[0]; }
 async destinations(owner: string) { return (await this.pool.query('SELECT * FROM chapter.telegram_destinations WHERE environment=$1 AND manager_user_id=$2 AND state<>\'revoked\' ORDER BY created_at',[this.environment,owner])).rows; }
 async token(owner: string,purpose: string,token: string,candidate: any=null) { return this.transaction(async c=>{
  const u=await c.query('SELECT id FROM chapter.users WHERE id=$1 AND environment=$2',[owner,this.environment]); if(!u.rowCount)throw new Error('OWNER_REQUIRED');
  await c.query('DELETE FROM chapter.telegram_link_requests WHERE environment=$1 AND user_id=$2 AND purpose=$3 AND consumed_at IS NULL',[this.environment,owner,purpose]);
  await c.query("INSERT INTO chapter.telegram_link_requests(environment,user_id,purpose,token_hash,candidate,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '15 minutes')",[this.environment,owner,purpose,hash(token),candidate]);
 }); }
 async consume(c: any,token: string,purpose: string,owner?: string) { return (await c.query(`UPDATE chapter.telegram_link_requests SET consumed_at=now() WHERE environment=$1 AND token_hash=$2 AND purpose=$3 AND consumed_at IS NULL AND expires_at>now() AND ($4::uuid IS NULL OR user_id=$4) RETURNING *`,[this.environment,hash(token),purpose,owner||null])).rows[0]; }
 async disconnect(owner: string) { return this.transaction(async c=>{
  await c.query('UPDATE chapter.telegram_identities SET revoked_at=now() WHERE environment=$1 AND user_id=$2 AND revoked_at IS NULL',[this.environment,owner]);
  await c.query("UPDATE chapter.telegram_destinations SET state='revoked' WHERE environment=$1 AND manager_user_id=$2",[this.environment,owner]);
  await c.query('UPDATE chapter.telegram_subscriptions SET enabled=false WHERE environment=$1 AND destination_id IN (SELECT id FROM chapter.telegram_destinations WHERE environment=$1 AND manager_user_id=$2)',[this.environment,owner]);
  await c.query('DELETE FROM chapter.telegram_link_requests WHERE environment=$1 AND user_id=$2',[this.environment,owner]);
  await this.cancel(c,owner);
 }); }
 async cancel(c: any,owner: string,destination: string|null=null,books: string[]|null=null) {
  await c.query("UPDATE chapter.telegram_deliveries SET state=CASE WHEN state='sending' THEN 'unknown' ELSE 'canceled' END,updated_at=now() WHERE environment=$1 AND owner_id=$2 AND ($3::uuid IS NULL OR destination_id=$3) AND ($4::uuid[] IS NULL OR NOT(book_id=ANY($4))) AND state IN ('pending','leased','retry_wait','sending')",[this.environment,owner,destination,books]);
  await c.query("UPDATE chapter.telegram_delivery_parts p SET html=NULL,state=CASE WHEN p.state='sending' THEN 'unknown' WHEN p.state='pending' THEN 'canceled' ELSE p.state END FROM chapter.telegram_deliveries d WHERE p.environment=$1 AND d.environment=p.environment AND d.id=p.delivery_id AND d.owner_id=$2 AND ($3::uuid IS NULL OR d.destination_id=$3) AND ($4::uuid[] IS NULL OR NOT(d.book_id=ANY($4))) ",[this.environment,owner,destination,books]);
 }
 async history(owner: string,id: string) { return (await this.pool.query(`SELECT d.id,d.local_date,d.state,d.safe_error_code,d.created_at,coalesce(json_agg(json_build_object('index',p.part_index,'state',p.state,'message_id',p.telegram_message_id,'acknowledged_at',p.acknowledged_at) ORDER BY p.part_index) FILTER(WHERE p.part_index IS NOT NULL),'[]') AS parts FROM chapter.telegram_deliveries d LEFT JOIN chapter.telegram_delivery_parts p ON p.environment=d.environment AND p.delivery_id=d.id WHERE d.environment=$1 AND d.owner_id=$2 AND d.destination_id=$3 GROUP BY d.environment,d.id ORDER BY d.created_at DESC LIMIT 50`,[this.environment,owner,id])).rows; }
}
