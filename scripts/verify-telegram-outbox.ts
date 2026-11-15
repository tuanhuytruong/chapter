import assert from 'node:assert/strict';
import {fixture,OWNER,BOOK,LOG} from './fixtures/telegram-v2.js';
import {Worker} from '../src/telegram/worker.js';
const f=await fixture();try{
 const {d}=await f.seed();const w=new Worker(f.outbox),w2=new Worker(f.outbox);
 const r=await Promise.all([f.outbox.enqueue(OWNER,d.id),f.outbox.enqueue(OWNER,d.id)]);assert.equal(r.reduce((n,x)=>n+x.queued,0),1);
 const claims=await Promise.all([w.claim(),w2.claim()]);assert.equal(claims.filter(Boolean).length,1);const a=claims.find(Boolean);
 await f.pool.query("UPDATE chapter.telegram_deliveries SET lease_until=now()-interval '1 second' WHERE id=$1",[a.id]);const b=await w2.claim();assert.notEqual(a.lease_token,b.lease_token);
 const stale=await w.fenced(a,"UPDATE chapter.telegram_deliveries SET state='sent' WHERE environment=$1 AND id=$2 AND lease_token=$3 AND lease_until>now()");assert.equal(stale.rowCount,0);
 await f.pool.query("UPDATE chapter.telegram_deliveries SET state='pending',lease_token=NULL,lease_until=NULL");
 f.setHook(async()=>{if(f.sends.length===1)await f.pool.query("UPDATE chapter.telegram_book_grants SET revoked_at=now()");});
 await w.runOnce();assert.equal(f.sends.length,1);assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries')).rows[0].state,'canceled');
 await f.pool.query("UPDATE chapter.telegram_book_grants SET revoked_at=NULL;UPDATE chapter.telegram_deliveries SET state='pending',next_attempt_at=now();UPDATE chapter.telegram_delivery_parts SET state='pending',html='Synthetic retry' WHERE state='canceled'");f.setHook(null);
 f.setFault('timeout');await w.runOnce();assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries')).rows[0].state,'unknown');await w.runOnce();assert.equal(f.sends.length,1);
 await f.outbox.resolve(OWNER,a.id,'retry',true);f.setFault('429');await w.runOnce();assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries')).rows[0].state,'retry_wait');
 f.setFault(null);await f.pool.query("UPDATE chapter.telegram_deliveries SET next_attempt_at=now()");await w.runOnce();assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries')).rows[0].state,'sent');
 const before=f.sends.length;await w.runOnce();assert.equal(f.sends.length,before);
 // A new destination row cannot bypass semantic ledger uniqueness.
 await f.pool.query('DELETE FROM chapter.telegram_destinations WHERE id=$1',[d.id]);
 const d2=(await f.pool.query("INSERT INTO chapter.telegram_destinations(environment,manager_user_id,identity_id,chat_id,type,label,state,activated_at) VALUES('dev',$1,$2,'123','private','recreated','active',now()-interval '1 day') RETURNING *",[OWNER,d.identity_id])).rows[0];
 await f.pool.query("INSERT INTO chapter.telegram_book_grants(environment,destination_id,book_id,granted_by) VALUES('dev',$1,$2,$3)",[d2.id,BOOK,OWNER]);await f.pool.query("INSERT INTO chapter.telegram_subscriptions(environment,destination_id,local_time,enabled,next_run_at) VALUES('dev',$1,'00:00',true,now())",[d2.id]);assert.equal((await f.outbox.enqueue(OWNER,d2.id)).queued,0);
 f.outbox.enabled=false;await assert.rejects(f.outbox.enqueue(OWNER,d2.id));assert.equal(await w.runOnce(),false);
 console.log('PASS real PostgreSQL concurrent dedup/claim, fenced stale commit, revoke between parts, unknown no retry, 429, confirmed part restart, canonical recreation, OFF');
}finally{await f.close();}
