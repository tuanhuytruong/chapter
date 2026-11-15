import assert from 'node:assert/strict';
import {fixture} from './fixtures/telegram-v2.js';
import {BotClient,BotError} from '../src/telegram/client.js';
import {TelegramRepository} from '../src/telegram/repository.js';
const f=await fixture();try{
 const times:number[]=[];
 const transport:typeof fetch=async()=>{times.push(Date.now());return new Response(JSON.stringify({ok:true,result:{message_id:times.length}}));};
 const a=new BotClient('same-bot',f.repo,transport),b=new BotClient('same-bot',new TelegramRepository(f.pool,'prd'),transport);
 await Promise.all([a.call('sendMessage',{chat_id:'-5',message_thread_id:1,text:'x'},{outbound:true,group:true}),b.call('sendAudio',{chat_id:'-5',message_thread_id:2,text:'x'},{outbound:true,group:true})]);assert(times[1]-times[0]>=3000);
 const start=Date.now();await a.cooldown('-5',2);await b.call('sendMessage',{chat_id:'-5',text:'x'},{outbound:true,group:true});assert(Date.now()-start>=1900);
 const before=times.length;await assert.rejects(a.call('sendMessage',{chat_id:'-6'},{outbound:true,beforeDispatch:async()=>false}),(e:any)=>e.code==='STALE_OR_REVOKED');assert.equal(times.length,before);
 const bodyStall:typeof fetch=async(_url,init)=>({ok:true,json:()=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new Error('body aborted'))))} as any);
 const stalled=new BotClient('secret-never-log',f.repo,bodyStall);const t=Date.now();await assert.rejects(stalled.call('getMe',{}),(e:any)=>e instanceof BotError&&e.outcome==='unknown'&&!e.message.includes('secret'));assert(Date.now()-t>=9900&&Date.now()-t<12000);
 const reject:typeof fetch=async()=>new Response(JSON.stringify({ok:false,error_code:403,description:'private rejected detail'}),{status:403});await assert.rejects(new BotClient('secret',f.repo,reject).call('sendMessage',{}),(e:any)=>e.code==='PERMISSION_REJECTED'&&e.outcome==='rejected'&&!e.message.includes('private'));
 console.log('PASS durable cross-environment bot/chat/topic limiter, cooldown, predispatch stale guard, body timeout, redacted typed faults');
}finally{await f.close();}
