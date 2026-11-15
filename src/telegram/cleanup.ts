import type {TelegramRepository} from './repository.js';
/** Retain metadata dedupe ledger, never content indefinitely. Do not drop ledger rows. */
export async function cleanup(repo:TelegramRepository){
 await repo.transaction(async c=>{
  // Book moved to another owner is no longer authorized; deletion is FK-cascaded.
  await c.query(`UPDATE chapter.telegram_delivery_parts p SET html=NULL,state=CASE WHEN p.state='pending' THEN 'canceled' ELSE p.state END FROM chapter.telegram_deliveries d WHERE p.environment=$1 AND d.environment=p.environment AND d.id=p.delivery_id AND (d.created_at<now()-interval '7 days' AND d.state IN ('sent','canceled','expired','failed') OR NOT EXISTS(SELECT 1 FROM chapter.books b WHERE b.id=d.book_id AND b.owner_id=d.owner_id))`,[repo.environment]);
  await c.query("DELETE FROM chapter.telegram_link_requests WHERE environment=$1 AND expires_at<now()-interval '1 day'",[repo.environment]);
  await c.query("DELETE FROM chapter.telegram_webhook_updates WHERE environment=$1 AND created_at<now()-interval '7 days'",[repo.environment]);
 });
}
