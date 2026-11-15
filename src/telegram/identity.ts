import type { TelegramRepository } from './repository.js';
import { activateDestination, numericSender } from './destinations.js';
export async function consumeIdentity(repo: TelegramRepository,c: any,token: string,message: any) {
 const sender=numericSender(message);
 if(!sender||message.chat?.type!=='private'||String(message.chat.id)!==sender)throw new Error('PRIVATE_SENDER_REQUIRED');
 const request=await repo.consume(c,token,'identity'); if(!request)throw new Error('TOKEN_EXPIRED_OR_USED');
 const existing=await repo.identity(request.user_id,c);
 if(existing)throw new Error('DISCONNECT_FIRST');
 const r=await c.query('INSERT INTO chapter.telegram_identities(environment,user_id,telegram_user_id,private_chat_id) VALUES($1,$2,$3,$4) RETURNING *',[repo.environment,request.user_id,sender,String(message.chat.id)]);
 await activateDestination(repo,c,r.rows[0],{id:message.chat.id,type:'private',first_name:'Private'});
 return r.rows[0];
}
