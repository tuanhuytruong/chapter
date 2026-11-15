import type { Outbox } from './outbox.js';
import { consumeIdentity } from './identity.js';
import { activateDestination,numericSender,verifyRights } from './destinations.js';
import { command } from './commands.js';
import { migrateChat } from './migration.js';
import { hash } from './repository.js';
import { consumeRateLimit } from './limits.js';

export async function handleUpdate(outbox: Outbox,update: any,username: string) {
 if(!Number.isSafeInteger(update?.update_id))return;
 const {repo,bot}=outbox;
 const reply=await repo.transaction(async c=>{
  const inserted=await c.query('INSERT INTO chapter.telegram_webhook_updates(environment,bot_key,update_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING update_id',[repo.environment,bot.key,update.update_id]);
  if(!inserted.rowCount)return null;
  const m=update.message;if(!m)return null;
  if(m.migrate_to_chat_id){await migrateChat(repo,c,String(m.chat.id),String(m.migrate_to_chat_id));return null;}
  if(typeof m.text==='string'&&m.text.startsWith('/chapter_')&&!await consumeRateLimit(repo,c,hash(String(m.from?.id||m.chat?.id)),1000))return null;
  const start=typeof m.text==='string'&&m.text.match(/^\/start chapter_([A-Za-z0-9_-]{24,})$/);
  if(start){await consumeIdentity(repo,c,start[1],m);return {chat:m.chat.id,text:'Linked. Configure books and consent in Chapter. Sending remains disabled until enabled.'};}
  const bind=typeof m.text==='string'&&m.text.match(/^\/chapter_bind(?:@([A-Za-z0-9_]+))?\s+([A-Za-z0-9_-]{24,})$/);
  if(bind){
   if(bind[1]&&bind[1].toLowerCase()!==username.replace(/^@/,'').toLowerCase())return null;
   const sender=numericSender(m);if(!sender||!['group','supergroup'].includes(m.chat?.type))throw new Error('GROUP_SENDER_REQUIRED');
   const request=await repo.consume(c,bind[2],'destination');if(!request)throw new Error('TOKEN_EXPIRED_OR_USED');
   const identity=await repo.identity(request.user_id,c);if(!identity||identity.telegram_user_id!==sender)throw new Error('IDENTITY_MISMATCH');
   const chat=await verifyRights(bot,identity,String(m.chat.id));await activateDestination(repo,c,identity,chat,Number(m.message_thread_id)||0);
   return {chat:m.chat.id,thread:m.message_thread_id,text:'Destination verified. No books shared yet. Configure explicit consent in Chapter.'};
  }
  const text=await command(outbox,m,username,c);return text?{chat:m.chat.id,thread:m.message_thread_id,text}:null;
 });
 // Confirmation failure does not roll back durable linking or enqueue. No private book titles in link responses.
 if(reply)await bot.call('sendMessage',{chat_id:reply.chat,message_thread_id:reply.thread,text:reply.text},{outbound:true,group:String(reply.chat).startsWith('-')}).catch(()=>undefined);
}
