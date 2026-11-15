import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export type Environment = 'dev'|'prd';
export class TelegramRepository {
 constructor(public pool: Pool, public environment: Environment) { if (!['dev','prd'].includes(environment)) throw new Error('ENVIRONMENT_REQUIRED'); }
 async transaction<T>(fn: (c: PoolClient)=>Promise<T>): Promise<T> { const c = await this.pool.connect(); try { await c.query('BEGIN'); const r=await fn(c); await c.query('COMMIT'); return r; } catch(e){ await c.query('ROLLBACK'); throw e; } finally{ c.release(); } }
 async ready() { const r=await this.pool.query("SELECT bool_and(to_regclass('chapter.'||name) IS NOT NULL) AS ready FROM unnest(ARRAY['telegram_identities','telegram_link_requests','telegram_destinations','telegram_book_grants','telegram_subscriptions','telegram_deliveries','telegram_delivery_parts','telegram_webhook_updates','telegram_rate_limits']) name"); return r.rows[0].ready; }
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
 async cancel(c: any,owner: string) {
  await c.query("UPDATE chapter.telegram_deliveries SET state='canceled',updated_at=now() WHERE environment=$1 AND owner_id=$2 AND state IN ('pending','leased','retry_wait')",[this.environment,owner]);
  await c.query("UPDATE chapter.telegram_delivery_parts p SET html=NULL,state=CASE WHEN p.state='pending' THEN 'canceled' ELSE p.state END FROM chapter.telegram_deliveries d WHERE p.environment=$1 AND d.environment=p.environment AND d.id=p.delivery_id AND d.owner_id=$2 AND d.state='canceled'",[this.environment,owner]);
 }
 async history(owner: string,id: string) { return (await this.pool.query(`SELECT d.id,d.local_date,d.state,d.safe_error_code,d.created_at,coalesce(json_agg(json_build_object('index',p.part_index,'state',p.state,'message_id',p.telegram_message_id,'acknowledged_at',p.acknowledged_at) ORDER BY p.part_index) FILTER(WHERE p.part_index IS NOT NULL),'[]') AS parts FROM chapter.telegram_deliveries d LEFT JOIN chapter.telegram_delivery_parts p ON p.environment=d.environment AND p.delivery_id=d.id WHERE d.environment=$1 AND d.owner_id=$2 AND d.destination_id=$3 GROUP BY d.environment,d.id ORDER BY d.created_at DESC LIMIT 50`,[this.environment,owner,id])).rows; }
}
