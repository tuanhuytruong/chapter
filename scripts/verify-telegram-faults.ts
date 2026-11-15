import assert from 'node:assert/strict';
import {fixture,OWNER,OTHER,BOOK} from './fixtures/telegram-v2.js';
import {Worker} from '../src/telegram/worker.js';

// Every case rebuilds only the explicitly allowlisted disposable PostgreSQL schema.
async function scenario(name:string,run:(f:Awaited<ReturnType<typeof fixture>>,d:any)=>Promise<void>){
 const f=await fixture();try{const {d}=await f.seed();await f.outbox.enqueue(OWNER,d.id);await run(f,d);console.log('PASS '+name);}finally{await f.close();}
}
await scenario('Bot API accepted, result-write DB failure => unknown, no replay',async f=>{
 await f.pool.query(`CREATE FUNCTION chapter.fail_sent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='sent' THEN RAISE EXCEPTION 'synthetic result write failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_sent BEFORE UPDATE ON chapter.telegram_delivery_parts FOR EACH ROW EXECUTE FUNCTION chapter.fail_sent()`);
 const w=new Worker(f.outbox);await w.runOnce();assert.equal(f.sends.length,1);
 assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries')).rows[0].state,'unknown');
 assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_delivery_parts ORDER BY part_index')).rows[0].state,'unknown');
 await f.pool.query('DROP TRIGGER fail_sent ON chapter.telegram_delivery_parts');await w.runOnce();assert.equal(f.sends.length,1);
});
await scenario('Bot accepted, entire DB unavailable in catch, restart => unknown',async f=>{
 const query=f.pool.query.bind(f.pool);let offline=false;
 (f.pool as any).query=(...args:any[])=>{if(offline)return Promise.reject(new Error('synthetic offline'));return (query as any)(...args);};
 const connect=f.pool.connect.bind(f.pool);(f.pool as any).connect=(...args:any[])=>{if(offline)return Promise.reject(new Error('synthetic offline'));return (connect as any)(...args);};
 f.setHook(async()=>{offline=true;});const w=new Worker(f.outbox);await assert.rejects(w.runOnce());offline=false;f.setHook(null);
 await f.pool.query("UPDATE chapter.telegram_deliveries SET lease_until=now()-interval '1 second'");await w.runOnce();assert.equal(f.sends.length,1);
 assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries')).rows[0].state,'unknown');
});
await scenario('lease reclaimed while A waits in rate reservation: stale A cannot dispatch',async f=>{
 const a=new Worker(f.outbox),b=new Worker(f.outbox);let release!:()=>void,entered!:()=>void;
 const waiting=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);const reserve=f.bot.reserve.bind(f.bot);
 f.bot.reserve=async(_chat,_group,guard)=>{entered();await gate;if(guard&&!await guard())throw new (await import('../src/telegram/client.js')).BotError('STALE_OR_REVOKED','rejected');};const pending=a.runOnce();await waiting;
 await f.pool.query("UPDATE chapter.telegram_deliveries SET lease_until=now()-interval '1 second'");const winner=await b.claim();assert(winner);
 release();await pending;assert.equal(f.sends.length,0);
 assert.equal((await f.pool.query('SELECT lease_token,state FROM chapter.telegram_deliveries')).rows[0].lease_token,winner.lease_token);
 f.bot.reserve=reserve;
 // B can finish using its own existing claim, not create another lease.
 b.claim=async()=>winner;await b.runOnce();assert(f.sends.length>1);
});
for(const [name,mutation] of [
 ['grant revoked',"UPDATE chapter.telegram_book_grants SET revoked_at=now()"],
 ['identity disconnected',"UPDATE chapter.telegram_identities SET revoked_at=now()"],
 ['destination paused',"UPDATE chapter.telegram_destinations SET state='paused'"],
 ['destination deleted',"DELETE FROM chapter.telegram_destinations"],
 ['book paused',"UPDATE chapter.books SET status='paused'"],
 ['book moved',`DELETE FROM chapter.telegram_book_grants; UPDATE chapter.books SET owner_id='${OTHER}'`],
 ['book deleted',"DELETE FROM chapter.books"],
 ['subscription disabled',"UPDATE chapter.telegram_subscriptions SET enabled=false"],
 ['permissions removed','permission'],
] as const){
 await scenario(name+' between parts prevents next dispatch',async f=>{
  if(mutation==='permission')await f.pool.query("UPDATE chapter.telegram_destinations SET chat_id='-123',type='supergroup'");
  f.setHook(async()=>{if(f.sends.length===1){if(mutation==='permission')f.setFault('permission');else await f.pool.query(mutation);}});
  const w=new Worker(f.outbox);await w.runOnce();assert.equal(f.sends.length,1);await w.runOnce();assert.equal(f.sends.length,1);
  const parts=(await f.pool.query('SELECT state FROM chapter.telegram_delivery_parts ORDER BY part_index')).rows;
  if(parts.length)assert.equal(parts[0].state,'sent');
  assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM chapter.telegram_delivery_parts WHERE part_index>1 AND state=\'sent\'')).rows[0].n,0);
 });
}
