import type { Outbox } from './outbox.js';
import { numericSender,verifyRights } from './destinations.js';
export function parseCommand(text: unknown,username: string) {
 if(typeof text!=='string')return null;
 const m=text.trim().match(/^\/(chapter_help|chapter_books|chapter_send|chapter_status)(?:@([A-Za-z0-9_]+))?(?:\s+([a-f0-9]{12})(?:\s+([a-f0-9-]{36}))?)?$/i);
 if(!m||m[2]&&m[2].toLowerCase()!==username.replace(/^@/,'').toLowerCase())return null;
 return {name:m[1].toLowerCase(),code:m[3],destination:m[4]};
}
export async function command(outbox: Outbox,message: any,username: string,c: any) {
 const cmd=parseCommand(message?.text,username),sender=numericSender(message);if(!cmd||!sender)return null;
 const {repo,bot}=outbox;
 const identity=(await c.query('SELECT * FROM chapter.telegram_identities WHERE environment=$1 AND telegram_user_id=$2 AND revoked_at IS NULL',[repo.environment,sender])).rows[0];
 if(!identity)return 'Reconnect through Chapter first.';
 const privateChat=message.chat?.type==='private'&&String(message.chat.id)===identity.private_chat_id;
 if(message.chat?.type==='channel')return null;
 const d=privateChat&&cmd.destination?await repo.destination(identity.user_id,cmd.destination,c):(await c.query("SELECT * FROM chapter.telegram_destinations WHERE environment=$1 AND manager_user_id=$2 AND chat_id=$3 AND thread_id=$4 AND state<>'revoked'",[repo.environment,identity.user_id,String(message.chat.id),Number(message.message_thread_id)||0])).rows[0];
 if(!d)return 'Destination is not configured in this topic.';
 await verifyRights(bot,identity,d.chat_id,d.type);
 if(cmd.name==='chapter_help')return '/chapter_books · /chapter_send <book-code> [destination-id in private] · /chapter_status. Configure consent in Chapter.';
 if(cmd.name==='chapter_status'){const h=await repo.history(identity.user_id,d.id);return `Destination: ${d.state}. Recent deliveries: ${h.length}. ${h[0]?.state||'No delivery'}.`;}
 const books=(await c.query("SELECT g.code,b.title,b.id FROM chapter.telegram_book_grants g JOIN chapter.books b ON b.id=g.book_id AND b.owner_id=$3 WHERE g.environment=$1 AND g.destination_id=$2 AND g.granted_by=$3 AND g.revoked_at IS NULL AND b.status='active' ORDER BY g.code",[repo.environment,d.id,identity.user_id])).rows;
 if(cmd.name==='chapter_books')return books.length?books.map(x=>`${x.code} · ${x.title}`).join('\n').slice(0,3000):'No explicitly granted books.';
 const b=books.find(x=>x.code===cmd.code);if(!b)return 'Book code is not authorized for this destination.';
 const r=await outbox.enqueue(identity.user_id,d.id,undefined,b.id,c);return `${r.date}: ${r.queued} queued. ${r.queued?'Delivery is asynchronous.':'Already queued/sent or no new summary.'}`;
}
