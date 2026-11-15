import assert from 'node:assert/strict';
import {fixture,OWNER,OTHER} from './fixtures/telegram-v2.js';
import {consumeIdentity} from '../src/telegram/identity.js';
import {TelegramRepository} from '../src/telegram/repository.js';
import {handleUpdate} from '../src/telegram/webhook.js';
import {parseCommand} from '../src/telegram/commands.js';
const f=await fixture();try{
 const token='a'.repeat(32);await f.repo.token(OWNER,'identity',token);
 const m={chat:{id:123,type:'private'},from:{id:123},text:'/start chapter_'+token};
 await assert.rejects(f.repo.transaction(c=>consumeIdentity(f.repo,c,token,{...m,chat:{id:-5,type:'group'}})));
 await assert.rejects(f.repo.transaction(c=>consumeIdentity(f.repo,c,token,{...m,sender_chat:{id:1}})));
 const results=await Promise.allSettled([1,2].map(()=>f.repo.transaction(c=>consumeIdentity(f.repo,c,token,m))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await f.pool.query('SELECT count(*) FROM chapter.telegram_identities')).rows[0].count,'1');
 assert(!await new TelegramRepository(f.pool,'prd').identity(OWNER));
 assert.equal(await f.repo.destination(OTHER,(await f.repo.destinations(OWNER))[0].id),undefined);
 await assert.rejects(f.repo.transaction(c=>consumeIdentity(f.repo,c,token,m)));
 await f.repo.token(OTHER,'identity','b'.repeat(32));await assert.rejects(f.repo.transaction(c=>consumeIdentity(f.repo,c,'b'.repeat(32),m)));
 await f.repo.disconnect(OWNER);assert(!await f.repo.identity(OWNER));
 const t='c'.repeat(32);await f.repo.token(OWNER,'identity',t);
 await assert.rejects(f.repo.transaction(async c=>{await consumeIdentity(f.repo,c,t,m);throw new Error('rollback');}));
 await handleUpdate(f.outbox,{update_id:9,message:{...m,text:'/start chapter_'+t}},'FixtureBot');
 await handleUpdate(f.outbox,{update_id:9,message:{...m,text:'/start chapter_'+t}},'FixtureBot');assert.equal(f.sends.length,1);
 assert(parseCommand('/chapter_send@FixtureBot abcdef123456','FixtureBot'));assert(!parseCommand('/chapter_send@Other abcdef123456','FixtureBot'));
 console.log('PASS PostgreSQL atomic token consume, rollback, replay, numeric/private identity, environment, IDOR, webhook dedupe, command suffix');
}finally{await f.close();}
