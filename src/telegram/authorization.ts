import type { TelegramRepository } from './repository.js';
import type { BotClient } from './client.js';
import { verifyRights } from './destinations.js';
export async function authorized(repo: TelegramRepository,bot: BotClient,owner: string,destination: string,book?: string,c: any=repo.pool) {
 const d=await repo.destination(owner,destination,c),identity=await repo.identity(owner,c);
 if(!d||!identity||d.identity_id!==identity.id||d.state!=='active')throw new Error('DESTINATION_NOT_READY');
 const s=await c.query('SELECT * FROM chapter.telegram_subscriptions WHERE environment=$1 AND destination_id=$2 AND enabled',[repo.environment,d.id]);
 if(!s.rowCount)throw new Error('SUBSCRIPTION_DISABLED');
 if(book){const b=await c.query(`SELECT b.id FROM chapter.books b JOIN chapter.telegram_book_grants g ON g.book_id=b.id AND g.environment=$1 AND g.destination_id=$2 AND g.revoked_at IS NULL AND g.granted_by=$3 WHERE b.id=$4 AND b.owner_id=$3 AND b.status='active'`,[repo.environment,d.id,owner,book]);if(!b.rowCount)throw new Error('BOOK_NOT_AUTHORIZED');}
 await verifyRights(bot,identity,d.chat_id,d.type);return {d,s:s.rows[0]};
}
