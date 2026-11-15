import { Router } from 'express';
import { createLinkToken,deepLink } from '../telegram-link.js';
import { userFrom,requireAuth } from '../auth.js';
import { activateDestination,verifyRights } from '../telegram/destinations.js';
import { nextRun } from '../telegram/scheduler.js';
import type { Outbox } from '../telegram/outbox.js';
import {consumeRateLimit} from '../telegram/limits.js';
import {hash} from '../telegram/repository.js';

export function telegramRouter(outbox: Outbox,username: string) {
 const router=Router(),{repo,bot}=outbox;
 router.use(requireAuth);
 router.use(async(req,res,next)=>{try{if(!await repo.ready())return res.status(503).json({error:'MIGRATION_REQUIRED',available:false});next();}catch{res.status(503).json({error:'TELEGRAM_UNAVAILABLE'});}});
 const action=(fn:any)=>async(req:any,res:any)=>{try{
  if(req.method!=='GET'){
   const origin=req.get('origin');if(origin&&origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({error:'ORIGIN_REJECTED'});
   const allowed=await repo.transaction(c=>consumeRateLimit(repo,c,hash(`${userFrom(req).id}:${req.method}:${req.route.path}`),1000));if(!allowed)return res.status(429).json({error:'RATE_LIMITED'});
  }
  await fn(req,res,userFrom(req).id);
 }catch(e:any){res.status(400).json({error:/^[A-Z_]+$/.test(e.message)?e.message:'TELEGRAM_ACTION_REJECTED'});}};
 router.get('/status',action(async(_req:any,res:any,owner:string)=>{const identity=await repo.identity(owner);res.json({available:true,connected:!!identity,identity:identity?{linked_at:identity.linked_at}:null,senderEnabled:outbox.enabled,destinations:await repo.destinations(owner)});}));
 router.post('/link',action(async(_req:any,res:any,owner:string)=>{if(!username)throw new Error('BOT_NOT_CONFIGURED');const token=createLinkToken();await repo.token(owner,'identity',token);res.json({url:deepLink(username,token),expires_in_seconds:900});}));
 router.delete('/identity',action(async(_req:any,res:any,owner:string)=>{await repo.disconnect(owner);res.json({connected:false});}));
 router.post('/destination-link',action(async(_req:any,res:any,owner:string)=>{if(!await repo.identity(owner))throw new Error('RECONNECT_REQUIRED');const token=createLinkToken();await repo.token(owner,'destination',token);res.json({command:`/chapter_bind@${username} ${token}`,expires_in_seconds:900});}));
 router.post('/channels/verify',action(async(req:any,res:any,owner:string)=>{
  const identity=await repo.identity(owner);if(!identity)throw new Error('RECONNECT_REQUIRED');
  const input=String(req.body.channel||'');if(!/^(@[A-Za-z0-9_]{5,32}|-100\d{5,})$/.test(input))throw new Error('INVALID_CHANNEL');
  const chat=await verifyRights(bot,identity,input,'channel'),token=createLinkToken();await repo.token(owner,'channel',token,{chat_id:String(chat.id),identity_id:identity.id});
  res.json({candidate:token,label:chat.title,type:chat.type,expires_in_seconds:900});
 }));
 router.post('/channels/confirm',action(async(req:any,res:any,owner:string)=>{
  if(req.body.consent!==true)throw new Error('CONSENT_REQUIRED');
  const d=await repo.transaction(async c=>{const request=await repo.consume(c,String(req.body.candidate||''),'channel',owner);if(!request)throw new Error('TOKEN_EXPIRED_OR_USED');const identity=await repo.identity(owner,c);if(!identity||identity.id!==request.candidate.identity_id)throw new Error('IDENTITY_CHANGED');const chat=await verifyRights(bot,identity,request.candidate.chat_id,'channel');return activateDestination(repo,c,identity,chat);});res.json(d);
 }));
 router.get('/destinations',action(async(_req:any,res:any,owner:string)=>res.json(await repo.destinations(owner))));
 router.use('/destinations/:id',async(req:any,res:any,next:any)=>{try{const d=await repo.destination(userFrom(req).id,req.params.id);if(!d)return res.status(404).json({error:'NOT_FOUND'});next();}catch{res.status(404).json({error:'NOT_FOUND'});}});
 router.delete('/destinations/:id',action(async(req:any,res:any,owner:string)=>{await repo.transaction(async c=>{await c.query("UPDATE chapter.telegram_destinations SET state='revoked' WHERE environment=$1 AND manager_user_id=$2 AND id=$3",[repo.environment,owner,req.params.id]);await c.query('UPDATE chapter.telegram_subscriptions SET enabled=false WHERE environment=$1 AND destination_id=$2',[repo.environment,req.params.id]);await repo.cancel(c,owner);});res.json({ok:true});}));
 router.get('/destinations/:id/config',action(async(req:any,res:any,owner:string)=>{const grants=(await repo.pool.query('SELECT book_id,code FROM chapter.telegram_book_grants WHERE environment=$1 AND destination_id=$2 AND granted_by=$3 AND revoked_at IS NULL',[repo.environment,req.params.id,owner])).rows;const subscription=(await repo.pool.query('SELECT * FROM chapter.telegram_subscriptions WHERE environment=$1 AND destination_id=$2',[repo.environment,req.params.id])).rows[0]||null;res.json({grants,subscription});}));
 router.put('/destinations/:id/subscription',action(async(req:any,res:any,owner:string)=>{
  const books=Array.isArray(req.body.books)?[...new Set(req.body.books)]:[];if(books.length>100)throw new Error('TOO_MANY_BOOKS');
  const timezone=String(req.body.timezone||'Asia/Bangkok'),time=String(req.body.local_time||'20:00');const due=nextRun(new Date(),time,timezone);
  if(books.length&&req.body.consent!==true)throw new Error('CONSENT_REQUIRED');
  const identity=await repo.identity(owner),d=await repo.destination(owner,req.params.id);if(!identity||identity.id!==d.identity_id)throw new Error('RECONNECT_REQUIRED');await verifyRights(bot,identity,d.chat_id,d.type);
  await repo.transaction(async c=>{
   const valid=await c.query('SELECT id FROM chapter.books WHERE owner_id=$1 AND id=ANY($2::uuid[]) AND status=\'active\'',[owner,books]);if(valid.rowCount!==books.length)throw new Error('BOOK_NOT_AUTHORIZED');
   await c.query('UPDATE chapter.telegram_book_grants SET revoked_at=now() WHERE environment=$1 AND destination_id=$2 AND NOT(book_id=ANY($3::uuid[]))',[repo.environment,d.id,books]);
   for(const book of books)await c.query('INSERT INTO chapter.telegram_book_grants(environment,destination_id,book_id,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT(environment,destination_id,book_id) DO UPDATE SET revoked_at=NULL,granted_at=now()',[repo.environment,d.id,book,owner]);
   await c.query('INSERT INTO chapter.telegram_subscriptions(environment,destination_id,local_time,timezone,enabled,next_run_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(environment,destination_id) DO UPDATE SET local_time=$3,timezone=$4,enabled=$5,next_run_at=$6,updated_at=now()',[repo.environment,d.id,time,timezone,req.body.enabled===true,due]);
   await c.query("UPDATE chapter.telegram_destinations SET state=$4 WHERE environment=$1 AND manager_user_id=$2 AND id=$3",[repo.environment,owner,d.id,req.body.enabled===true?'active':'paused']);
  });res.json({ok:true,next_run_at:due});
 }));
 router.get('/destinations/:id/preview',action(async(req:any,res:any,owner:string)=>{const p=await outbox.preview(owner,req.params.id);res.json({date:p.date,sessions:p.logs.length});}));
 router.post('/destinations/:id/send',action(async(req:any,res:any,owner:string)=>res.json(await outbox.enqueue(owner,req.params.id))));
 router.post('/destinations/:id/test',action(async(req:any,res:any,owner:string)=>{if(!outbox.enabled)throw new Error('SENDER_DISABLED');const d=await repo.destination(owner,req.params.id),identity=await repo.identity(owner);if(!identity)throw new Error('RECONNECT_REQUIRED');await verifyRights(bot,identity,d.chat_id,d.type);await bot.call('sendMessage',{chat_id:d.chat_id,message_thread_id:Number(d.thread_id)||undefined,text:'Chapter · Synthetic connection test. No book content.'},{outbound:true,group:d.type!=='private'});res.json({ok:true});}));
 router.get('/destinations/:id/history',action(async(req:any,res:any,owner:string)=>res.json(await repo.history(owner,req.params.id))));
 router.post('/deliveries/:id/resolve',action(async(req:any,res:any,owner:string)=>{if(!outbox.enabled)throw new Error('SENDER_DISABLED');await outbox.resolve(owner,req.params.id,req.body.action,req.body.duplicateWarning===true);res.json({ok:true});}));
 return router;
}
