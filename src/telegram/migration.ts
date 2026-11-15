import type {TelegramRepository} from './repository.js';
/** Telegram's authenticated service message, never a caller-supplied redirect. */
export async function migrateChat(repo:TelegramRepository,c:any,oldId:string,newId:string){
 if(!/^-\d+$/.test(oldId)||!/^-[0-9]+$/.test(newId))throw new Error('INVALID_CHAT_MIGRATION');
 const destinations=(await c.query('SELECT * FROM chapter.telegram_destinations WHERE environment=$1 AND chat_id=$2 FOR UPDATE',[repo.environment,oldId])).rows;
 for(const d of destinations){
  const oldKey=`${oldId}:${d.thread_id}`,newKey=`${newId}:${d.thread_id}`;
  // On conflicting preexisting authority/ledger, roll back and require operator reconciliation.
  await c.query('UPDATE chapter.telegram_deliveries SET canonical_destination=$3 WHERE environment=$1 AND canonical_destination=$2',[repo.environment,oldKey,newKey]);
  await c.query("UPDATE chapter.telegram_destinations SET chat_id=$3,type='supergroup',permissions_checked_at=NULL WHERE environment=$1 AND id=$2",[repo.environment,d.id,newId]);
 }
}
