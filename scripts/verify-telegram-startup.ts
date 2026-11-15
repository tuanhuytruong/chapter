import assert from 'node:assert/strict';
import {fixture} from './fixtures/telegram-v2.js';
import {startTelegramRuntime} from '../src/telegram/runtime-loop.js';
// Exercise the real runtime with real absent/partial/current PostgreSQL schema,
// no transport escapes this synthetic BotClient. OFF must not even probe DB.
for(const schema of ['absent','partial','current','offline']){
 for(const sender of [false,true])for(const scheduler of [false,true]){
  const f=await fixture();try{
   if(schema==='absent')await f.pool.query('DROP SCHEMA chapter CASCADE; CREATE SCHEMA chapter');
   if(schema==='partial')await f.pool.query('DROP TABLE chapter.telegram_delivery_parts');
   f.outbox.enabled=sender;
   let probes=0;const ready=f.repo.ready.bind(f.repo);
   f.repo.ready=async()=>{probes++;if(schema==='offline')throw new Error('synthetic offline');return ready();};
   let queries=0;const query=f.pool.query.bind(f.pool);(f.pool as any).query=(...args:any[])=>{queries++;return (query as any)(...args);};
   const stop=await startTelegramRuntime(f.outbox,scheduler);await new Promise(r=>setTimeout(r,100));await stop();
   assert.equal(probes,sender||scheduler?1:0);
   if(!sender&&!scheduler)assert.equal(queries,0);
   assert.equal(f.sends.length,0);
   console.log(`PASS startup schema=${schema} sender=${sender} scheduler=${scheduler}`);
  }finally{await f.close();}
 }
}
for(const sender of [false,true])for(const scheduler of [false,true]){
 // Missing/invalid/mismatched environment is represented by telegramService's
 // null capability, independent of feature flags.
 const stop=await startTelegramRuntime(null,scheduler);await stop();
 console.log(`PASS startup null capability sender=${sender} scheduler=${scheduler}`);
}
