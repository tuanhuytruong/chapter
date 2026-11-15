import assert from 'node:assert/strict';
import {fixture,OWNER,BOOK} from './fixtures/telegram-v2.js';
import {Worker} from '../src/telegram/worker.js';
import {cleanup} from '../src/telegram/cleanup.js';
import {schedulerTick} from '../src/telegram/scheduler.js';
import {BotClient} from '../src/telegram/client.js';
import {startTelegramRuntime} from '../src/telegram/runtime-loop.js';
import {spawn} from 'node:child_process';
import {Pool} from 'pg';
import {TelegramRepository} from '../src/telegram/repository.js';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
if(process.argv[2]==='dispatch-child'){
 const pool=new Pool({connectionString:process.env.TELEGRAM_TEST_DATABASE_URL});const repo=new TelegramRepository(pool,'dev');
 const transport:typeof fetch=async()=>{console.log(JSON.stringify({dispatch:Date.now()}));return new Response(JSON.stringify({ok:true,result:{message_id:1}}));};
 const bot=new BotClient('synthetic-token',repo,transport);
 await bot.call('sendMessage',{chat_id:'123'},{outbound:true,beforeDispatch:async()=>{if(process.argv[3]==='slow'){console.log('guard');await sleep(1300);}return true;}});await pool.end();
}else{
async function scenario(name:string,run:(f:Awaited<ReturnType<typeof fixture>>,d:any)=>Promise<void>){const f=await fixture();try{const {d}=await f.seed();await f.outbox.enqueue(OWNER,d.id);await run(f,d);console.log('PASS '+name);}finally{await f.close();}}
await scenario('destination cancel scoped; disconnect owner-wide; sending ambiguity scrubbed',async(f,d)=>{
 const d2=(await f.pool.query("INSERT INTO chapter.telegram_destinations(environment,manager_user_id,identity_id,chat_id,type,label,state,activated_at) SELECT environment,manager_user_id,identity_id,'-124','supergroup',label,state,activated_at FROM chapter.telegram_destinations WHERE id=$1 RETURNING *",[d.id])).rows[0];
 await f.pool.query("INSERT INTO chapter.telegram_subscriptions SELECT environment,$2,local_time,timezone,enabled,next_run_at,created_at,updated_at FROM chapter.telegram_subscriptions WHERE destination_id=$1",[d.id,d2.id]);
 await f.pool.query("INSERT INTO chapter.telegram_book_grants(environment,destination_id,book_id,granted_by) VALUES('dev',$1,$2,$3)",[d2.id,BOOK,OWNER]);await f.outbox.enqueue(OWNER,d2.id);
 await f.repo.transaction(c=>f.repo.cancel(c,OWNER,d.id));
 assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries WHERE destination_id=$1',[d2.id])).rows[0].state,'pending');
 await f.pool.query("UPDATE chapter.telegram_deliveries SET state='sending' WHERE destination_id=$1",[d2.id]);
 await f.repo.disconnect(OWNER);assert.equal((await f.pool.query('SELECT count(*)::int n FROM chapter.telegram_delivery_parts WHERE html IS NOT NULL')).rows[0].n,0);
 assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries WHERE destination_id=$1',[d2.id])).rows[0].state,'unknown');
});
for(const state of ['pending','retry_wait'])await scenario('sender-only prior-day '+state,async f=>{
 await f.pool.query("UPDATE chapter.telegram_deliveries SET state=$1,local_date=local_date-1",[state]);assert.equal(await new Worker(f.outbox).runOnce(),false);assert.equal(f.sends.length,0);
 assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries')).rows[0].state,'expired');assert.equal((await f.pool.query('SELECT count(*)::int n FROM chapter.telegram_delivery_parts WHERE html IS NOT NULL')).rows[0].n,0);
});
await scenario('multipart midnight revalidation',async f=>{
 f.setHook(async()=>{if(f.sends.length===1)await f.pool.query('UPDATE chapter.telegram_deliveries SET local_date=local_date-1');});
 await new Worker(f.outbox).runOnce();assert.equal(f.sends.length,1);assert.equal((await f.pool.query('SELECT count(*)::int n FROM chapter.telegram_delivery_parts WHERE html IS NOT NULL')).rows[0].n,0);
});
await scenario('failed delivered resolution rejected; no lease loop; later job fair',async(f,d)=>{
 await f.pool.query("UPDATE chapter.telegram_deliveries SET state='failed';UPDATE chapter.telegram_delivery_parts SET state='failed'");const id=(await f.pool.query('SELECT id FROM chapter.telegram_deliveries')).rows[0].id;
 await assert.rejects(f.outbox.resolve(OWNER,id,'delivered',false),/DELIVERY_NOT_RESOLVABLE/);
 const w=new Worker(f.outbox);assert.equal(await w.runOnce(),false);
 await f.pool.query("UPDATE chapter.telegram_deliveries SET state='pending'");await w.runOnce();assert.equal((await f.pool.query('SELECT state FROM chapter.telegram_deliveries')).rows[0].state,'failed');assert.equal(await w.runOnce(),false);
 await f.pool.query("INSERT INTO chapter.reading_log SELECT gen_random_uuid(),book_id,date,session+1,reading_round,page_start,page_end,summary,key_insights,quote,created_at FROM chapter.reading_log");await f.outbox.enqueue(OWNER,d.id);await w.runOnce();assert(f.sends.length>0);
});
await scenario('unknown retention scrub, retry prohibited without payload',async f=>{
 await f.pool.query("UPDATE chapter.telegram_deliveries SET state='unknown',created_at=now()-interval '8 days';UPDATE chapter.telegram_delivery_parts SET state='unknown'");await cleanup(f.repo);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM chapter.telegram_delivery_parts WHERE html IS NOT NULL')).rows[0].n,0);
 const id=(await f.pool.query('SELECT id FROM chapter.telegram_deliveries')).rows[0].id;await assert.rejects(f.outbox.resolve(OWNER,id,'retry',true),/SNAPSHOT_EXPIRED/);
});
await scenario('stop during limiter wait prevents dispatch',async f=>{
 await f.bot.reserve('123',false);await f.bot.cooldown('123',1);const w=new Worker(f.outbox),p=w.runOnce();await sleep(150);w.stopped=true;await p;assert.equal(f.sends.length,0);
});
await scenario('graceful stop awaits in-flight result and forbids next part',async f=>{
 let entered!:()=>void,release!:()=>void;const seen=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 f.setHook(async()=>{entered();await gate;});const stop=await startTelegramRuntime(f.outbox,false);await seen;
 let stopped=false;const p=Promise.resolve(stop()).then(()=>{stopped=true;});await sleep(100);assert.equal(stopped,false);release();await p;assert.equal(f.sends.length,1);await sleep(100);assert.equal(f.sends.length,1);
});
await scenario('shutdown deadline bounded with stuck transport, no later part',async f=>{
 let entered!:()=>void,release!:()=>void;const seen=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 f.setHook(async()=>{entered();await gate;});const stop=await startTelegramRuntime(f.outbox,false);await seen;const at=Date.now();await stop();assert(Date.now()-at>=11900&&Date.now()-at<14000);release();await sleep(200);assert.equal(f.sends.length,1);
});
await scenario('partial schema columns/index/constraint readiness',async f=>{
 assert.equal(await f.repo.ready(),true);await f.pool.query('ALTER TABLE chapter.telegram_deliveries RENAME COLUMN content_hash TO missing');assert.equal(await f.repo.ready(),false);await f.pool.query('ALTER TABLE chapter.telegram_deliveries RENAME COLUMN missing TO content_hash');
 await f.pool.query('ALTER TABLE chapter.telegram_subscriptions DROP CONSTRAINT telegram_subscriptions_local_time_check');assert.equal(await f.repo.ready(),false);
 await f.pool.query("ALTER TABLE chapter.telegram_subscriptions ADD CHECK(local_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')");assert.equal(await f.repo.ready(),true);
 await f.pool.query('DROP INDEX chapter.telegram_delivery_due');assert.equal(await f.repo.ready(),false);
});
await scenario('persisted schedule authority and late-ready reconciliation',async f=>{
 let n=0;await f.pool.query("UPDATE chapter.telegram_subscriptions SET next_run_at=now()+interval '5 days'");await schedulerTick(f.repo,async()=>{n++;});assert.equal(n,0);
 await f.pool.query("UPDATE chapter.telegram_subscriptions SET next_run_at=now()-interval '1 minute'");await schedulerTick(f.repo,async()=>{n++;});assert.equal(n,1);await schedulerTick(f.repo,async()=>{n++;});assert.equal(n,2);
});
await scenario('separate processes: delayed guard cannot bunch dispatch, concurrent cooldown respected',async f=>{
 const child=(mode:string)=>{const p=spawn(process.execPath,['--import','tsx',new URL(import.meta.url).pathname,'dispatch-child',mode],{env:process.env});let out='';p.stdout.on('data',b=>out+=b);let err='';p.stderr.on('data',b=>err+=b);const done=new Promise<string>((resolve,reject)=>p.on('exit',c=>c===0?resolve(out):reject(new Error(err))));return {done,output:()=>out};};
 const a=child('slow');while(!a.output().includes('guard'))await sleep(20);const b=child('fast');await sleep(200);await f.bot.cooldown('123',2);const cooldownUntil=Date.now()+1900;
 const outputs=await Promise.all([a.done,b.done]);const times=outputs.map(x=>Number(x.match(/"dispatch":(\d+)/)![1])).sort();assert(times[0]>=cooldownUntil);assert(times[1]-times[0]>=1050);console.log(JSON.stringify({dispatchGapMs:times[1]-times[0],cooldownRespected:true}));
});
}
