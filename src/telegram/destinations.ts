import type { TelegramRepository } from './repository.js';
import type { BotClient } from './client.js';
export const numericSender = (m: any) => !m?.sender_chat && Number.isSafeInteger(m?.from?.id) && m.from.id>0 && !m.from.is_bot ? String(m.from.id):null;
export async function verifyRights(bot: BotClient, identity: any, chatId: string, expectedType?: string) {
 const chat=await bot.call('getChat',{chat_id:chatId});
 if(!['private','group','supergroup','channel'].includes(chat.type)||expectedType&&chat.type!==expectedType)throw new Error('DESTINATION_TYPE');
 if(chat.type==='private') { if(String(chat.id)!==identity.private_chat_id)throw new Error('PRIVATE_IDENTITY'); return chat; }
 const me=await bot.call('getMe',{});
 const manager=await bot.call('getChatMember',{chat_id:chat.id,user_id:identity.telegram_user_id});
 const member=await bot.call('getChatMember',{chat_id:chat.id,user_id:me.id});
 if(!['creator','administrator'].includes(manager.status))throw new Error('MANAGER_ADMIN_REQUIRED');
 if(chat.type==='channel' ? !['creator','administrator'].includes(member.status)||member.status!=='creator'&&!member.can_post_messages : ['left','kicked','restricted'].includes(member.status))throw new Error('BOT_PERMISSION_REQUIRED');
 return chat;
}
export async function activateDestination(repo: TelegramRepository,c: any,identity: any,chat: any,thread=0) {
 if(!Number.isSafeInteger(thread)||thread<0||thread&&chat.type!=='supergroup'||thread&&!chat.is_forum)throw new Error('INVALID_TOPIC');
 // Reconnect reuses the same row, not a new authority or dedupe namespace.
 const r=await c.query(`INSERT INTO chapter.telegram_destinations(environment,manager_user_id,identity_id,chat_id,thread_id,type,label,state,permissions_checked_at) VALUES($1,$2,$3,$4,$5,$6,$7,'paused',now()) ON CONFLICT(environment,chat_id,thread_id) DO UPDATE SET identity_id=EXCLUDED.identity_id,state='paused',activated_at=now(),label=EXCLUDED.label,permissions_checked_at=now() WHERE telegram_destinations.manager_user_id=EXCLUDED.manager_user_id RETURNING *`,[repo.environment,identity.user_id,identity.id,String(chat.id),thread,chat.type,String(chat.title||chat.first_name||'Private').slice(0,200)]);
 if(!r.rowCount)throw new Error('DESTINATION_MANAGER_CONFLICT');return r.rows[0];
}
