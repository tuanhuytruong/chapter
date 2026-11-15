import assert from 'node:assert/strict';
import express from 'express';
import {fixture,OWNER,OTHER,BOOK} from './fixtures/telegram-v2.js';
import {telegramRouter} from '../src/routes/telegram.js';
const f=await fixture();const {d}=await f.seed();const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.session={user:{id:req.header('x-owner')||OWNER}};next();});app.use('/api/telegram',telegramRouter(f.outbox,'FixtureBot'));const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const address:any=server.address();const base=`http://127.0.0.1:${address.port}/api/telegram`;
const call=async(path:string,method='GET',body?:any,owner=OWNER,origin?:string)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','x-owner':owner,...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
try{
 for(const [suffix,method,body] of [['/config','GET',null],['/history','GET',null],['/subscription','PUT',{books:[BOOK],consent:true}],['/send','POST',{}],['/test','POST',{}],['','DELETE',{}]] as any[])assert.equal((await call(`/destinations/${d.id}${suffix}`,method,body,OTHER)).status,404);
 assert.equal((await call('/link','POST',{},OWNER,'https://attacker.example')).status,403);
 const candidate=await call('/channels/verify','POST',{channel:'-100123456789'});assert.equal(candidate.status,200);assert(candidate.data.candidate);assert.equal((await f.repo.destinations(OWNER)).length,1);
 const stolen=await call('/channels/confirm','POST',{candidate:candidate.data.candidate,consent:true},OTHER);assert.equal(stolen.status,400);
 f.setFault('permission');
 assert.equal((await call('/channels/confirm','POST',{candidate:candidate.data.candidate,consent:true})).status,400);
 assert.equal((await f.repo.destinations(OWNER)).length,1,'permission removal must not activate candidate');
 f.setFault(null);await new Promise(r=>setTimeout(r,1050));
 const confirmed=await call('/channels/confirm','POST',{candidate:candidate.data.candidate,consent:true});assert.equal(confirmed.status,200);assert.equal(confirmed.data.state,'paused');
 await new Promise(r=>setTimeout(r,1050));assert.equal((await call('/channels/confirm','POST',{candidate:candidate.data.candidate,consent:true})).status,400,'confirmed candidate cannot replay');
 const badBook=await call(`/destinations/${d.id}/subscription`,'PUT',{books:['99999999-9999-4999-8999-999999999999'],consent:true,local_time:'20:00',timezone:'Asia/Bangkok',enabled:true});assert.equal(badBook.status,400);
 const token=await call('/link','POST',{});assert.equal(token.status,200);assert.equal((await call('/link','POST',{})).status,429);
 await f.pool.query('DROP TABLE chapter.telegram_delivery_parts');assert.equal((await call('/status')).status,503);
 console.log('PASS real HTTP IDOR methods, cross-origin rejection, channel pending/confirm owner scope, arbitrary-book rejection, link rate limiting, missing-schema response');
}finally{server.close();await f.close();}
